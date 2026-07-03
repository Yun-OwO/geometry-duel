const NETWORK_CONFIG = {
    SIGNALING_URL: window.location.origin,
    STUN_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ],
    INPUT_BUFFER_SIZE: 3,
    FRAME_DELAY: 3,
    POLL_INTERVAL: 100,
};

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

class FrameSync {
    constructor(game, playerCount, localPlayerId) {
        this.game = game;
        this.playerCount = playerCount;
        this.localPlayerId = localPlayerId;
        this.frame = 0;
        this.inputs = new Map();
        this.remoteFrames = new Map();
        this.running = false;
        this.pendingLocalInputs = [];
    }

    start() {
        this.running = true;
        this.frame = 0;
        this.inputs.clear();
        this.remoteFrames.clear();
    }

    stop() {
        this.running = false;
    }

    addLocalInput(input) {
        const delay = NETWORK_CONFIG.FRAME_DELAY;
        const frame = this.frame + delay;
        this.inputs.set(frame, { ...input, local: true });
        this.sendInput(frame, input);
        return frame;
    }

    sendInput(frame, input) {
        if (Network.signalingUrl && Network.roomCode) {
            Network.sendInputToServer(frame, this.localPlayerId, this.serializeInput(input));
        }
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
        if (this.frame < NETWORK_CONFIG.FRAME_DELAY) return false;
        const targetFrame = this.frame;
        if (!this.inputs.has(targetFrame)) return false;
        const frameInputs = this.remoteFrames.get(targetFrame);
        const expectedRemotes = this.playerCount - 1;
        if (expectedRemotes <= 0) return true;
        if (!frameInputs) return false;
        return frameInputs.size >= expectedRemotes;
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
        this.frameSync = null;
        this.rng = null;
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onGameStart = null;
        this.onRemoteInput = null;
        this.pollInterval = null;
        this.lastPollTime = 0;
        this.signalQueue = [];
        this.pollSince = 0;
        this.inputSince = 0;
        this.knownPlayers = [];
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
            this.maxPlayers = maxPlayers;
        }

        this.knownPlayers = [{ id: 0, name: '你', host: true }];
        this.startPolling();
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
            this.knownPlayers = data.players.map((p, i) => ({
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
        this.inputSince = 0;
        this.pollInterval = setInterval(() => this.pollSignals(), NETWORK_CONFIG.POLL_INTERVAL);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async pollSignals() {
        if (!this.signalingUrl) return;

        try {
            const res = await fetch(
                `${this.signalingUrl}/api/room/${this.roomCode}/poll?playerId=${this.playerId}&since=${this.pollSince}&inputSince=${this.inputSince || 0}`
            );
            if (!res.ok) return;
            const data = await res.json();

            if (data.since !== undefined) this.pollSince = data.since;
            if (data.inputSince !== undefined) this.inputSince = data.inputSince;

            if (data.players) {
                const oldLen = this.knownPlayers.length;
                this.knownPlayers = data.players.map(p => ({
                    ...p,
                    name: p.id === this.playerId ? '你' : p.name,
                }));
                if (this.knownPlayers.length !== oldLen && this.onPlayerJoin) {
                    this.onPlayerJoin(this.knownPlayers);
                }
            }

            // 检测游戏开始
            if (data.gameStarted && !this.isHost && !this.frameSync) {
                this.startGameRemote(data.seed, data.playerCount);
            }

            if (data.frameInputs && this.frameSync) {
                for (const [frameStr, inputs] of Object.entries(data.frameInputs)) {
                    const frame = parseInt(frameStr);
                    for (const [playerIdStr, inputData] of Object.entries(inputs)) {
                        const pid = parseInt(playerIdStr);
                        if (pid !== this.playerId) {
                            this.frameSync.receiveInput(frame, pid, inputData);
                        }
                    }
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
            console.warn('Poll error:', e);
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
            console.warn('Send signal error:', e);
        }
    }

    async sendInputToServer(frame, playerId, input) {
        if (!this.signalingUrl || !this.roomCode) return;
        try {
            await fetch(`${this.signalingUrl}/api/room/${this.roomCode}/input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frame, playerId, input }),
            });
        } catch (e) {
            console.warn('Send input error:', e);
        }
    }

    async connectToPlayer(playerId) {
        const pc = new RTCPeerConnection({
            iceServers: NETWORK_CONFIG.STUN_SERVERS,
        });

        const dc = pc.createDataChannel('game-input', {
            ordered: false,
            maxRetransmits: 0,
        });

        dc.onopen = () => {
            console.log('DataChannel open with player', playerId);
            this.dataChannels.set(playerId, dc);
        };

        dc.onmessage = (e) => {
            this.handleMessage(playerId, JSON.parse(e.data));
        };

        dc.onclose = () => {
            console.log('DataChannel closed with player', playerId);
            this.dataChannels.delete(playerId);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.sendSignal(playerId, {
                    type: 'ice',
                    candidate: e.candidate,
                });
            }
        };

        this.connections.set(playerId, pc);

        if (this.isHost) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.sendSignal(playerId, { type: 'offer', offer });
        }

        return pc;
    }

    async handleSignal(fromId, data) {
        // 通过信令服务器收到游戏开始信号
        if (data.type === 'gamestart') {
            this.startGameRemote(data.seed, data.playerCount);
            return;
        }

        let pc = this.connections.get(fromId);
        if (!pc && !this.isHost) {
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
            console.error('Signal handling error:', e);
        }
    }

    handleMessage(fromId, msg) {
        if (msg.type === 'input' && this.frameSync) {
            this.frameSync.receiveInput(msg.frame, msg.playerId, msg.input);
            if (this.onRemoteInput) {
                this.onRemoteInput(msg.frame, msg.playerId, msg.input);
            }
        } else if (msg.type === 'gamestart') {
            this.startGameRemote(msg.seed, msg.playerCount);
        }
    }

    broadcast(data) {
        const msg = JSON.stringify(data);
        for (const [id, dc] of this.dataChannels) {
            if (dc.readyState === 'open') {
                try {
                    dc.send(msg);
                } catch (e) {
                    console.warn('Send failed to', id, e);
                }
            }
        }
    }

    async startHostGame() {
        const seed = Math.floor(Math.random() * 1000000);
        this.rng = new DeterministicRandom(seed);
        this.frameSync = new FrameSync(null, this.maxPlayers, this.playerId);
        this.frameSync.start();

        // 通知服务器游戏开始
        if (this.signalingUrl && this.roomCode) {
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
                console.warn('Start game server call failed:', e);
            }
        }

        return { seed, playerCount: this.maxPlayers };
    }

    startGameRemote(seed, playerCount) {
        this.rng = new DeterministicRandom(seed);
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
    }
}

const Network = new NetworkManager();
