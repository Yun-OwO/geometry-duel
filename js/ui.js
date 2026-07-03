class UI {
    constructor(game) {
        this.game = game;
        this.selectedPlayerCount = 3;
        this.selectedAICount = 3;
        this.selectedGameMode = 'normal';
        this.currentTab = 'create';
        this.initElements();
        this.initEvents();
        this.initNetworkCallbacks();
    }

    initElements() {
        this.startScreen = document.getElementById('start-screen');
        this.aiModeScreen = document.getElementById('ai-mode-screen');
        this.roomScreen = document.getElementById('room-screen');
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.roomStatus = document.getElementById('room-status');
        this.playerList = document.getElementById('player-list');
        this.lobbyRoomCode = document.getElementById('lobby-room-code');
        this.readyCount = document.getElementById('ready-count');
        this.maxCount = document.getElementById('max-count');
        this.startGameBtn = document.getElementById('start-game-btn');
    }

    initEvents() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playUISound();
                this.vibrate(10);
                const mode = btn.dataset.mode;
                if (mode === 'ai') {
                    this.showAIModeScreen();
                } else if (mode === 'online') {
                    this.showRoomScreen();
                }
            });
        });

        document.getElementById('back-to-start-from-ai').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(10);
            this.showStartScreen();
        });

        document.getElementById('back-to-start').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(10);
            this.showStartScreen();
        });

        document.querySelectorAll('.ai-count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playUISound();
                this.vibrate(10);
                this.setAICount(parseInt(btn.dataset.count));
            });
        });

        document.querySelectorAll('.game-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playUISound();
                this.vibrate(10);
                this.setGameMode(btn.dataset.mode);
            });
        });

        document.getElementById('start-ai-btn').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(20);
            this.startAIGame();
        });

        document.getElementById('reset-ai-genes-btn').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(10);
            this.game.resetAIGenes();
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playUISound();
                this.vibrate(10);
                this.switchTab(btn.dataset.tab);
            });
        });

        document.querySelectorAll('#tab-create .count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playUISound();
                this.vibrate(10);
                this.setPlayerCount(parseInt(btn.dataset.count));
            });
        });

        document.getElementById('create-room-btn').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(20);
            this.createRoom();
        });

        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(20);
            this.joinRoom();
        });

        document.getElementById('copy-room-code').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(10);
            this.copyRoomCode();
        });

        document.getElementById('leave-room-btn').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(10);
            this.leaveRoom();
        });

        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.playUISound();
            this.vibrate(20);
            this.startOnlineGame();
        });
    }

    playUISound() {
        if (this.game && this.game.playSound) {
            this.game.playSound('lCharge');
        }
    }

    vibrate(duration) {
        if (navigator.vibrate) {
            try { navigator.vibrate(duration); } catch (e) {}
        }
    }

    initNetworkCallbacks() {
        Network.onPlayerJoin = (players) => {
            this.updatePlayerList(players);
        };

        Network.onGameStart = (seed, playerCount) => {
            this.lobbyScreen.classList.add('hidden');
            this.game.gameMode = 'online';
            this.game.onlinePlayerCount = playerCount;
            this.game.initEntities(playerCount);
            Network.frameSync.game = this.game;
            this.game.demoMode = false;
            this.game.state = GameState.PLAYING;
            this.game.resetGame();
        };
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
        this.aiModeScreen.classList.add('hidden');
        this.roomScreen.classList.add('hidden');
        this.lobbyScreen.classList.add('hidden');
        this.game.demoMode = true;
        this.game.state = GameState.MENU;
    }

    showAIModeScreen() {
        this.startScreen.classList.add('hidden');
        this.aiModeScreen.classList.remove('hidden');
        this.roomScreen.classList.add('hidden');
        this.lobbyScreen.classList.add('hidden');
    }

    showRoomScreen() {
        this.startScreen.classList.add('hidden');
        this.aiModeScreen.classList.add('hidden');
        this.roomScreen.classList.remove('hidden');
        this.lobbyScreen.classList.add('hidden');
        this.roomStatus.textContent = '';
        this.roomStatus.className = 'room-status';
    }

    showLobbyScreen() {
        this.startScreen.classList.add('hidden');
        this.aiModeScreen.classList.add('hidden');
        this.roomScreen.classList.add('hidden');
        this.lobbyScreen.classList.remove('hidden');
    }

    setAICount(count) {
        this.selectedAICount = count;
        document.querySelectorAll('.ai-count-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.count) === count);
        });
    }

    setGameMode(mode) {
        this.selectedGameMode = mode;
        document.querySelectorAll('.game-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    startAIGame() {
        this.aiModeScreen.classList.add('hidden');
        this.game.gameMode = 'ai';
        this.game.aiPlayerCount = this.selectedAICount;
        this.game.endlessMode = (this.selectedGameMode === 'endless');
        this.game.startGame();
    }

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== 'tab-' + tab);
        });
        this.roomStatus.textContent = '';
        this.roomStatus.className = 'room-status';
    }

    setPlayerCount(count) {
        this.selectedPlayerCount = count;
        document.querySelectorAll('#tab-create .count-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.count) === count);
        });
    }

    setStatus(text, type = '') {
        this.roomStatus.textContent = text;
        this.roomStatus.className = 'room-status' + (type ? ' ' + type : '');
    }

    async createRoom() {
        this.setStatus('正在创建房间...');
        try {
            const roomCode = await Network.createRoom(this.selectedPlayerCount);
            this.lobbyRoomCode.textContent = roomCode;
            this.maxCount.textContent = this.selectedPlayerCount;
            this.showLobbyScreen();
            this.updatePlayerList(Network.knownPlayers);
            this.setStatus('');
        } catch (e) {
            this.setStatus('创建失败: ' + e.message, 'error');
        }
    }

    async joinRoom() {
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();
        if (code.length !== 6) {
            this.setStatus('请输入6位房间号', 'error');
            return;
        }
        this.setStatus('正在加入房间...');
        try {
            const result = await Network.joinRoom(code);
            this.lobbyRoomCode.textContent = code;
            this.maxCount.textContent = result.maxPlayers;
            this.showLobbyScreen();
            this.updatePlayerList(result.players);
            this.setStatus('');
        } catch (e) {
            this.setStatus('加入失败: ' + e.message, 'error');
        }
    }

    copyRoomCode() {
        const code = this.lobbyRoomCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copy-room-code');
            btn.textContent = '已复制';
            setTimeout(() => { btn.textContent = '复制'; }, 1500);
        });
    }

    leaveRoom() {
        Network.leaveRoom();
        this.showRoomScreen();
    }

    updatePlayerList(players) {
        const maxPlayers = parseInt(this.maxCount.textContent);
        let html = '';
        for (let i = 0; i < maxPlayers; i++) {
            const player = players[i];
            if (player) {
                html += `
                    <div class="player-slot filled ${player.host ? 'host' : ''}">
                        <div class="player-slot-icon">${i + 1}</div>
                        <div class="player-slot-name">${player.name}</div>
                        <div class="player-slot-status">${player.host ? '房主' : '已加入'}</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="player-slot player-slot-empty">
                        <div class="player-slot-icon">${i + 1}</div>
                        <div class="player-slot-name">等待加入...</div>
                        <div class="player-slot-status"></div>
                    </div>
                `;
            }
        }
        this.playerList.innerHTML = html;
        this.readyCount.textContent = players.length;

        const isHost = Network.isHost;
        if (isHost && players.length >= 2) {
            this.startGameBtn.classList.remove('disabled');
            this.startGameBtn.textContent = '开始游戏';
        } else if (isHost) {
            this.startGameBtn.classList.add('disabled');
            this.startGameBtn.textContent = '等待更多玩家';
        } else {
            this.startGameBtn.classList.add('disabled');
            this.startGameBtn.textContent = '等待房主开始';
        }
    }

    async startOnlineGame() {
        if (!Network.isHost) return;
        this.lobbyScreen.classList.add('hidden');
        this.game.gameMode = 'online';
        await this.game.startGame();
    }
}

let ui;
window.initUI = () => {
    ui = new UI(game);
};
