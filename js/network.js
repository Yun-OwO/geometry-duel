const NETWORK_CONFIG = {
    SIGNALING_URL: "https://geo.rngoodday.qzz.io",
    STUN_SERVERS: [
        { urls: 'stun:stun.aliyun.com:3478' },
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    INPUT_BUFFER_SIZE: 3,
    FRAME_DELAY: 3,
    POLL_INTERVAL: 1000,
};

const NET_LOG = (...args) => console.log('%c[NET]', 'color:#0a0;font-weight:bold', ...args);
const NET_WARN = (...args) => console.warn('%c[NET]', 'color:#a00;font-weight:bold', ...args);
const FS_LOG = (...args) => console.log('%c[FS]', 'color:#06c;font-weight:bold', ...args);

class DeterministicRandom {
    constructor(seed = 12345) {
        this.state = seed >>> 0;
    }

    next() {
        this.state = (this.state * 1664525 + 1013904223) >>> 0;
        return this.state / 4294967296;
    }

    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    nextFloat(min, max) {
        return min + this.next() * (max - min);
    }
}

/**
 * 帧同步核心逻辑
 *
 * 模型说明（修复死锁）：
 * - this.frame: 即将模拟的帧号
 * - this.inputsCollected: 已收集的本地输入数量（每tick+1）
 * - addLocalInput 把输入存入 inputs[inputsCollected]，然后 inputsCollected++
 * - canAdvance 当 inputsCollected > frame + FRAME_DELAY 且远端输入齐全时返回 true
 *   这样前 FRAME_DELAY 帧用来"预热"缓冲，之后每tick模拟1帧，本地输入始终领先 FRAME_DELAY 帧
 * - 这避免了原 bug：frame < FRAME_DELAY 永远为 true 导致 frame 永不递增
 */
class FrameSync {
    constructor(game, playerCount, localPlayerId) {
        this.game = game;
        this.playerCount = playerCount;
        this.localPlayerId = localPlayerId;
        this.frame = 0;
        this.inputsCollected = 0;
        this.inputs = new Map();
        this.remoteFrames = new Map();
        this.running = false;
        this.stallCount = 0;
    }

    start() {
        this.running = true;
        this.frame = 0;
        this.inputsCollected = 0;
        this.inputs.clear();
        this.remoteFrames.clear();
        this.stallCount = 0;
        FS_LOG('start playerCount=', this.playerCount, 'localId=', this.localPlayerId, 'delay=', NETWORK_CONFIG.FRAME_DELAY);
    }

    stop() {
        this.running = false;
    }

    addLocalInput(input) {
        const inputFrame = this.inputsCollected;
        this.inputs.set(inputFrame, { ...input, local: true });
        this.inputsCollected++;
        this.sendInput(inputFrame, input);
        return inputFrame;
    }

    sendInput(frame, input) {
        // 通过 WebRTC DataChannel 广播给所有已连接的对端
        Network.broadcastInput(frame, this.localPlayerId, this.serializeInput(input));
    }

    serializeInput(input) {
        return {
            mx: Math.round(input.moveX * 100) / 100,
            my: Math.round(input.moveY * 100) / 100,
            z: input.zPressed ? 1 : 0,
            x: input.xPressed ? 1 : 0,
        };
    }

    deserializeInput(data) {
        return {
            moveX: data.mx,
            moveY: data.my,
            zPressed: data.z === 1,
            xPressed: data.x === 1,
        };
    }

    receiveInput(frame, playerId, inputData) {
        if (!this.remoteFrames.has(frame)) {
            this.remoteFrames.set(frame, new Map());
        }
        this.remoteFrames.get(frame).set(playerId, this.deserializeInput(inputData));
    }

    canAdvance() {
        // 缓冲未预热到 FRAME_DELAY 之前不模拟
        if (this.inputsCollected <= this.frame + NETWORK_CONFIG.FRAME_DELAY) return false;

        const targetFrame = this.frame;
        if (!this.inputs.has(targetFrame)) return false;

        const expectedRemotes = this.playerCount - 1;
        if (expectedRemotes <= 0) return true;

        const frameInputs = this.remoteFrames.get(targetFrame);
        if (!frameInputs || frameInputs.size < expectedRemotes) {
            this.stallCount++;
            // 每60次停滞输出一次诊断，避免日志爆炸
            if (this.stallCount % 60 === 1) {
                const got = frameInputs ? frameInputs.size : 0;
                FS_LOG(`stall frame=${targetFrame} expected=${expectedRemotes} got=${got} inputsCollected=${this.inputsCollected}`);
                console.log(`[CANADVANCE] frame=${this.frame} inputsCollected=${this.inputsCollected} remoteFrames.has(${this.frame})=${this.remoteFrames.has(this.frame)} remoteSize=${this.remoteFrames.get(this.frame)?.size ?? 0} expectedRemotes=${this.playerCount - 1}`);
            }
            return false;
        }
        this.stallCount = 0;
        return true;
    }

    getInputForFrame(frame, playerId) {
        if (playerId === this.localPlayerId) {
            return this.inputs.get(frame) || { moveX: 0, moveY: 0, zPressed: false, xPressed: false };
        }
        if (this.remoteFrames.has(frame)) {
            return this.remoteFrames.get(frame).get(playerId) || { moveX: 0, moveY: 0, zPressed: false, xPressed: false };
        }
        return { moveX: 0, moveY: 0, zPressed: false, xPressed: false };
    }

    advanceFrame() {
        this.frame++;
        if (this.frame > 10000) {
            this.cleanupOldFrames();
        }
    }

    cleanupOldFrames() {
        const cutoff = this.frame - 60;
        for (const frame of this.inputs.keys()) {
            if (frame < cutoff) this.inputs.delete(frame);
        }
        for (const frame of this.remoteFrames.keys()) {
            if (frame < cutoff) this.remoteFrames.delete(frame);
        }
    }
}

class NetworkManager {
    constructor() {
        this.roomCode = '';
        this.playerId = 0;
        this.isHost = false;
        this.maxPlayers = 3;
        this.connections = new Map();
        this.dataChannels = new Map();
        this.connectedPlayerIds = new Set();
        this.frameSync = null;
        this.rng = null;
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onGameStart = null;
        this.onRemoteInput = null;
        this.pollInterval = null;
        this.pollSince = 0;
        this.signalQueue = [];
        this.knownPlayers = [];
        this.gameStarted = false;
    }

    get signalingUrl() {
        return NETWORK_CONFIG.SIGNALING_URL;
    }

    async createRoom(maxPlayers = 3) {
        this.maxPlayers = maxPlayers;
        this.isHost = true;
        this.playerId = 0;

        if (this.signalingUrl) {
            const res = await fetch(`${this.signalingUrl}/api/room/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxPlayers }),
            });
            if (!res.ok) throw new Error('创建失败');
            const data = await res.json();
            this.roomCode = data.code;
            this.maxPlayers = data.maxPlayers || maxPlayers;
        } else {
            this.roomCode = this.generateRoomCode();
        }

        this.knownPlayers = [{ id: 0, name: '你', host: true }];
        this.startPolling();
        NET_LOG('createRoom code=', this.roomCode, 'maxPlayers=', this.maxPlayers);
        return this.roomCode;
    }

    async joinRoom(code) {
        this.roomCode = code.toUpperCase();
        this.isHost = false;

        if (this.signalingUrl) {
            const res = await fetch(`${this.signalingUrl}/api/room/${this.roomCode}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || '加入失败');
            }
            const data = await res.json();
            this.playerId = data.playerId;
            this.maxPlayers = data.maxPlayers;
            this.knownPlayers = data.players.map((p) => ({
                ...p,
                name: p.id === this.playerId ? '你' : p.name,
            }));
        } else {
            this.playerId = 1;
            this.knownPlayers = [
                { id: 0, name: '房主', host: true },
                { id: 1, name: '你', host: false },
            ];
        }

        this.startPolling();
        NET_LOG('joinRoom code=', this.roomCode, 'playerId=', this.playerId, 'maxPlayers=', this.maxPlayers);
        return {
            playerId: this.playerId,
            maxPlayers: this.maxPlayers,
            players: this.knownPlayers,
        };
    }

    async leaveRoom() {
        this.stopPolling();
        if (this.signalingUrl && this.roomCode) {
            fetch(`${this.signalingUrl}/api/room/${this.roomCode}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: this.playerId }),
            }).catch(() => {});
        }
        this.closeAllConnections();
        this.roomCode = '';
        this.playerId = 0;
        this.isHost = false;
        this.knownPlayers = [];
        this.gameStarted = false;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    startPolling() {
        this.stopPolling();
        this.pollSince = 0;
        this.pollInterval = setInterval(() => this.pollSignals(), NETWORK_CONFIG.POLL_INTERVAL);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * 轮询信令服务器：
     * - 仅用于交换 WebRTC offer/answer/ICE 和玩家列表
     * - 不再用于转发游戏输入（输入走 DataChannel）
     * - 房主检测到新玩家后主动发起 connectToPlayer
     */
    async pollSignals() {
        if (!this.signalingUrl || !this.roomCode) return;

        try {
            const res = await fetch(
                `${this.signalingUrl}/api/room/${this.roomCode}/poll?playerId=${this.playerId}&since=${this.pollSince}`
            );
            if (!res.ok) return;
            const data = await res.json();

            if (data.since !== undefined) this.pollSince = data.since;

            if (data.players) {
                const oldLen = this.knownPlayers.length;
                this.knownPlayers = data.players.map((p) => ({
                    ...p,
                    name: p.id === this.playerId ? '你' : p.name,
                }));

                // 房主：对新加入的玩家主动发起 WebRTC 连接
                if (this.isHost) {
                    for (const p of this.knownPlayers) {
                        if (p.id !== this.playerId && !this.connections.has(p.id)) {
                            NET_LOG('host initiating connection to player', p.id);
                            this.connectToPlayer(p.id).catch((e) => {NET_WARN('connectToPlayer failed', p.id, e);prompt('err:', e);});
                        }
                    }
                }

                if (this.knownPlayers.length !== oldLen && this.onPlayerJoin) {
                    this.onPlayerJoin(this.knownPlayers);
                }
            }

            if (data.signals && data.signals.length > 0) {
                for (const sig of data.signals) {
                    if (sig.toId === this.playerId) {
                        this.handleSignal(sig.fromId, sig.data);
                    }
                }
            }
        } catch (e) {
            NET_WARN('Poll error:', e);
        }
    }

    async sendSignal(targetId, data) {
        if (!this.signalingUrl) return;
        try {
            await fetch(`${this.signalingUrl}/api/room/${this.roomCode}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromId: this.playerId,
                    toId: targetId,
                    data,
                }),
            });
        } catch (e) {
            NET_WARN('Send signal error:', e);
        }
    }

    /**
     * 创建到 targetId 的 RTCPeerConnection。
     * 房主作为 offer 方创建 DataChannel；非房主作为 answer 方，被动接收 DataChannel。
     */
    async connectToPlayer(playerId) {
        if (this.connections.has(playerId)) return this.connections.get(playerId);

        NET_LOG('connectToPlayer', playerId, 'isHost=', this.isHost);

        const pc = new RTCPeerConnection({
            iceServers: NETWORK_CONFIG.STUN_SERVERS,
        });

        this.connections.set(playerId, pc);

        // 房主创建 DataChannel
        if (this.isHost) {
            const dc = pc.createDataChannel('game-input', {
                ordered: false,
                maxRetransmits: 0,
            });
            this.setupDataChannel(dc, playerId);
        }

        pc.ondatachannel = (event) => {
            // 非房主端接收 DataChannel
            NET_LOG('ondatachannel from', playerId);
            this.setupDataChannel(event.channel, playerId);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.sendSignal(playerId, {
                    type: 'ice',
                    candidate: e.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            NET_LOG('pc state', playerId, '=', pc.connectionState);
        };

        if (this.isHost) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.sendSignal(playerId, { type: 'offer', offer });
            } catch (e) {
                NET_WARN('createOffer failed', e);
            }
        }

        return pc;
    }

    setupDataChannel(dc, playerId) {
        dc.onopen = () => {
            NET_LOG('DataChannel OPEN with player', playerId, 'readyState=', dc.readyState);
            this.dataChannels.set(playerId, dc);
            this.connectedPlayerIds.add(playerId);
            if (this.onPlayerJoin) {
                this.onPlayerJoin(this.knownPlayers);
            }
        };

        dc.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                this.handleMessage(playerId, msg);
            } catch (err) {
                NET_WARN('parse msg failed', err);
            }
        };

        dc.onclose = () => {
            NET_LOG('DataChannel closed with player', playerId);
            this.dataChannels.delete(playerId);
            this.connectedPlayerIds.delete(playerId);
        };

        dc.onerror = (e) => {
            NET_WARN('DataChannel error', playerId, e);
        };
    }

    async handleSignal(fromId, data) {
        // 通过信令服务器收到游戏开始信号（备用通道）
        if (data.type === 'gamestart') {
            NET_LOG('received gamestart via signaling from', fromId);
            this.startGameRemote(data.seed, data.playerCount);
            return;
        }

        let pc = this.connections.get(fromId);
        if (!pc && !this.isHost) {
            // 非房主收到 offer 时被动创建连接
            pc = await this.connectToPlayer(fromId);
        }
        if (!pc) return;

        try {
            if (data.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                this.sendSignal(fromId, { type: 'answer', answer });
            } else if (data.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } else if (data.type === 'ice') {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (e) {
            NET_WARN('Signal handling error:', e);
        }
    }

    handleMessage(fromId, msg) {
        if (msg.type === 'input' && this.frameSync) {
            this.frameSync.receiveInput(msg.frame, msg.playerId, msg.input);
            if (this.onRemoteInput) {
                this.onRemoteInput(msg.frame, msg.playerId, msg.input);
            }
        } else if (msg.type === 'gamestart') {
            NET_LOG('received gamestart via DataChannel from', fromId);
            this.startGameRemote(msg.seed, msg.playerCount);
        } else {
            NET_WARN('unknown msg type', msg.type, 'from', fromId);
        }
    }

    /**
     * 通过所有已连接的 DataChannel 广播游戏输入
     */
    broadcastInput(frame, playerId, input) {
        if (this.dataChannels.size === 0) return;
        const msg = JSON.stringify({ type: 'input', frame, playerId, input });
        let sent = 0;
        for (const [id, dc] of this.dataChannels) {
            if (dc.readyState === 'open') {
                try {
                    dc.send(msg);
                    sent++;
                } catch (e) {
                    NET_WARN('send failed to', id, e);
                }
            }
        }
    }

    broadcastGameStart(seed, playerCount) {
        const msg = JSON.stringify({ type: 'gamestart', seed, playerCount });
        NET_LOG('broadcast gamestart seed=', seed, 'playerCount=', playerCount, 'channels=', this.dataChannels.size);
        for (const [id, dc] of this.dataChannels) {
            if (dc.readyState === 'open') {
                try {
                    dc.send(msg);
                } catch (e) {
                    NET_WARN('broadcast gamestart failed to', id, e);
                }
            } else {
                NET_WARN('gamestart: channel not open', id, 'state=', dc.readyState);
            }
        }
    }

    /**
     * 房主开始游戏：
     * - 生成 seed 和 frameSync
     * - 通过 DataChannel 广播 gamestart 给所有已连接的对端
     * - 同时通过信令服务器发送 gamestart 作为备用（防止 DataChannel 尚未 open）
     */
    async startHostGame() {
        const seed = Math.floor(Math.random() * 1000000);
        this.rng = new DeterministicRandom(seed);
        this.gameStarted = true;
        this.frameSync = new FrameSync(null, this.maxPlayers, this.playerId);
        this.frameSync.start();

        NET_LOG('startHostGame seed=', seed, 'maxPlayers=', this.maxPlayers,
            'dataChannels=', this.dataChannels.size, 'connected=', [...this.connectedPlayerIds]);

        // 通过 DataChannel 广播 gamestart
        this.broadcastGameStart(seed, this.maxPlayers);

        // 备用：通过信令服务器发送 gamestart（针对 DataChannel 未建立的玩家）
        if (this.signalingUrl && this.roomCode) {
            for (const player of this.knownPlayers) {
                if (player.id !== this.playerId) {
                    this.sendSignal(player.id, { type: 'gamestart', seed, playerCount: this.maxPlayers }).catch(() => {});
                }
            }
            // 也通知服务器记录状态
            try {
                await fetch(`${this.signalingUrl}/api/room/${this.roomCode}/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        seed,
                        playerCount: this.maxPlayers,
                        playerId: this.playerId,
                    }),
                });
            } catch (e) {
                NET_WARN('start game server call failed:', e);
            }
        }

        return { seed, playerCount: this.maxPlayers };
    }

    startGameRemote(seed, playerCount) {
        if (this.frameSync) {
            NET_WARN('startGameRemote called but frameSync already exists, ignoring');
            return;
        }
        NET_LOG('startGameRemote seed=', seed, 'playerCount=', playerCount);
        this.rng = new DeterministicRandom(seed);
        this.gameStarted = true;
        this.frameSync = new FrameSync(null, playerCount, this.playerId);
        this.frameSync.start();

        if (this.onGameStart) {
            this.onGameStart(seed, playerCount);
        }
    }

    closeAllConnections() {
        for (const [id, pc] of this.connections) {
            try { pc.close(); } catch (e) {}
        }
        this.connections.clear();
        this.dataChannels.clear();
        this.connectedPlayerIds.clear();
    }

    // 兼容旧调用（FrameSync.sendInput 之前用 Network.sendInputToServer）
    async sendInputToServer(frame, playerId, input) {
        // 不再使用服务器转发，改用 DataChannel
        this.broadcastInput(frame, playerId, input);
    }
}

const Network = new NetworkManager();
