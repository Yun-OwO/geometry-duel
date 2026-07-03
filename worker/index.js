// Cloudflare Worker 信令服务器 + 静态资源服务
// 部署：wrangler deploy

const ROOM_TTL = 300; // 5分钟
const MAX_PLAYERS = 4;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
    let code = '';
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 6; i++) {
        code += CHARS[arr[i] % CHARS.length];
    }
    return code;
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(),
        },
    });
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(),
            });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        // API 路由
        if (path.startsWith('/api/')) {
            if (path === '/api/room/create' && request.method === 'POST') {
                return this.createRoom(request, env);
            }

            if (path.startsWith('/api/room/') && path.endsWith('/join') && request.method === 'POST') {
                const code = path.split('/')[3];
                return this.joinRoom(code, request, env);
            }

            if (path.startsWith('/api/room/') && path.endsWith('/signal') && request.method === 'POST') {
                const code = path.split('/')[3];
                return this.sendSignal(code, request, env);
            }

            if (path.startsWith('/api/room/') && path.endsWith('/input') && request.method === 'POST') {
                const code = path.split('/')[3];
                return this.sendInput(code, request, env);
            }

            if (path.startsWith('/api/room/') && path.endsWith('/start') && request.method === 'POST') {
                const code = path.split('/')[3];
                return this.startGame(code, request, env);
            }

            if (path.startsWith('/api/room/') && path.endsWith('/poll') && request.method === 'GET') {
                const code = path.split('/')[3];
                return this.pollSignals(code, request, env);
            }

            if (path.startsWith('/api/room/') && path.endsWith('/leave') && request.method === 'POST') {
                const code = path.split('/')[3];
                return this.leaveRoom(code, request, env);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        }

        // 静态资源由 ASSETS 绑定处理
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not found', { status: 404 });
    },

    async createRoom(request, env) {
        const body = await request.json().catch(() => ({}));
        const maxPlayers = Math.min(MAX_PLAYERS, Math.max(2, body.maxPlayers || 2));

        let code;
        let attempts = 0;
        while (attempts < 10) {
            code = generateRoomCode();
            const existing = await env.ROOM_KV.get(code);
            if (!existing) break;
            attempts++;
        }
        if (attempts >= 10) {
            return jsonResponse({ error: 'Failed to create room' }, 500);
        }

        const room = {
            code,
            maxPlayers,
            players: [{
                id: 0,
                name: '玩家1',
                host: true,
                connectedAt: Date.now(),
            }],
            signals: [],
            createdAt: Date.now(),
        };

        await env.ROOM_KV.put(code, JSON.stringify(room), { expirationTtl: ROOM_TTL });

        return jsonResponse({
            code,
            playerId: 0,
            maxPlayers,
        });
    },

    async joinRoom(code, request, env) {
        code = code.toUpperCase();
        const roomData = await env.ROOM_KV.get(code);
        if (!roomData) {
            return jsonResponse({ error: '房间不存在' }, 404);
        }

        const room = JSON.parse(roomData);
        if (room.players.length >= room.maxPlayers) {
            return jsonResponse({ error: '房间已满' }, 400);
        }

        const playerId = room.players.length;
        room.players.push({
            id: playerId,
            name: `玩家${playerId + 1}`,
            host: false,
            connectedAt: Date.now(),
        });

        await env.ROOM_KV.put(code, JSON.stringify(room), { expirationTtl: ROOM_TTL });

        return jsonResponse({
            playerId,
            maxPlayers: room.maxPlayers,
            players: room.players.map(p => ({ id: p.id, name: p.name, host: p.host })),
        });
    },

    async sendSignal(code, request, env) {
        code = code.toUpperCase();
        const body = await request.json().catch(() => ({}));
        const { fromId, toId, data } = body;

        if (fromId === undefined || toId === undefined || !data) {
            return jsonResponse({ error: 'Invalid signal' }, 400);
        }

        const roomData = await env.ROOM_KV.get(code);
        if (!roomData) {
            return jsonResponse({ error: '房间不存在' }, 404);
        }

        const room = JSON.parse(roomData);
        room.signals.push({
            fromId,
            toId,
            data,
            timestamp: Date.now(),
        });

        if (room.signals.length > 100) {
            room.signals = room.signals.slice(-50);
        }

        await env.ROOM_KV.put(code, JSON.stringify(room), { expirationTtl: ROOM_TTL });

        return jsonResponse({ ok: true });
    },

    async sendInput(code, request, env) {
        code = code.toUpperCase();
        const body = await request.json().catch(() => ({}));
        const { frame, playerId, input } = body;

        if (frame === undefined || playerId === undefined || !input) {
            return jsonResponse({ error: 'Invalid input' }, 400);
        }

        const roomData = await env.ROOM_KV.get(code);
        if (!roomData) {
            return jsonResponse({ error: '房间不存在' }, 404);
        }

        const room = JSON.parse(roomData);
        if (!room.frameInputs) room.frameInputs = {};
        if (!room.frameInputs[frame]) room.frameInputs[frame] = {};
        room.frameInputs[frame][playerId] = input;

        const frames = Object.keys(room.frameInputs).map(Number).sort((a, b) => a - b);
        if (frames.length > 200) {
            for (let i = 0; i < frames.length - 200; i++) {
                delete room.frameInputs[frames[i]];
            }
        }

        await env.ROOM_KV.put(code, JSON.stringify(room), { expirationTtl: ROOM_TTL });

        return jsonResponse({ ok: true });
    },

    async startGame(code, request, env) {
        code = code.toUpperCase();
        const body = await request.json().catch(() => ({}));
        const { seed, playerCount, playerId } = body;

        if (seed === undefined || playerCount === undefined) {
            return jsonResponse({ error: 'Invalid start data' }, 400);
        }

        const roomData = await env.ROOM_KV.get(code);
        if (!roomData) {
            return jsonResponse({ error: '房间不存在' }, 404);
        }

        const room = JSON.parse(roomData);
        room.gameStarted = true;
        room.seed = seed;
        room.playerCount = playerCount;
        room.startedAt = Date.now();

        await env.ROOM_KV.put(code, JSON.stringify(room), { expirationTtl: ROOM_TTL });

        return jsonResponse({ ok: true });
    },

    async pollSignals(code, request, env) {
        code = code.toUpperCase();
        const url = new URL(request.url);
        const playerId = parseInt(url.searchParams.get('playerId') || '0');
        const since = parseInt(url.searchParams.get('since') || '0');
        const inputSince = parseInt(url.searchParams.get('inputSince') || '0');

        const roomData = await env.ROOM_KV.get(code);
        if (!roomData) {
            return jsonResponse({ error: '房间不存在' }, 404);
        }

        const room = JSON.parse(roomData);

        const mySignals = room.signals.filter(
            s => s.toId === playerId && s.timestamp > since
        );

        const newSince = mySignals.length > 0
            ? Math.max(...mySignals.map(s => s.timestamp))
            : since;

        const frameInputs = {};
        let maxInputFrame = inputSince;
        if (room.frameInputs) {
            for (const [f, inputs] of Object.entries(room.frameInputs)) {
                const frameNum = parseInt(f);
                if (frameNum > inputSince) {
                    frameInputs[f] = inputs;
                    if (frameNum > maxInputFrame) maxInputFrame = frameNum;
                }
            }
        }

        return jsonResponse({
            signals: mySignals,
            since: newSince,
            players: room.players.map(p => ({ id: p.id, name: p.name, host: p.host })),
            frameInputs,
            inputSince: maxInputFrame,
            gameStarted: room.gameStarted || false,
            seed: room.seed,
            playerCount: room.playerCount,
        });
    },

    async leaveRoom(code, request, env) {
        code = code.toUpperCase();
        const body = await request.json().catch(() => ({}));
        const { playerId } = body;

        const roomData = await env.ROOM_KV.get(code);
        if (!roomData) {
            return jsonResponse({ ok: true });
        }

        const room = JSON.parse(roomData);
        room.players = room.players.filter(p => p.id !== playerId);

        if (room.players.length === 0) {
            await env.ROOM_KV.delete(code);
        } else {
            if (playerId === 0 && room.players.length > 0) {
                room.players[0].host = true;
            }
            await env.ROOM_KV.put(code, JSON.stringify(room), { expirationTtl: ROOM_TTL });
        }

        return jsonResponse({ ok: true });
    },
};
