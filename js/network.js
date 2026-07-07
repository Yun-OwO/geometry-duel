const NETWORK_CONFIG = {
    SIGNALING_URL: "https://geo.rngoodday.qzz.io",
    STUN_SERVERS: [
        { urls: 'stun:stun.aliyun.com:3478' },
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.nextcloud.com:3478' },
        { urls: 'stun:stun.google.com:19302' },
        { urls: 'stun:stun.moonlight-stream.org:3478' },
        { urls: 'stun:stun.freeswitch.org:3478' },
        { urls: 'stun:stun.telnyx.com:3478' },
    ],
    INPUT_BUFFER_SIZE: 3,
    FRAME_DELAY: 3,
    POLL_INTERVAL: 500,
    PING_INTERVAL: 2000,
    PING_TIMEOUT: 5000,
    INPUT_TIMEOUT: 3000,
    HANDSHAKE_TIMEOUT: 10000,
    HANDSHAKE_RETRY_DELAY: 2000,
    MAX_HANDSHAKE_RETRIES: 5,
    STUN_BATCH_SIZE: 4,
    FRAME_STALL_TIMEOUT: 2000,
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
        this.lastRemoteInput = new Map();
        this.frameStallStart = 0;
    }

    start() {
        this.running = true;
        this.frame = 0;
        this.inputsCollected = 0;
        this.inputs.clear();
        this.remoteFrames.clear();
        this.stallCount = 0;
        this.lastRemoteInput.clear();
        this.frameStallStart = 0;
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
        const deserialized = this.deserializeInput(inputData);
        if (!this.remoteFrames.has(frame)) {
            this.remoteFrames.set(frame, new Map());
        }
        this.remoteFrames.get(frame).set(playerId, deserialized);
        this.lastRemoteInput.set(playerId, deserialized);
    }

    canAdvance() {
        if (this.inputsCollected <= this.frame + NETWORK_CONFIG.FRAME_DELAY) return false;

        const targetFrame = this.frame;
        if (!this.inputs.has(targetFrame)) return false;

        const expectedRemotes = this.playerCount - 1;
        if (expectedRemotes <= 0) return true;

        const frameInputs = this.remoteFrames.get(targetFrame);
        if (!frameInputs || frameInputs.size < expectedRemotes) {
            this.stallCount++;

            if (this.frameStallStart === 0) {
                this.frameStallStart = Date.now();
            }

            const stallDuration = Date.now() - this.frameStallStart;
            if (stallDuration > NETWORK_CONFIG.FRAME_STALL_TIMEOUT) {
                const missing = [];
                for (const player of Network.knownPlayers) {
                    if (player.id === this.localPlayerId) continue;
                    if (!frameInputs || !frameInputs.has(player.id)) {
                        missing.push(player.id);
                    }
                }
                FS_LOG(`STALL TIMEOUT frame=${targetFrame} stalled ${stallDuration}ms, using fallback for players:`, missing);

                if (!frameInputs) {
                    frameInputs = new Map();
                    this.remoteFrames.set(targetFrame, frameInputs);
                }
                for (const pid of missing) {
                    const fallback = this.lastRemoteInput.get(pid) || { moveX: 0, moveY: 0, zPressed: false, xPressed: false };
                    frameInputs.set(pid, fallback);
                }
                this.stallCount = 0;
                this.frameStallStart = 0;
                return true;
            }

            if (this.stallCount % 60 === 1) {
                const got = frameInputs ? frameInputs.size : 0;
                FS_LOG(`stall frame=${targetFrame} expected=${expectedRemotes} got=${got} inputsCollected=${this.inputsCollected} stallMs=${stallDuration}`);
            }
            return false;
        }
        this.stallCount = 0;
        this.frameStallStart = 0;
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
        this.frameStallStart = 0;
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
        this.onNetworkStatus = null;
        this.onHandshakeComplete = null;
        this.onHandshakeFailed = null;
        this.pollInterval = null;
        this.pingInterval = null;
        this.pollSince = 0;
        this.signalQueue = [];
        this.knownPlayers = [];
        this.gameStarted = false;
        this.gameStartReceived = false;
        this.handshakeStarted = false;
        this.handshakeCompleted = false;
        this.handshakeRetries = 0;
        this.handshakeTimer = null;
        this.pingTimestamps = new Map();
        this.lastInputReceived = new Map();
        this.connectionStatus = new Map();
        this.iceCandidateBuffer = new Map();
        this.currentStunStartIndex = 0;
        this.reconnectingPlayers = new Set();
        // Per-target promise chain that serializes all sendSignal POSTs.
        // This is critical: without it, an 'offer' POST and an 'ice' POST can be
        // in flight simultaneously, and the server's read-modify-write on the
        // signals array loses whichever write lands first. By chaining, the
        // offer POST fully completes on the server before the ice POST starts.
        this._signalQueue = new Map();
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
        this.stopPing();
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
        this.gameStartReceived = false;
        this.handshakeStarted = false;
        this.handshakeCompleted = false;
        this.pingTimestamps.clear();
        this.lastInputReceived.clear();
        this.connectionStatus.clear();
        this.iceCandidateBuffer.clear();
        this._signalQueue.clear();
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

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            this.sendPing();
            this.checkInputTimeout();
        }, NETWORK_CONFIG.PING_INTERVAL);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendPing() {
        if (this.dataChannels.size === 0) return;
        const msg = JSON.stringify({ type: 'ping', timestamp: Date.now() });
        for (const [id, dc] of this.dataChannels) {
            if (dc.readyState === 'open') {
                try {
                    dc.send(msg);
                    if (!this.pingTimestamps.has(id)) {
                        this.pingTimestamps.set(id, Date.now());
                    }
                } catch (e) {
                    NET_WARN('ping send failed to', id, e);
                }
            }
        }
    }

    checkInputTimeout() {
        const now = Date.now();
        let statusChanged = false;

        for (const player of this.knownPlayers) {
            if (player.id === this.playerId) continue;

            const lastInput = this.lastInputReceived.get(player.id) || 0;
            const lastPing = this.pingTimestamps.get(player.id) || 0;
            const inputDelay = now - lastInput;
            const pingDelay = now - lastPing;

            let newStatus = 'connected';
            if (inputDelay > NETWORK_CONFIG.INPUT_TIMEOUT && this.gameStarted) {
                newStatus = 'input_timeout';
            } else if (pingDelay > NETWORK_CONFIG.PING_TIMEOUT) {
                newStatus = 'ping_timeout';
            }

            const oldStatus = this.connectionStatus.get(player.id) || 'unknown';
            if (newStatus !== oldStatus) {
                this.connectionStatus.set(player.id, newStatus);
                statusChanged = true;
                NET_LOG(`Connection status changed for player ${player.id}: ${oldStatus} -> ${newStatus}`);
            }
        }

        if (statusChanged && this.onNetworkStatus) {
            this.onNetworkStatus(this.getConnectionStatusSummary());
        }
    }

    getCurrentStunBatch() {
        const all = NETWORK_CONFIG.STUN_SERVERS;
        const start = this.currentStunStartIndex % all.length;
        const batch = [];
        for (let i = 0; i < NETWORK_CONFIG.STUN_BATCH_SIZE && i < all.length; i++) {
            batch.push(all[(start + i) % all.length]);
        }
        return batch;
    }

    rotateStunBatch() {
        this.currentStunStartIndex = (this.currentStunStartIndex + NETWORK_CONFIG.STUN_BATCH_SIZE) % NETWORK_CONFIG.STUN_SERVERS.length;
        NET_LOG('Rotated STUN batch, new start index:', this.currentStunStartIndex);
    }

    /**
     * 轮询信令服务器：
     * - 仅用于交换 WebRTC offer/answer/ICE 和玩家列表
     * - 不再用于转发游戏输入（输入走 DataChannel）
     * - 房主检测到新玩家后主动发起 connectToPlayer
     */
    async pollSignals() {
        if (!this.signalingUrl || !this.roomCode) return;
        // Prevent overlapping polls: setInterval can fire the next poll before
        // the previous async pollSignals resolves (especially when handleSignal
        // awaits setRemoteDescription / sendSignal). Overlapping polls would
        // re-fetch and re-process the same signals, causing duplicate offer
        // processing and ICE candidate races.
        if (this._polling) return;
        this._polling = true;
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
                            this.connectToPlayer(p.id).catch((e) => { NET_WARN('connectToPlayer failed', p.id, e); });
                        }
                    }
                }

                if (this.knownPlayers.length !== oldLen && this.onPlayerJoin) {
                    this.onPlayerJoin(this.knownPlayers);
                }
            }

            if (data.signals && data.signals.length > 0) {
                const mine = data.signals.filter(s => s.toId === this.playerId);
                if (mine.length > 0) {
                    NET_LOG('poll got', mine.length, 'signals:', mine.map(s => s.data.type).join(','));
                }
                // AWAIT each handleSignal so signals in the same poll batch are
                // processed sequentially. Without this, an 'ice' signal can be
                // processed concurrently with an 'offer'/'answer' signal, racing
                // on pc.remoteDescription and buffering candidates that never get
                // flushed.
                for (const sig of data.signals) {
                    if (sig.toId === this.playerId) {
                        await this.handleSignal(sig.fromId, sig.data);
                    }
                }
            }
        } catch (e) {
            NET_WARN('Poll error:', e);
        } finally {
            this._polling = false;
        }
    }

    async sendSignal(targetId, data) {
        if (!this.signalingUrl) return;
        // Chain this POST after any in-flight signal POST to the same target.
        // The server's sendSignal handler does a non-atomic read-modify-write
        // on room.signals (KV get -> push -> put). If two POSTs overlap, the
        // later write wins and the earlier signal is LOST. Losing an offer or
        // answer is fatal (the peer can never set remoteDescription). By
        // serializing per-target, we guarantee each write lands before the next
        // read, so no signal is ever dropped due to the race.
        const prev = this._signalQueue.get(targetId) || Promise.resolve();
        const task = prev.then(async () => {
            try {
                const res = await fetch(`${this.signalingUrl}/api/room/${this.roomCode}/signal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromId: this.playerId,
                        toId: targetId,
                        data,
                    }),
                });
                if (!res.ok) {
                    NET_WARN('sendSignal not ok:', res.status, 'type=', data.type);
                }
            } catch (e) {
                NET_WARN('Send signal error:', e);
            }
        });
        // Catch on the stored promise so a rejection doesn't break the chain.
        task.catch(() => {});
        this._signalQueue.set(targetId, task);
        return task;
    }

    /**
     * 创建到 targetId 的 RTCPeerConnection。
     * 房主作为 offer 方创建 DataChannel；非房主作为 answer 方，被动接收 DataChannel。
     */
    async connectToPlayer(playerId, useStunBatch = false) {
        if (this.connections.has(playerId)) return this.connections.get(playerId);

        const stunServers = useStunBatch ? this.getCurrentStunBatch() : NETWORK_CONFIG.STUN_SERVERS;
        NET_LOG('connectToPlayer', playerId, 'isHost=', this.isHost, 'stunCount=', stunServers.length);

        const pc = new RTCPeerConnection({
            iceServers: stunServers,
        });

        this.connections.set(playerId, pc);

        if (this.isHost) {
            const dc = pc.createDataChannel('game-input', {
                ordered: true,
            });
            this.setupDataChannel(dc, playerId);
        }

        pc.ondatachannel = (event) => {
            NET_LOG('ondatachannel from', playerId, 'label=', event.channel.label);
            this.setupDataChannel(event.channel, playerId);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.sendSignal(playerId, {
                    type: 'ice',
                    candidate: e.candidate,
                });
            } else {
                NET_LOG('ICE gathering complete for', playerId);
            }
        };

        pc.oniceconnectionstatechange = () => {
            NET_LOG('ICE state', playerId, '=', pc.iceConnectionState);
        };

        pc.onicegatheringstatechange = () => {
            NET_LOG('ICE gathering state', playerId, '=', pc.iceGatheringState);
        };

        pc.onconnectionstatechange = () => {
            NET_LOG('pc state', playerId, '=', pc.connectionState);
            if (pc.connectionState === 'failed' && !this.reconnectingPlayers.has(playerId)) {
                NET_WARN('Connection failed for player', playerId, ', attempting reconnect...');
                this.reconnectPlayer(playerId);
            }
        };

        if (this.isHost) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                // AWAIT: ensure the offer is persisted on the signaling server BEFORE
                // any ICE candidate POSTs fire (onicecandidate triggers after setLocalDescription).
                // Without this, concurrent sendSignal POSTs race on the server's
                // read-modify-write and the offer can be lost.
                await this.sendSignal(playerId, { type: 'offer', offer });
            } catch (e) {
                NET_WARN('createOffer failed', e);
            }
        }

        return pc;
    }

    async reconnectPlayer(playerId) {
        if (this.reconnectingPlayers.has(playerId)) return;
        this.reconnectingPlayers.add(playerId);

        NET_LOG('Reconnecting to player', playerId);

        const oldPc = this.connections.get(playerId);
        if (oldPc) {
            try { oldPc.close(); } catch (e) {}
        }
        this.connections.delete(playerId);
        this.dataChannels.delete(playerId);
        this.connectedPlayerIds.delete(playerId);
        this.iceCandidateBuffer.delete(playerId);
        this._signalQueue.delete(playerId);

        this.rotateStunBatch();

        setTimeout(async () => {
            try {
                const pc = await this.connectToPlayer(playerId, true);
                if (pc && this.handshakeStarted && !this.handshakeCompleted) {
                    this.startHandshakeForPlayer(playerId);
                }
            } catch (e) {
                NET_WARN('Reconnect failed for player', playerId, e);
            }
            this.reconnectingPlayers.delete(playerId);
        }, NETWORK_CONFIG.HANDSHAKE_RETRY_DELAY);
    }

    setupDataChannel(dc, playerId) {
        dc.onopen = () => {
            NET_LOG('DataChannel OPEN with player', playerId, 'readyState=', dc.readyState);
            this.dataChannels.set(playerId, dc);
            this.connectedPlayerIds.add(playerId);
            this.connectionStatus.set(playerId, 'connected');
            if (this.onPlayerJoin) {
                this.onPlayerJoin(this.knownPlayers);
            }
            if (this.handshakeStarted && !this.handshakeCompleted) {
                this.startHandshakeForPlayer(playerId);
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
        if (data.type === 'gamestart') {
            NET_LOG('received gamestart via signaling from', fromId);
            this.startGameRemote(data.seed, data.playerCount);
            return;
        }

        let pc = this.connections.get(fromId);
        if (!pc && !this.isHost) {
            pc = await this.connectToPlayer(fromId);
        }
        if (!pc) return;

        NET_LOG('handleSignal from', fromId, 'type=', data.type, 'hasRemoteDesc=', !!pc.remoteDescription);

        try {
            if (data.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                NET_LOG('offer: setRemoteDescription OK, hasRemoteDesc=', !!pc.remoteDescription);
                await this.flushIceCandidates(fromId, pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                // AWAIT: ensure the answer is persisted on the signaling server BEFORE
                // any ICE candidate POSTs fire. Without this, concurrent sendSignal POSTs
                // race on the server's read-modify-write and the answer can be lost,
                // leaving the offerer stuck with no remoteDescription forever.
                await this.sendSignal(fromId, { type: 'answer', answer });
                NET_LOG('offer: answer sent OK');
            } else if (data.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                NET_LOG('answer: setRemoteDescription OK');
                await this.flushIceCandidates(fromId, pc);
            } else if (data.type === 'ice') {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                    NET_LOG('Buffering ICE candidate for', fromId, 'remoteDescription not set yet');
                    if (!this.iceCandidateBuffer.has(fromId)) {
                        this.iceCandidateBuffer.set(fromId, []);
                    }
                    this.iceCandidateBuffer.get(fromId).push(data.candidate);
                }
            }
        } catch (e) {
            NET_WARN('Signal handling error:', e && (e.message || e));
        }
    }

    async flushIceCandidates(playerId, pc) {
        const buffered = this.iceCandidateBuffer.get(playerId);
        if (!buffered || buffered.length === 0) return;

        NET_LOG('Flushing', buffered.length, 'buffered ICE candidates for', playerId);
        for (const candidate of buffered) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                NET_WARN('Failed to add buffered ICE candidate for', playerId, e);
            }
        }
        this.iceCandidateBuffer.delete(playerId);
    }

    handleMessage(fromId, msg) {
        if (msg.type === 'ping') {
            this.pingTimestamps.set(fromId, Date.now());
            this.connectionStatus.set(fromId, 'connected');
            return;
        }

        if (msg.type === 'handshake_req') {
            NET_LOG('Received handshake request from', fromId);
            this.sendToPlayer(fromId, { type: 'handshake_ack', timestamp: Date.now() });
            return;
        }

        if (msg.type === 'handshake_ack') {
            NET_LOG('Received handshake ack from', fromId);
            this.pingTimestamps.set(fromId, Date.now());
            this.connectionStatus.set(fromId, 'connected');
            this.checkHandshakeComplete();
            return;
        }

        if (msg.type === 'handshake_complete') {
            NET_LOG('Received handshake complete from', fromId);
            this.checkHandshakeComplete();
            return;
        }

        if (msg.type === 'input' && this.frameSync) {
            this.lastInputReceived.set(msg.playerId, Date.now());
            this.connectionStatus.set(msg.playerId, 'connected');
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

    sendToPlayer(playerId, data) {
        const dc = this.dataChannels.get(playerId);
        if (!dc || dc.readyState !== 'open') return false;
        try {
            dc.send(JSON.stringify(data));
            return true;
        } catch (e) {
            NET_WARN('sendToPlayer failed', playerId, e);
            return false;
        }
    }

    startHandshake() {
        if (this.handshakeStarted) return;
        this.handshakeStarted = true;
        this.handshakeCompleted = false;
        this.handshakeRetries = 0;

        NET_LOG('Starting handshake, expected players:', this.maxPlayers - 1);

        for (const player of this.knownPlayers) {
            if (player.id === this.playerId) continue;
            this.startHandshakeForPlayer(player.id);
        }

        this.startHandshakeTimer();
    }

    startHandshakeForPlayer(playerId) {
        if (!this.dataChannels.has(playerId)) return;
        if (this.connectionStatus.get(playerId) === 'handshaken') return;

        NET_LOG('Sending handshake request to', playerId);
        this.sendToPlayer(playerId, { type: 'handshake_req', timestamp: Date.now() });
    }

    startHandshakeTimer() {
        if (this.handshakeTimer) clearTimeout(this.handshakeTimer);

        this.handshakeTimer = setTimeout(() => {
            if (this.handshakeCompleted) return;

            this.handshakeRetries++;
            NET_LOG('Handshake timeout, retry', this.handshakeRetries, '/', NETWORK_CONFIG.MAX_HANDSHAKE_RETRIES);

            if (this.handshakeRetries >= NETWORK_CONFIG.MAX_HANDSHAKE_RETRIES) {
                NET_WARN('Handshake failed after max retries');
                if (this.onHandshakeFailed) {
                    this.onHandshakeFailed('连接超时，正在尝试重新连接...');
                }
                this.rotateStunBatch();
                for (const player of this.knownPlayers) {
                    if (player.id === this.playerId) continue;
                    if (this.connectionStatus.get(player.id) !== 'handshaken') {
                        this.reconnectPlayer(player.id);
                    }
                }
                this.handshakeRetries = 0;
                this.startHandshakeTimer();
                return;
            }

            for (const player of this.knownPlayers) {
                if (player.id === this.playerId) continue;
                if (this.connectionStatus.get(player.id) !== 'handshaken') {
                    this.startHandshakeForPlayer(player.id);
                }
            }
            this.startHandshakeTimer();
        }, NETWORK_CONFIG.HANDSHAKE_TIMEOUT);
    }

    checkHandshakeComplete() {
        if (this.handshakeCompleted) return;

        let allReady = true;
        let readyCount = 0;
        const expected = this.maxPlayers - 1;

        for (const player of this.knownPlayers) {
            if (player.id === this.playerId) continue;
            const lastPing = this.pingTimestamps.get(player.id) || 0;
            const isConnected = this.connectedPlayerIds.has(player.id);
            const hasRecentPing = Date.now() - lastPing < NETWORK_CONFIG.HANDSHAKE_TIMEOUT;

            if (isConnected && hasRecentPing) {
                this.connectionStatus.set(player.id, 'handshaken');
                readyCount++;
            } else {
                allReady = false;
            }
        }

        NET_LOG('Handshake check:', readyCount, '/', expected, 'ready');

        if (allReady && readyCount >= expected) {
            this.handshakeCompleted = true;
            if (this.handshakeTimer) {
                clearTimeout(this.handshakeTimer);
                this.handshakeTimer = null;
            }
            NET_LOG('Handshake complete!');

            this.sendToAll({ type: 'handshake_complete' });
            this.finalizeGameStart();

            if (this.onHandshakeComplete) {
                this.onHandshakeComplete();
            }
        }
    }

    sendToAll(data) {
        const msg = JSON.stringify(data);
        for (const [id, dc] of this.dataChannels) {
            if (dc.readyState === 'open') {
                try { dc.send(msg); } catch (e) {}
            }
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
        this.pendingSeed = seed;
        this.pendingPlayerCount = this.maxPlayers;

        NET_LOG('startHostGame seed=', seed, 'maxPlayers=', this.maxPlayers,
            'dataChannels=', this.dataChannels.size, 'connected=', [...this.connectedPlayerIds]);

        this.broadcastGameStart(seed, this.maxPlayers);

        if (this.signalingUrl && this.roomCode) {
            for (const player of this.knownPlayers) {
                if (player.id !== this.playerId) {
                    this.sendSignal(player.id, { type: 'gamestart', seed, playerCount: this.maxPlayers }).catch(() => {});
                }
            }
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

        this.startHandshake();

        return { seed, playerCount: this.maxPlayers };
    }

    startGameRemote(seed, playerCount) {
        if (this.gameStartReceived) {
            NET_LOG('startGameRemote already received, ignoring duplicate');
            return;
        }
        this.gameStartReceived = true;
        NET_LOG('startGameRemote seed=', seed, 'playerCount=', playerCount);
        this.rng = new DeterministicRandom(seed);
        this.gameStarted = true;
        this.pendingSeed = seed;
        this.pendingPlayerCount = playerCount;

        this.startHandshake();

        if (this.onGameStart) {
            this.onGameStart(seed, playerCount);
        }
    }

    finalizeGameStart() {
        if (this.frameSync) return;

        const seed = this.pendingSeed;
        const playerCount = this.pendingPlayerCount;

        NET_LOG('finalizeGameStart seed=', seed, 'playerCount=', playerCount);

        this.frameSync = new FrameSync(null, playerCount, this.playerId);
        this.frameSync.start();
        this.startPing();

        if (this.onGameFinalStart) {
            this.onGameFinalStart(seed, playerCount);
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
