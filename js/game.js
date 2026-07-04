class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = GameState.MENU;
        this.frameCount = 0;
        this.screenShake = 0;
        this.demoMode = true;
        this.deathAnimationPending = false;
        this.deathAnimationTime = 0;
        this.deathKillerOwner = null;
        this.gameMode = 'ai';
        this.onlinePlayerCount = 2;
        this.aiPlayerCount = 3;
        this.rng = null;

        this.endlessMode = false;
        this.endlessRound = 0;
        this.endlessWins = 0;
        this.aiGenes = this.loadAIGenes();

        // 天赋树查看器状态
        this.talentTreeView = false;
        this.talentTreeBranch = 'attack';
        this.talentChart = null;

        this.setupCanvas();
        this.initInput();
        this.initAudio();
        this.initEntities();

        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.start();
    }

    loadAIGenes() {
        const CURRENT_GENE_VERSION = 4;
        try {
            const saved = localStorage.getItem('geometryDuelAIGenes');
            if (saved) {
                const data = JSON.parse(saved);
                if (!data.geneVersion || data.geneVersion !== CURRENT_GENE_VERSION) {
                    return this._createDefaultGenes();
                }
                if (!Array.isArray(data.unlockedGenes)) {
                    data.unlockedGenes = [];
                }
                const genes = { ...AIGeneDefaults };
                for (const key in AIGeneDefaults) {
                    genes[key] = data.genes && data.genes[key] !== undefined ? data.genes[key] : AIGeneDefaults[key];
                }
                const wins = data.wins || 0;
                let maxUnlockedStage = 0;
                for (let s = 3; s >= 0; s--) {
                    if (wins >= AIGeneTree.stages[s].unlockWins) {
                        maxUnlockedStage = s;
                        break;
                    }
                }
                return {
                    genes: genes,
                    generation: data.generation || 0,
                    wins: wins,
                    lastMutations: data.lastMutations || [],
                    unlockedGenes: data.unlockedGenes,
                    currentPaths: data.currentPaths || this._getDefaultPaths(),
                    maxUnlockedStage: maxUnlockedStage,
                    geneVersion: CURRENT_GENE_VERSION,
                };
            }
        } catch (e) {}
        return this._createDefaultGenes();
    }

    _getDefaultPaths() {
        return {
            attack: null,
            movement: null,
            defense: null,
            ultimate: null,
            special: null,
        };
    }

    _createDefaultGenes() {
        return {
            genes: { ...AIGeneDefaults },
            generation: 0,
            wins: 0,
            lastMutations: [],
            unlockedGenes: [],
            currentPaths: this._getDefaultPaths(),
            maxUnlockedStage: 0,
            geneVersion: 4,
        };
    }

    saveAIGenes() {
        try {
            localStorage.setItem('geometryDuelAIGenes', JSON.stringify(this.aiGenes));
        } catch (e) {}
    }

    mutateValueGene(value, range) {
        const isBeneficial = Math.random() < AIMutationConfig.beneficialChance;
        const strength = isBeneficial ? AIMutationConfig.mutationStrength : AIMutationConfig.harmfulStrength;
        const direction = isBeneficial ? 1 : -1;
        const mutation = (Math.random() * strength) * direction;
        let newValue = value + mutation;
        newValue = Math.max(range.min, Math.min(range.max, newValue));
        return { value: newValue, beneficial: isBeneficial };
    }

    mutateTypeGene(currentValue, geneName) {
        const alleles = AIAlleles[geneName];
        if (!alleles || alleles.length <= 1) return { value: currentValue, beneficial: false };
        const otherAlleles = alleles.filter(a => a !== currentValue);
        const newValue = otherAlleles[Math.floor(Math.random() * otherAlleles.length)];
        const isBeneficial = Math.random() < AIMutationConfig.beneficialChance;
        return { value: newValue, beneficial: isBeneficial };
    }

    evolveAI(aiLost) {
        const wins = aiLost ? this.aiGenes.wins : this.aiGenes.wins + 1;

        let maxStage = 0;
        for (let s = 3; s >= 0; s--) {
            if (wins >= AIGeneTree.stages[s].unlockWins) {
                maxStage = s;
                break;
            }
        }

        const branches = ['attack', 'movement', 'defense', 'ultimate', 'special'];
        const unlockedSet = new Set(this.aiGenes.unlockedGenes);
        const lastMutations = [];

        for (const branch of branches) {
            let currentNodeId = this.aiGenes.currentPaths[branch];

            if (!currentNodeId) {
                const rootNodes = getGeneNodesByBranchAndStage(branch, 0);
                if (rootNodes.length > 0) {
                    const root = rootNodes[0];
                    unlockedSet.add(root.id);
                    this.aiGenes.currentPaths[branch] = root.id;
                    this._applyGeneEffect(root);
                    lastMutations.push({
                        gene: root.id,
                        type: 'gene',
                        beneficial: true,
                        newValue: root.name,
                        branch: branch,
                    });
                    currentNodeId = root.id;
                }
            }

            if (currentNodeId) {
                const currentNode = AIGeneTree.nodes[currentNodeId];
                if (currentNode && currentNode.stage < maxStage) {
                    const children = getGeneChildren(currentNodeId);
                    if (children.length > 0) {
                        const chosen = children[Math.floor(Math.random() * children.length)];
                        if (!unlockedSet.has(chosen.id)) {
                            unlockedSet.add(chosen.id);
                            this.aiGenes.currentPaths[branch] = chosen.id;
                            this._applyGeneEffect(chosen);
                            lastMutations.push({
                                gene: chosen.id,
                                type: 'gene',
                                beneficial: true,
                                newValue: chosen.name,
                                branch: branch,
                            });
                        } else {
                            this.aiGenes.currentPaths[branch] = chosen.id;
                        }
                    }
                }
            }

            if (aiLost && currentNodeId) {
                const currentNode = AIGeneTree.nodes[currentNodeId];
                if (currentNode && currentNode.stage > 0 && Math.random() < 0.4) {
                    const siblings = getSiblingNodes(branch, currentNode.stage, currentNodeId);
                    if (siblings.length > 0) {
                        const newNode = siblings[Math.floor(Math.random() * siblings.length)];
                        if (!unlockedSet.has(newNode.id)) {
                            unlockedSet.add(newNode.id);
                            this._applyGeneEffect(newNode);
                        }
                        this.aiGenes.currentPaths[branch] = newNode.id;
                        lastMutations.push({
                            gene: newNode.id,
                            type: 'mutation',
                            beneficial: true,
                            newValue: newNode.name,
                            branch: branch,
                        });
                    }
                }
            }
        }

        this.aiGenes.unlockedGenes = Array.from(unlockedSet);
        this.aiGenes.generation++;
        this.aiGenes.wins = wins;
        this.aiGenes.maxUnlockedStage = maxStage;
        this.aiGenes.lastMutations = lastMutations;
        this.saveAIGenes();
    }

    _applyGeneEffect(node) {
        if (!node || !node.effect) return;
        const effect = node.effect;
        if (effect.type === 'stat' && effect.key && effect.value !== undefined) {
            this.aiGenes.genes[effect.key] = effect.value;
        }
        if (effect.type === 'style' && effect.key && effect.value !== undefined) {
            this.aiGenes.genes[effect.key] = effect.value;
        }
    }

    resetAIGenes() {
        this.aiGenes = this._createDefaultGenes();
        this.saveAIGenes();
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.dpr = dpr;
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = this.dpr;

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        const ratio = w / h;
        const baseSize = CONFIG.LOGICAL_SIZE;

        if (ratio > 1) {
            this.viewW = baseSize * ratio;
            this.viewH = baseSize;
        } else {
            this.viewW = baseSize;
            this.viewH = baseSize / ratio;
        }

        this.screenW = w;
        this.screenH = h;

        if (this.talentChart) {
            this.talentChart.resize();
        }
    }

    initTalentTreeChart() {
        if (this.talentChart) return;

        const chartDom = document.getElementById('talent-tree-chart');
        this.talentChart = echarts.init(chartDom);

        this.talentChart.on('mouseover', (params) => {
            if (params.dataType === 'node' && params.data.id && !params.data.id.startsWith('_stage_bg_')) {
                const rect = chartDom.getBoundingClientRect();
                this._showTalentTooltip(params.data.id, rect.left + params.event.offsetX, rect.top + params.event.offsetY);
            }
        });

        this.talentChart.on('mouseout', (params) => {
            if (params.dataType === 'node') {
                this._hideTalentTooltip();
            }
        });

        this.talentChart.on('click', (params) => {
            if (params.dataType === 'node' && params.data.id) {
                this._showGeneDetail(params.data.id);
                this.playSound('lCharge');
                this.vibrate(10);
            }
        });

        const closeBtn = document.getElementById('gene-detail-close');
        if (closeBtn && !closeBtn._hasListener) {
            closeBtn._hasListener = true;
            closeBtn.addEventListener('click', () => {
                this._hideGeneDetail();
                this.playSound('lCharge');
                this.vibrate(8);
            });
        }

        const backBtn = document.getElementById('talent-tree-back');
        if (backBtn && !backBtn._hasListener) {
            backBtn._hasListener = true;
            backBtn.addEventListener('click', () => {
                this.hideTalentTree();
                this.playSound('lCharge');
                this.vibrate(15);
            });
        }

        const tabs = document.querySelectorAll('.talent-tab');
        tabs.forEach((tab) => {
            if (!tab._hasListener) {
                tab._hasListener = true;
                tab.addEventListener('click', () => {
                    const branch = tab.getAttribute('data-branch');
                    this.switchTalentBranch(branch);
                    this.vibrate(8);
                });
            }
        });
    }

    showTalentTree() {
        const screen = document.getElementById('talent-tree-screen');
        screen.classList.remove('hidden');
        this.talentTreeView = true;

        this.initTalentTreeChart();
        this.switchTalentBranch(this.talentTreeBranch);
    }

    hideTalentTree() {
        const screen = document.getElementById('talent-tree-screen');
        screen.classList.add('hidden');
        this._hideTalentTooltip();
        this._hideGeneDetail();
        this.talentTreeView = false;
    }

    switchTalentBranch(branch) {
        this.talentTreeBranch = branch;
        this._hideGeneDetail();

        const tabs = document.querySelectorAll('.talent-tab');
        tabs.forEach((tab) => {
            if (tab.getAttribute('data-branch') === branch) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        if (this.talentChart) {
            const chartDom = document.getElementById('talent-tree-chart');
            const rect = chartDom.getBoundingClientRect();
            const option = this._buildTalentTreeOption(branch, rect.width, rect.height);
            this.talentChart.setOption(option, true);
        }
    }

    _buildTalentTreeOption(branch, viewW, viewH) {
        const branchNodes = getGeneNodesByBranch(branch);
        const unlockedSet = new Set(this.aiGenes.unlockedGenes || []);
        const currentPathId = this.aiGenes.currentPaths ? this.aiGenes.currentPaths[branch] : null;
        const lastMutations = this.aiGenes.lastMutations || [];
        const newlyUnlockedSet = new Set(lastMutations.map(m => m.gene));
        const branchColor = AIGeneTree.branches[branch].color;

        const stageColors = [
            this._adjustColor(branchColor, -20),
            this._adjustColor(branchColor, -5),
            this._adjustColor(branchColor, 15),
            this._adjustColor(branchColor, 35),
        ];

        const isOnCurrentPath = (nodeId) => {
            if (!currentPathId) return false;
            if (nodeId === currentPathId) return true;
            let current = AIGeneTree.nodes[currentPathId];
            while (current && current.stage > 0) {
                const prereqs = current.prerequisites || [];
                if (prereqs.includes(nodeId)) return true;
                const parent = prereqs.length > 0 ? AIGeneTree.nodes[prereqs[0]] : null;
                current = parent;
            }
            return false;
        };

        const buildTreeNode = (nodeId) => {
            const node = AIGeneTree.nodes[nodeId];
            if (!node) return null;

            const isUnlocked = unlockedSet.has(nodeId);
            const isCurrentPath = nodeId === currentPathId;
            const isNew = newlyUnlockedSet.has(nodeId);
            const onPath = isOnCurrentPath(nodeId);
            const stageColor = stageColors[node.stage];

            let symbolSize = 34;
            let itemStyle;
            let labelStyle = {};

            if (isCurrentPath) {
                symbolSize = 48;
                itemStyle = {
                    color: {
                        type: 'radial',
                        x: 0.5,
                        y: 0.5,
                        r: 0.5,
                        colorStops: [
                            { offset: 0, color: '#fff' },
                            { offset: 0.3, color: stageColor },
                            { offset: 1, color: this._adjustColor(stageColor, -20) }
                        ]
                    },
                    borderColor: '#fff',
                    borderWidth: 3,
                    shadowBlur: 28,
                    shadowColor: stageColor,
                };
                labelStyle = {
                    fontWeight: 'bold',
                    fontSize: 13,
                    color: '#fff',
                    textBorderColor: stageColor,
                    textBorderWidth: 2,
                };
            } else if (isUnlocked) {
                symbolSize = onPath ? 40 : 36;
                itemStyle = {
                    color: {
                        type: 'radial',
                        x: 0.5,
                        y: 0.5,
                        r: 0.5,
                        colorStops: [
                            { offset: 0, color: this._adjustColor(stageColor, 30) },
                            { offset: 1, color: stageColor }
                        ]
                    },
                    borderColor: 'rgba(255,255,255,0.8)',
                    borderWidth: onPath ? 2.5 : 2,
                    shadowBlur: onPath ? 16 : 10,
                    shadowColor: stageColor,
                };
                labelStyle = {
                    fontWeight: onPath ? '600' : 'normal',
                    color: '#fff',
                };
            } else {
                itemStyle = {
                    color: 'rgba(15, 15, 30, 0.7)',
                    borderColor: 'rgba(90, 90, 110, 0.5)',
                    borderWidth: 1.5,
                };
                labelStyle = {
                    color: 'rgba(130, 130, 150, 0.7)',
                };
            }

            if (isNew && isUnlocked) {
                itemStyle.shadowBlur = (itemStyle.shadowBlur || 10) + 12;
                itemStyle.borderColor = '#fff';
                itemStyle.borderWidth = 3;
            }

            const children = getGeneChildren(nodeId);
            const childNodes = children.map(c => buildTreeNode(c.id)).filter(c => c !== null);

            childNodes.forEach(child => {
                const childNode = AIGeneTree.nodes[child.id];
                const childUnlocked = unlockedSet.has(child.id);
                const childOnPath = isOnCurrentPath(child.id);
                if (childUnlocked && onPath) {
                    child.lineStyle = {
                        color: branchColor,
                        opacity: childOnPath ? 0.9 : 0.6,
                        width: childOnPath ? 3 : 2,
                        shadowBlur: childOnPath ? 8 : 4,
                        shadowColor: branchColor,
                    };
                }
            });

            return {
                id: node.id,
                name: isNew && isUnlocked ? '✦ ' + node.name : node.name,
                value: node.stage,
                symbolSize: symbolSize,
                itemStyle: itemStyle,
                label: {
                    show: true,
                    position: 'bottom',
                    fontSize: 11,
                    distance: 8,
                    ...labelStyle,
                },
                children: childNodes,
            };
        };

        const rootNodes = getGeneNodesByBranchAndStage(branch, 0);
        const treeData = rootNodes.length > 0 ? [buildTreeNode(rootNodes[0].id)] : [];

        return {
            backgroundColor: 'rgba(10, 10, 22, 0.97)',
            tooltip: { show: false },
            animationDuration: 600,
            animationEasingUpdate: 'quinticInOut',
            series: [{
                type: 'tree',
                data: treeData,
                orient: 'TB',
                roam: true,
                scaleLimit: { min: 1, max: 1.5 },
                initialTreeDepth: 3,
                symbol: 'circle',
                symbolSize: 34,
                edgeShape: 'curve',
                edgeForkPosition: '63%',
                lineStyle: {
                    color: branchColor,
                    opacity: 0.3,
                    width: 1.5,
                    curveness: 0.5,
                },
                emphasis: {
                    focus: 'descendant',
                    itemStyle: {
                        shadowBlur: 20,
                    },
                },
                leaves: {
                    label: {
                        position: 'bottom',
                    },
                },
                expandAndCollapse: false,
                animationDuration: 550,
                animationDurationUpdate: 750,
            }]
        };
    }

    _adjustColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        let r = (num >> 16) + amount;
        let g = ((num >> 8) & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    _showTalentTooltip(nodeId, x, y) {
        const node = AIGeneTree.nodes[nodeId];
        if (!node) return;

        const tooltip = document.getElementById('talent-tooltip');
        const container = document.querySelector('.talent-tree-container');
        const containerRect = container.getBoundingClientRect();
        const unlockedSet = new Set(this.aiGenes.unlockedGenes || []);
        const currentPathId = this.aiGenes.currentPaths ? this.aiGenes.currentPaths[node.branch] : null;

        const isUnlocked = unlockedSet.has(nodeId);
        const isCurrentPath = nodeId === currentPathId;
        const branchColor = AIGeneTree.branches[node.branch].color;

        tooltip.querySelector('.tooltip-title').textContent = node.name;
        tooltip.querySelector('.tooltip-title').style.color = isCurrentPath ? branchColor : (isUnlocked ? branchColor : '#888');
        tooltip.querySelector('.tooltip-stage').textContent = `阶段${node.stage} · ${AIGeneTree.stages[node.stage].name}`;

        const statusEl = tooltip.querySelector('.tooltip-status');
        if (isCurrentPath) {
            statusEl.textContent = '◆ 当前路径';
            statusEl.style.color = branchColor;
        } else if (isUnlocked) {
            statusEl.textContent = '● 已解锁';
            statusEl.style.color = branchColor;
        } else {
            statusEl.textContent = '◌ 未激活';
            statusEl.style.color = '#666';
        }

        tooltip.querySelector('.tooltip-desc').textContent = node.desc;

        const prereqEl = tooltip.querySelector('.tooltip-prereq');
        if (node.prerequisites && node.prerequisites.length > 0) {
            const prereqNames = node.prerequisites.map(preId => {
                const preNode = AIGeneTree.nodes[preId];
                return preNode ? preNode.name : preId;
            });
            prereqEl.textContent = '前置: ' + prereqNames.join(', ');
            prereqEl.style.display = 'block';
        } else {
            prereqEl.style.display = 'none';
        }

        tooltip.classList.remove('hidden');
        const tooltipRect = tooltip.getBoundingClientRect();

        let left = x - containerRect.left + 15;
        let top = y - containerRect.top + 15;

        if (left + tooltipRect.width > containerRect.width - 10) {
            left = x - containerRect.left - tooltipRect.width - 15;
        }
        if (top + tooltipRect.height > containerRect.height - 10) {
            top = y - containerRect.top - tooltipRect.height - 15;
        }

        if (left < 5) left = 5;
        if (top < 5) top = 5;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    _hideTalentTooltip() {
        const tooltip = document.getElementById('talent-tooltip');
        if (tooltip) {
            tooltip.classList.add('hidden');
        }
    }

    _showGeneDetail(nodeId) {
        const node = AIGeneTree.nodes[nodeId];
        if (!node) return;

        const panel = document.getElementById('gene-detail-panel');
        const unlockedSet = new Set(this.aiGenes.unlockedGenes || []);
        const currentPathId = this.aiGenes.currentPaths ? this.aiGenes.currentPaths[node.branch] : null;
        const branchColor = AIGeneTree.branches[node.branch].color;
        const branchName = AIGeneTree.branches[node.branch].name;

        const isUnlocked = unlockedSet.has(nodeId);
        const isCurrentPath = nodeId === currentPathId;

        panel.querySelector('.gene-detail-name').textContent = node.name;
        panel.querySelector('.gene-detail-name').style.color = isUnlocked ? branchColor : '#888';
        panel.querySelector('.gene-detail-branch').textContent = `分类：${branchName}`;
        panel.querySelector('.gene-detail-stage').textContent = `阶段 ${node.stage} · ${AIGeneTree.stages[node.stage].name}`;

        const statusEl = panel.querySelector('.gene-detail-status');
        if (isCurrentPath) {
            statusEl.textContent = '◆ 当前进化路径';
            statusEl.style.color = branchColor;
            statusEl.style.background = branchColor + '20';
        } else if (isUnlocked) {
            statusEl.textContent = '● 已激活';
            statusEl.style.color = branchColor;
            statusEl.style.background = branchColor + '15';
        } else {
            statusEl.textContent = '◌ 未激活';
            statusEl.style.color = '#666';
            statusEl.style.background = 'rgba(255,255,255,0.05)';
        }

        panel.querySelector('.gene-detail-desc').textContent = node.desc;

        const effectEl = panel.querySelector('.gene-detail-effect');
        if (node.effect) {
            let effectText = '';
            if (node.effect.type === 'stat') {
                const effectNames = {
                    aimAccuracy: '瞄准精度',
                    reactionSpeed: '反应速度',
                    ultimateAggressiveness: '大招倾向',
                    evasionAbility: '闪避能力',
                    moveSpeed: '移动速度',
                    bulletSpeed: '子弹速度',
                    fireRate: '射速',
                    damage: '伤害',
                    defense: '防御',
                    maxHp: '最大生命',
                    level: 'AI等级',
                };
                const name = effectNames[node.effect.key] || node.effect.key;
                if (typeof node.effect.value === 'number') {
                    if (node.effect.value >= 0 && node.effect.value <= 2) {
                        effectText = `${name}: ${(node.effect.value * 100).toFixed(0)}%`;
                    } else {
                        effectText = `${name}: ${node.effect.value}`;
                    }
                } else {
                    effectText = `${name}: ${node.effect.value}`;
                }
            } else if (node.effect.type === 'ability') {
                effectText = `特殊能力：${node.effect.name || node.effect.key}`;
            } else if (node.effect.type === 'style') {
                const styleNames = {
                    aggressive: '激进型',
                    defensive: '防守型',
                    balanced: '均衡型',
                    trickster: '战术型',
                };
                effectText = `战斗风格：${styleNames[node.effect.value] || node.effect.value}`;
            } else {
                effectText = node.desc;
            }
            effectEl.textContent = effectText;
            effectEl.style.display = 'block';
            panel.querySelector('.gene-detail-effect-title').style.display = 'block';
        } else {
            effectEl.style.display = 'none';
            panel.querySelector('.gene-detail-effect-title').style.display = 'none';
        }

        const prereqEl = panel.querySelector('.gene-detail-prereq');
        if (node.prerequisites && node.prerequisites.length > 0) {
            const prereqNames = node.prerequisites.map(preId => {
                const preNode = AIGeneTree.nodes[preId];
                return preNode ? preNode.name : preId;
            });
            prereqEl.textContent = '前置基因：' + prereqNames.join('、');
            prereqEl.style.display = 'block';
        } else {
            prereqEl.style.display = 'none';
        }

        panel.classList.remove('hidden');
    }

    _hideGeneDetail() {
        const panel = document.getElementById('gene-detail-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    initInput() {
        this.keys = {};
        this.mouseDown = false;
        this.mouseZPressed = false;
        this.mouseXPressed = false;
        this.touchInput = {
            moveX: 0,
            moveY: 0,
            zPressed: false,
            xPressed: false,
            pauseTouched: false,
        };
        this.touchState = {
            joystickId: -1,
            zId: -1,
            xId: -1,
            pauseId: -1,
            restartId: -1,
        };

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyP' && !e.repeat) this.togglePause();
            if (e.code === 'Escape' && !e.repeat) {
                if (this.state === GameState.PAUSED) {
                    this.returnToMenu();
                } else if (this.state === GameState.PLAYING) {
                    this.togglePause();
                }
            }
            if (e.code === 'KeyZ' && this.state === GameState.MENU) this.startGame();
            if (e.code === 'KeyR' && this.state === GameState.GAME_OVER) this.startGame();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e.changedTouches);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouchMove(e.changedTouches);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e.changedTouches);
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e.changedTouches);
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (this.isMobileDevice()) return;
            if (this.state === GameState.PLAYING) {
                if (e.button === 0) {
                    this.mouseZPressed = true;
                } else if (e.button === 2) {
                    this.mouseXPressed = true;
                }
                return;
            }
            this.handleMouseClick(e);
        }, { passive: false });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isMobileDevice()) return;
            if (this.mouseDown) {
                this.handleMouseMove(e);
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isMobileDevice()) return;
            if (e.button === 0) this.mouseZPressed = false;
            if (e.button === 2) this.mouseXPressed = false;
            this.mouseDown = false;
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && window.innerWidth < 800);
    }

    handleMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.mouseDown = true;

        const touches = [{ clientX: e.clientX, clientY: e.clientY, identifier: 0 }];
        this.handleTouchStart(touches);
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const touches = [{ clientX: e.clientX, clientY: e.clientY, identifier: 0 }];
        this.handleTouchMove(touches);
    }

    getButtonRadius() {
        return Math.min(this.screenW, this.screenH) * 0.08;
    }

    isLandscape() {
        return this.screenW > this.screenH;
    }

    getJoystickCenter() {
        if (this.isLandscape()) {
            return { x: this.screenW * 0.12, y: this.screenH * 0.5 };
        }
        return { x: this.screenW * 0.18, y: this.screenH * 0.82 };
    }

    getJoystickRadius() {
        return Math.min(this.screenW, this.screenH) * 0.14;
    }

    getZButtonPos() {
        if (this.isLandscape()) {
            return { x: this.screenW * 0.9, y: this.screenH * 0.6 };
        }
        return { x: this.screenW * 0.82, y: this.screenH * 0.82 };
    }

    getXButtonPos() {
        if (this.isLandscape()) {
            return { x: this.screenW * 0.9, y: this.screenH * 0.35 };
        }
        return { x: this.screenW * 0.62, y: this.screenH * 0.82 };
    }

    getPauseButtonPos() {
        return { x: this.screenW - Math.min(this.screenW, this.screenH) * 0.08 - 20, y: 20 + Math.min(this.screenW, this.screenH) * 0.08 };
    }

    pointInCircle(px, py, cx, cy, r) {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy <= r * r;
    }

    handleTouchStart(touches) {
        for (let i = 0; i < touches.length; i++) {
            const t = touches[i];
            const x = t.clientX;
            const y = t.clientY;
            const id = t.identifier;

            if (this.state === GameState.GAME_OVER) {
                const minDim = Math.min(this.screenW, this.screenH);
                const isPortrait = this.screenH > this.screenW;
                const btnW = minDim * 0.5;
                const btnH = minDim * 0.09;

                let extraContent = 0;
                if (this.endlessMode) {
                    const lastMutations = this.aiGenes.lastMutations || [];
                    const maxMutations = isPortrait ? 3 : 5;
                    const mutationCount = Math.min(lastMutations.length, maxMutations);
                    let mutationHeight = 0;
                    if (lastMutations.length > 0) {
                        mutationHeight = minDim * 0.035 + mutationCount * minDim * 0.028;
                        if (lastMutations.length > maxMutations) {
                            mutationHeight += minDim * 0.025;
                        }
                        mutationHeight += minDim * 0.025;
                    }
                    const talentBtnHeight = minDim * 0.065 + minDim * 0.015;
                    extraContent = minDim * 0.12 + mutationHeight + talentBtnHeight;
                }

                const btnY = this.screenH / 2 + (this.endlessMode ? minDim * 0.08 : minDim * 0.05) + extraContent / 2;
                // 检测"继续"按钮
                if (x >= this.screenW / 2 - btnW / 2 && x <= this.screenW / 2 + btnW / 2 &&
                    y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
                    this.startGame();
                    this.playSound('lCharge');
                    this.vibrate(20);
                    continue;
                }
                // 检测"查看基因谱"按钮（无尽模式）
                if (this.endlessMode) {
                    const talentBtnW = minDim * 0.4;
                    const talentBtnH = minDim * 0.065;
                    // 基因谱按钮位置（需与绘制位置匹配）
                    const titleSize = minDim * 0.09;
                    const infoY = this.screenH / 2 - minDim * 0.06 - extraContent / 2 + titleSize * 0.7;
                    const scoreY = infoY + minDim * 0.045;
                    const talentProgressY = scoreY + minDim * 0.04;
                    const progressBarY = talentProgressY + minDim * 0.02;
                    const progressBarH = minDim * 0.015;
                    // 计算基因变化区域的高度
                    const lastMutations = this.aiGenes.lastMutations || [];
                    const maxMutations = isPortrait ? 3 : 5;
                    let mutationHeight = 0;
                    if (lastMutations.length > 0) {
                        const mutationCount = Math.min(lastMutations.length, maxMutations);
                        mutationHeight = minDim * 0.035 + mutationCount * minDim * 0.028;
                        if (lastMutations.length > maxMutations) {
                            mutationHeight += minDim * 0.025;
                        }
                        mutationHeight += minDim * 0.025;
                    }
                    const talentBtnY = progressBarY + progressBarH + minDim * 0.025 + mutationHeight + minDim * 0.015;
                    if (x >= this.screenW / 2 - talentBtnW / 2 && x <= this.screenW / 2 + talentBtnW / 2 &&
                        y >= talentBtnY - talentBtnH / 2 && y <= talentBtnY + talentBtnH / 2) {
                        this.showTalentTree();
                        this.playSound('lCharge');
                        this.vibrate(15);
                        continue;
                    }
                }
                continue;
            }

            if (this.state === GameState.PAUSED) {
                const minDim = Math.min(this.screenW, this.screenH);
                const btnW = minDim * 0.45;
                const btnH = minDim * 0.08;
                const btnSpacing = minDim * 0.02;
                const startBtnY = this.screenH / 2 - minDim * 0.06;
                const talentBtnY = startBtnY + btnH + btnSpacing;
                const menuBtnY = talentBtnY + btnH + btnSpacing;

                if (x >= this.screenW / 2 - btnW / 2 && x <= this.screenW / 2 + btnW / 2 &&
                    y >= startBtnY - btnH / 2 && y <= startBtnY + btnH / 2) {
                    this.togglePause();
                    this.playSound('lCharge');
                    this.vibrate(15);
                } else if (x >= this.screenW / 2 - btnW / 2 && x <= this.screenW / 2 + btnW / 2 &&
                    y >= talentBtnY - btnH / 2 && y <= talentBtnY + btnH / 2) {
                    this.showTalentTree();
                    this.playSound('lCharge');
                    this.vibrate(15);
                } else if (x >= this.screenW / 2 - btnW / 2 && x <= this.screenW / 2 + btnW / 2 &&
                    y >= menuBtnY - btnH / 2 && y <= menuBtnY + btnH / 2) {
                    this.returnToMenu();
                    this.playSound('lCharge');
                    this.vibrate(20);
                }
                continue;
            }

            const pausePos = this.getPauseButtonPos();
            const btnR = this.getButtonRadius();
            if (this.pointInCircle(x, y, pausePos.x, pausePos.y, btnR * 0.7)) {
                if (!this.touchState.pauseTouched) {
                    this.togglePause();
                    this.playSound('lCharge');
                    this.vibrate(15);
                    this.touchState.pauseTouched = true;
                }
                this.touchState.pauseId = id;
                continue;
            }

            if (this.state !== GameState.PLAYING) continue;

            const zPos = this.getZButtonPos();
            if (this.pointInCircle(x, y, zPos.x, zPos.y, btnR)) {
                this.touchInput.zPressed = true;
                this.touchState.zId = id;
                this.vibrate(8);
                continue;
            }

            const xPos = this.getXButtonPos();
            if (this.pointInCircle(x, y, xPos.x, xPos.y, btnR)) {
                this.touchInput.xPressed = true;
                this.touchState.xId = id;
                this.vibrate(8);
                continue;
            }

            const joyCenter = this.getJoystickCenter();
            const joyR = this.getJoystickRadius();
            let inJoystickArea = false;
            if (this.isLandscape()) {
                inJoystickArea = x < this.screenW * 0.3 && y > this.screenH * 0.2 && y < this.screenH * 0.8;
            } else {
                inJoystickArea = x < this.screenW * 0.45 && y > this.screenH * 0.55;
            }
            if (inJoystickArea) {
                this.touchState.joystickId = id;
                this.updateJoystick(x, y);
                continue;
            }
        }
    }

    handleTouchMove(touches) {
        for (let i = 0; i < touches.length; i++) {
            const t = touches[i];
            const x = t.clientX;
            const y = t.clientY;
            const id = t.identifier;

            if (id === this.touchState.joystickId) {
                this.updateJoystick(x, y);
            }
        }
    }

    handleTouchEnd(touches) {
        for (let i = 0; i < touches.length; i++) {
            const t = touches[i];
            const id = t.identifier;

            if (id === this.touchState.joystickId) {
                this.touchState.joystickId = -1;
                this.touchInput.moveX = 0;
                this.touchInput.moveY = 0;
            }
            if (id === this.touchState.zId) {
                this.touchState.zId = -1;
                this.touchInput.zPressed = false;
            }
            if (id === this.touchState.xId) {
                this.touchState.xId = -1;
                this.touchInput.xPressed = false;
            }
            if (id === this.touchState.pauseId) {
                this.touchState.pauseId = -1;
                this.touchState.pauseTouched = false;
            }
        }
    }

    updateJoystick(x, y) {
        const center = this.getJoystickCenter();
        const maxR = this.getJoystickRadius() * 0.6;
        const dx = x - center.x;
        const dy = y - center.y;
        const mag = Math.sqrt(dx * dx + dy * dy);

        if (mag < 5) {
            this.touchInput.moveX = 0;
            this.touchInput.moveY = 0;
        } else if (mag <= maxR) {
            this.touchInput.moveX = dx / maxR;
            this.touchInput.moveY = dy / maxR;
        } else {
            this.touchInput.moveX = dx / mag;
            this.touchInput.moveY = dy / mag;
        }
    }

    initAudio() {
        try {
            this.audio = {
                sFire: new Howl({ src: ['assets/audio/GUNMech_Mechanical_12.ogg'] }),
                lFire: new Howl({ src: ['assets/audio/LASRGun_Plasma Rifle Fire_03.ogg'] }),
                lCharge: new Howl({ src: ['assets/audio/MECHClik_Mine Deploy_02.ogg'] }),
                lHurt: new Howl({ src: ['assets/audio/HIT_METAL_WRENCH_HEAVIEST_02.ogg'] }),
            };
            this.audioEnabled = true;
        } catch (e) {
            this.audioEnabled = false;
        }
    }

    playSound(name) {
        if (this.audioEnabled && this.audio[name]) {
            try { this.audio[name].play(); } catch (e) {}
        }
    }

    vibrate(duration) {
        if (navigator.vibrate) {
            try { navigator.vibrate(duration); } catch (e) {}
        }
    }

    initEntities(playerCount = null) {
        this.players = [];
        this.aiControllers = [];

        const count = playerCount || (CONFIG.AI_COUNT + 1);
        for (let i = 0; i < count; i++) {
            const player = new Player(this, i);
            this.players.push(player);

            if (this.gameMode === 'ai' && i > 0) {
                const genes = this.endlessMode ? this.aiGenes.genes : null;
                const abilities = this.endlessMode ? this.getUnlockedAbilities() : null;
                this.aiControllers.push(new AIController(this, i, genes, abilities));
            }
        }

        this.resetPlayerPositions();

        this.bullets = [];
        this.particles = [];
    }

    // 获取已解锁的基因能力列表（effect.type === 'ability' 的节点）
    getUnlockedAbilities() {
        if (!this.aiGenes || !this.aiGenes.unlockedGenes) return [];
        const abilities = [];
        for (const id of this.aiGenes.unlockedGenes) {
            const node = AIGeneTree.nodes[id];
            if (node && node.effect && node.effect.type === 'ability') {
                abilities.push({ id, ...node.effect });
            }
        }
        return abilities;
    }

    resetPlayerPositions() {
        const playerCount = this.players.length;
        const half = CONFIG.LOGICAL_SIZE / 2 - 100;
        for (let i = 0; i < playerCount; i++) {
            const angle = (i / playerCount) * Math.PI * 2 - Math.PI / 2;
            this.players[i].x = Math.cos(angle) * half * 0.6;
            this.players[i].y = Math.sin(angle) * half * 0.6;
            this.players[i].velX = 0;
            this.players[i].velY = 0;
            this.players[i].state = PlayerState.MOVE;
            this.players[i].chargeTime = 0;
            this.players[i].stunTime = 0;
            this.players[i].aimAngle = angle + Math.PI;
            this.players[i].alive = true;
            this.players[i].normalShotCount = 0;
            this.players[i].deathTime = 0;
            this.players[i].attackCooldown = 0;
            this.players[i].chargePlayed = false;
            this.players[i].rotationAngle = 0;
        }

        for (const ctrl of this.aiControllers) {
            ctrl.currentPlan = 'move';
            ctrl.killCooldown = 0;
            ctrl.planTimer = 0;
        }
    }

    start() {
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.fixedDt = 1 / CONFIG.FPS;
        this.loop();
    }

    loop() {
        const now = performance.now();
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (dt > 0.1) dt = 0.1;

        if (this.state === GameState.PLAYING || this.state === GameState.GAME_OVER || this.demoMode) {
            this.accumulator += dt;
            let maxIterations = 10;
            while (this.accumulator >= this.fixedDt && maxIterations > 0) {
                this.frameCount++;
                this.update(this.fixedDt);
                this.accumulator -= this.fixedDt;
                maxIterations--;
            }
            if (this.accumulator > this.fixedDt) {
                this.accumulator = this.fixedDt;
            }
        }

        this.render();
        requestAnimationFrame(() => this.loop());
    }

    async startGame() {
        this.demoMode = false;

        if (!this.endlessMode || this.endlessRound === 0) {
            this.aiGenes = this._createDefaultGenes();
            this.saveAIGenes();
        }

        if (this.gameMode === 'online') {
            if (Network.isHost) {
                const { seed, playerCount } = await Network.startHostGame();
                this.rng = new DeterministicRandom(seed);
                this.onlinePlayerCount = playerCount;
                Network.frameSync.game = this;
                this.initEntities(playerCount);
                this.resetGame();
                // 所有准备就绪后再进入 PLAYING 状态，避免 update() 在 frameSync 就绪前落入非在线分支
                this.state = GameState.PLAYING;
            } else {
                return;
            }
        } else {
            if (!this.endlessMode || this.endlessRound === 0) {
                this.endlessRound = 1;
                this.endlessWins = 0;
            }
            this.initEntities(this.aiPlayerCount);
            this.resetGame();
            this.state = GameState.PLAYING;
        }
    }

    resetGame() {
        this.bullets = [];
        this.particles = [];

        this.resetPlayerPositions();

        this.deathAnimationPending = false;
        this.deathAnimationTime = 0;
        this.gameOverTransition = 0;
        this.gameOverTextIn = 0;
        this.winnerId = -1;

        this.frameCount = 0;
        this.screenShake = 0;
        this.accumulator = 0;
        this.lastTime = performance.now();
    }

    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
        }
    }

    returnToMenu() {
        this.state = GameState.MENU;
        this.demoMode = true;
        if (typeof ui !== 'undefined' && ui.showStartScreen) {
            ui.showStartScreen();
        }
    }

    onPlayerDeath(victimId, killerId) {
        const victim = this.players[victimId];
        const killer = this.players[killerId];

        victim.state = PlayerState.DEAD;
        victim.deathTime = 0;
        victim.deathStartX = victim.x;
        victim.deathStartY = victim.y;
        victim.killerAngle = Math.atan2(victim.y - killer.y, victim.x - killer.x);

        this.addDeathShards(victim.x, victim.y, killerId);
        this.screenShake = 25;
        this.playSound('lHurt');

        const alivePlayers = this.players.filter(p => p.alive && p.state !== PlayerState.DEAD);
        if (alivePlayers.length <= 1) {
            this.deathAnimationPending = true;
            this.deathAnimationTime = 0;
            this.winnerId = alivePlayers.length === 1 ? alivePlayers[0].id : -1;
        }
    }

    addDeathShards(x, y, killerId) {
        const colors = PLAYER_COLORS[killerId % PLAYER_COLORS.length];
        const shardCount = CONFIG.DEATH_SHARD_COUNT;
        const color = colors.deathShard;

        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.3;
            const speed = CONFIG.DEATH_SHARD_SPEED * (0.6 + Math.random() * 0.8);
            const size = 4 + Math.random() * 8;
            const life = CONFIG.DEATH_ANIMATION_DURATION * (0.6 + Math.random() * 0.4);

            const p = new Particle(x, y, angle, speed, size, life, color);
            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = (Math.random() - 0.5) * 15;
            p.isShard = true;
            this.particles.push(p);
        }

        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            const size = 2 + Math.random() * 4;
            const life = CONFIG.DEATH_FADE_DURATION * (0.5 + Math.random() * 0.5);

            const glowColor = colors.deathGlow;
            const p = new Particle(x, y, angle, speed, size, life, glowColor);
            this.particles.push(p);
        }
    }

    finishGameOver() {
        this.state = GameState.GAME_OVER;
        this.gameOverTransition = 0;
        this.gameOverTextIn = 0;

        if (this.endlessMode) {
            this.endlessRound++;
            const aiLost = this.winnerId === 0;
            if (aiLost) {
                this.endlessWins++;
            }
            this.evolveAI(aiLost);
        }
    }

    update(dt) {
        if (this.talentTreeView) {
            return;
        }

        if (this.deathAnimationPending) {
            this.deathAnimationTime += dt;
            for (const p of this.players) {
                p.update(dt, { moveX: 0, moveY: 0, zPressed: false, xPressed: false });
            }
            this.updateParticles(dt);

            if (this.deathAnimationTime >= CONFIG.DEATH_ANIMATION_DURATION) {
                this.deathAnimationPending = false;
                this.finishGameOver();
            }

            if (this.screenShake > 0) {
                this.screenShake -= 50 / 60;
                if (this.screenShake < 0) this.screenShake = 0;
            }
            return;
        }

        if (this.state === GameState.GAME_OVER) {
            if (this.gameOverTransition < 1) {
                this.gameOverTransition = Math.min(1, this.gameOverTransition + dt / CONFIG.GAME_OVER_TRANSITION_DURATION);
            }
            if (this.gameOverTransition >= 0.3) {
                const textProgress = (this.gameOverTransition - 0.3) / 0.7;
                this.gameOverTextIn = Math.min(1, textProgress);
            }
            this.updateParticles(dt);
            if (this.screenShake > 0) {
                this.screenShake -= 50 / 60;
                if (this.screenShake < 0) this.screenShake = 0;
            }
            return;
        }

        if (this.gameMode === 'online' && Network.frameSync) {
            this.updateOnlineFrame();
            return;
        }

        const input = this.getPlayerInput();

        if (this.demoMode) {
            const demoInput = this.aiControllers[0].getDemoInput(this.players[0], this.players[1], dt);
            this.players[0].update(dt, demoInput);
            for (let i = 0; i < this.aiControllers.length; i++) {
                const ai = this.players[i + 1];
                this.aiControllers[i].updatePlan(ai, dt);
                ai.update(dt, this.aiControllers[i].getInput(ai, dt));
            }
        } else {
            this.players[0].update(dt, input);
            for (let i = 0; i < this.aiControllers.length; i++) {
                const ai = this.players[i + 1];
                this.aiControllers[i].updatePlan(ai, dt);
                ai.update(dt, this.aiControllers[i].getInput(ai, dt));
            }
        }

        this.updateBullets(dt);
        this.updateParticles(dt);
        this.checkCollisions();
        this.checkWinCondition();

        if (this.screenShake > 0) {
            this.screenShake -= 50 / 60;
            if (this.screenShake < 0) this.screenShake = 0;
        }
    }

    updateOnlineFrame() {
        const fs = Network.frameSync;
        const localInput = this.getPlayerInput();
        fs.addLocalInput(localInput);

        // 诊断日志：每60帧输出一次进度，帮助确认在线同步正常工作
        if (fs.frame > 0 && fs.frame % 60 === 0) {
            console.log('%c[GAME] online frame=' + fs.frame + ' inputsCollected=' + fs.inputsCollected + ' stall=' + fs.stallCount + ' dc=' + Network.dataChannels.size, 'color:#a0f');
        }

        while (fs.canAdvance()) {
            const frame = fs.frame;
            for (let i = 0; i < this.players.length; i++) {
                const playerInput = fs.getInputForFrame(frame, i);
                this.players[i].update(this.fixedDt, playerInput);
            }
            this.updateBullets(this.fixedDt);
            this.updateParticles(this.fixedDt);
            this.checkCollisions();
            this.checkWinCondition();
            fs.advanceFrame();

            if (this.screenShake > 0) {
                this.screenShake -= 50 / 60;
                if (this.screenShake < 0) this.screenShake = 0;
            }

            if (this.state !== GameState.PLAYING) break;
        }
    }

    getPlayerInput() {
        const input = {
            moveX: 0,
            moveY: 0,
            zPressed: false,
            xPressed: false,
        };

        if (this.keys['KeyW'] || this.keys['ArrowUp']) input.moveY -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) input.moveY += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) input.moveX -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) input.moveX += 1;

        const hasKeyboard = input.moveX !== 0 || input.moveY !== 0;
        if (!hasKeyboard) {
            input.moveX = this.touchInput.moveX;
            input.moveY = this.touchInput.moveY;
        }

        if (input.moveX !== 0 && input.moveY !== 0) {
            const mag = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
            if (mag > 0) {
                input.moveX /= mag;
                input.moveY /= mag;
            }
        }

        input.zPressed = this.keys['KeyZ'] || this.touchInput.zPressed || this.mouseZPressed;
        input.xPressed = this.keys['KeyX'] || this.touchInput.xPressed || this.mouseXPressed;

        return input;
    }

    updateBullets(dt) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(dt);

            const half = CONFIG.LOGICAL_SIZE / 2;
            if (b.x < -half || b.x > half || b.y < -half || b.y > half) {
                this.bullets.splice(i, 1);
            }
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    checkCollisions() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                if (i >= j) continue;
                const b1 = this.bullets[i];
                const b2 = this.bullets[j];
                if (!b1 || !b2) continue;
                if (b1.ownerId === b2.ownerId) continue;

                let hit = false;

                if (b1.lethal && b2.lethal) {
                    const halfLen = CONFIG.ULTIMATE_LASER_LENGTH / 2;
                    const x1_1 = b1.x - halfLen * Math.cos(b1.angle);
                    const y1_1 = b1.y - halfLen * Math.sin(b1.angle);
                    const x1_2 = b1.x + halfLen * Math.cos(b1.angle);
                    const y1_2 = b1.y + halfLen * Math.sin(b1.angle);
                    const x2_1 = b2.x - halfLen * Math.cos(b2.angle);
                    const y2_1 = b2.y - halfLen * Math.sin(b2.angle);
                    const x2_2 = b2.x + halfLen * Math.cos(b2.angle);
                    const y2_2 = b2.y + halfLen * Math.sin(b2.angle);
                    const d1 = this.pointToSegmentDist(x1_1, y1_1, x2_1, y2_1, x2_2, y2_2);
                    const d2 = this.pointToSegmentDist(x1_2, y1_2, x2_1, y2_1, x2_2, y2_2);
                    const d3 = this.pointToSegmentDist(x2_1, y2_1, x1_1, y1_1, x1_2, y1_2);
                    const d4 = this.pointToSegmentDist(x2_2, y2_2, x1_1, y1_1, x1_2, y1_2);
                    const minDist = Math.min(d1, d2, d3, d4);
                    hit = minDist < CONFIG.ULTIMATE_LASER_GLOW_WIDTH / 2;
                } else if (!b1.lethal && !b2.lethal) {
                    const dx = b1.x - b2.x;
                    const dy = b1.y - b2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    hit = dist < CONFIG.BULLET_COLLISION_RADIUS * 2;
                }

                if (hit) {
                    this.addParticles(b1.x, b1.y, 10, 7, 1, 5, 1, '#888');
                    this.bullets.splice(i, 1);
                    if (j > i) this.bullets.splice(j - 1, 1);
                    else this.bullets.splice(j, 1);
                    break;
                }
            }
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            let hitPlayer = null;

            for (const p of this.players) {
                if (p.id === b.ownerId || !p.alive || p.state === PlayerState.DEAD) continue;

                let hit = false;
                if (b.lethal) {
                    const halfLen = CONFIG.ULTIMATE_LASER_LENGTH / 2;
                    const bx1 = b.x - halfLen * Math.cos(b.angle);
                    const by1 = b.y - halfLen * Math.sin(b.angle);
                    const bx2 = b.x + halfLen * Math.cos(b.angle);
                    const by2 = b.y + halfLen * Math.sin(b.angle);
                    const dist = this.pointToSegmentDist(p.x, p.y, bx1, by1, bx2, by2);
                    hit = dist < CONFIG.PLAYER_COLLISION_RADIUS + CONFIG.ULTIMATE_LASER_CORE_WIDTH / 2;
                } else {
                    const dx = b.x - p.x;
                    const dy = b.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    hit = dist < CONFIG.PLAYER_COLLISION_RADIUS + CONFIG.BULLET_COLLISION_RADIUS;
                }

                if (hit) {
                    hitPlayer = p;
                    break;
                }
            }

            if (hitPlayer) {
                const ctrl = hitPlayer.isPlayer ? null : this.aiControllers.find(c => c.aiId === hitPlayer.id);
                const hasShield = ctrl && ctrl.getSpecialTrait() === 'shield' && ctrl.shieldActive > 0;

                if (b.lethal && !hasShield) {
                    this.onPlayerDeath(hitPlayer.id, b.ownerId);
                } else if (!b.lethal) {
                    if (hasShield) {
                        const colors = PLAYER_COLORS[hitPlayer.id % PLAYER_COLORS.length];
                        this.addParticles(b.x, b.y, 8, 4, 2, 5, 0.4, colors.glow + '0.8)');
                    } else {
                        this.thrust(hitPlayer, b);
                        hitPlayer.state = PlayerState.STUN;
                        hitPlayer.stunTime = CONFIG.STUN_DURATION;
                        const colors = PLAYER_COLORS[b.ownerId % PLAYER_COLORS.length];
                        this.addParticles(b.x, b.y, 5, 5, 1, 3, 0.5, colors.body);
                    }
                }

                this.bullets.splice(i, 1);
            }
        }
    }

    thrust(target, source) {
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const randomOffset = (Math.random() - 0.5) * 0.4;
        const thrustAngle = angle + randomOffset;
        const power = CONFIG.KNOCKBACK_POWER + Math.random() * CONFIG.KNOCKBACK_VARIANCE;

        target.velX += power * Math.cos(thrustAngle);
        target.velY += power * Math.sin(thrustAngle);
    }

    checkWinCondition() {
    }

    spawnBullet(x, y, angle, speed, isLethal, ownerId, isHead) {
        if (this.bullets.length >= CONFIG.MAX_BULLETS) {
            this.bullets.shift();
        }
        const bullet = new Bullet(x, y, angle, speed, isLethal, ownerId, isHead);
        this.bullets.push(bullet);
    }

    spawnUltimateBullets(shooterX, shooterY, angle, ownerId, style = 'standard') {
        const colors = PLAYER_COLORS[ownerId % PLAYER_COLORS.length];

        const fireOne = (ang) => {
            const offset = CONFIG.ULTIMATE_LASER_LENGTH / 2 + 20;
            const bx = shooterX + offset * Math.cos(ang);
            const by = shooterY + offset * Math.sin(ang);
            const speed = style === 'quick' ? CONFIG.ULTIMATE_BULLET_SPEED * 1.2 :
                          style === 'massive' ? CONFIG.ULTIMATE_BULLET_SPEED * 0.8 :
                          CONFIG.ULTIMATE_BULLET_SPEED;
            this.spawnBullet(bx, by, ang, speed, true, ownerId, true);

            const particleCount = style === 'massive' ? 18 : 12;
            for (let i = 0; i < particleCount; i++) {
                const spreadAngle = ang + (Math.random() - 0.5) * 0.8;
                const spd = 2 + Math.random() * 6;
                const px = shooterX + 20 * Math.cos(ang);
                const py = shooterY + 20 * Math.sin(ang);
                const color = colors.laserInner;
                this.addParticles(px, py, 1, 3 + Math.random() * 3, spd * 0.5, spd, 0.3 + Math.random() * 0.3, color);
            }
        };

        this.playSound('lFire');

        if (style === 'multi') {
            fireOne(angle - 0.15);
            fireOne(angle);
            fireOne(angle + 0.15);
        } else {
            fireOne(angle);
        }
    }

    addParticles(x, y, count, size, minSpeed, maxSpeed, lifespan, color) {
        if (this.particles.length >= CONFIG.MAX_PARTICLES) return;
        const actualCount = Math.min(count, CONFIG.MAX_PARTICLES - this.particles.length);
        for (let i = 0; i < actualCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            const p = new Particle(x, y, angle, speed, size, lifespan, color);
            this.particles.push(p);
        }
    }

    pointToSegmentDist(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) {
            const ex = px - x1;
            const ey = py - y1;
            return Math.sqrt(ex * ex + ey * ey);
        }
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;
        const ex = px - nearX;
        const ey = py - nearY;
        return Math.sqrt(ex * ex + ey * ey);
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);

        ctx.save();

        const scale = this.screenW / this.viewW * this.dpr;

        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake * this.dpr;
            shakeY = (Math.random() - 0.5) * this.screenShake * this.dpr;
        }

        ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
        ctx.scale(scale, scale);

        this.drawBackground();
        this.drawBullets(ctx);
        for (const p of this.players) {
            this.drawPlayer(ctx, p);
        }
        this.drawParticles(ctx);
        this.drawUI(ctx);

        ctx.restore();

        this.drawScreenUI(ctx);
    }

    drawBackground() {
        const ctx = this.ctx;
        const size = CONFIG.LOGICAL_SIZE;
        const half = size / 2;

        ctx.strokeStyle = 'rgba(224, 224, 224, 0.3)';
        ctx.lineWidth = 1;

        const lineCount = 20;
        for (let i = 0; i <= lineCount; i++) {
            const x = -half + i * (size / lineCount);
            ctx.beginPath();
            ctx.moveTo(x, -half);
            ctx.lineTo(x, half);
            ctx.stroke();
        }
        for (let i = 0; i <= lineCount; i++) {
            const y = -half + i * (size / lineCount);
            ctx.beginPath();
            ctx.moveTo(-half, y);
            ctx.lineTo(half, y);
            ctx.stroke();
        }

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-half, -half, size, size);
    }

    drawBullets(ctx) {
        for (const b of this.bullets) {
            b.draw(ctx);
        }
    }

    drawPlayer(ctx, player) {
        player.draw(ctx);
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }

    drawUI(ctx) {
    }

    drawScreenUI(ctx) {
        const isMobile = this.isMobileDevice();

        ctx.save();

        const w = this.screenW * this.dpr;
        const h = this.screenH * this.dpr;
        const dpr = this.dpr;

        if (isMobile && (this.state === GameState.PLAYING || this.state === GameState.PAUSED)) {
            const joyCenter = this.getJoystickCenter();
            const joyR = this.getJoystickRadius() * dpr;
            const joyCX = joyCenter.x * dpr;
            const joyCY = joyCenter.y * dpr;

            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(joyCX, joyCY, joyR, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 * dpr;
            ctx.stroke();

            let knobX = joyCX;
            let knobY = joyCY;
            if (this.touchInput.moveX !== 0 || this.touchInput.moveY !== 0) {
                knobX += this.touchInput.moveX * joyR * 0.6;
                knobY += this.touchInput.moveY * joyR * 0.6;
            }
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(knobX, knobY, joyR * 0.35, 0, Math.PI * 2);
            ctx.fill();

            const btnR = this.getButtonRadius() * dpr;

            const zPos = this.getZButtonPos();
            ctx.globalAlpha = this.touchInput.zPressed ? 0.5 : 0.25;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(zPos.x * dpr, zPos.y * dpr, btnR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.font = `${btnR * 0.45}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ATK', zPos.x * dpr, zPos.y * dpr);

            const xPos = this.getXButtonPos();
            ctx.globalAlpha = this.touchInput.xPressed ? 0.5 : 0.25;
            ctx.fillStyle = '#c04040';
            ctx.beginPath();
            ctx.arc(xPos.x * dpr, xPos.y * dpr, btnR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.fillText('ULT', xPos.x * dpr, xPos.y * dpr);

            const pausePos = this.getPauseButtonPos();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(pausePos.x * dpr, pausePos.y * dpr, btnR * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.font = `${btnR * 0.5}px monospace`;
            ctx.fillText('II', pausePos.x * dpr, pausePos.y * dpr);
        }

        if (this.state === GameState.PAUSED) {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;

            const minDim = Math.min(w, h);
            const titleSize = minDim * 0.07;
            const btnW = minDim * 0.45;
            const btnH = minDim * 0.08;
            const btnSpacing = minDim * 0.02;
            const titleY = h / 2 - minDim * 0.18;
            const startBtnY = h / 2 - minDim * 0.06;
            const talentBtnY = startBtnY + btnH + btnSpacing;
            const menuBtnY = talentBtnY + btnH + btnSpacing;

            ctx.fillStyle = '#000';
            ctx.font = `bold ${titleSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂停中', w / 2, titleY);

            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#000';
            ctx.fillRect(w / 2 - btnW / 2, startBtnY - btnH / 2, btnW, btnH);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#000';
            ctx.font = `${btnH * 0.4}px monospace`;
            ctx.fillText('继续游戏 (P)', w / 2, startBtnY);

            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#000';
            ctx.fillRect(w / 2 - btnW / 2, talentBtnY - btnH / 2, btnW, btnH);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#000';
            ctx.fillText('AI基因谱', w / 2, talentBtnY);

            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#000';
            ctx.fillRect(w / 2 - btnW / 2, menuBtnY - btnH / 2, btnW, btnH);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#000';
            ctx.fillText('返回主页面', w / 2, menuBtnY);
        }

        if (this.deathAnimationPending || this.state === GameState.GAME_OVER) {
            let bgAlpha = 0;
            let bgToWhite = 0;

            if (this.deathAnimationPending) {
                const fadeProgress = Math.min(this.deathAnimationTime / CONFIG.DEATH_ANIMATION_DURATION, 1);
                const easeFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
                bgAlpha = 0.2 + easeFade * 0.6;
            }

            if (this.state === GameState.GAME_OVER) {
                const t = this.gameOverTransition || 0;
                if (t < 0.4) {
                    bgAlpha = 0.8 + (t / 0.4) * 0.2;
                    bgToWhite = 0;
                } else {
                    bgAlpha = 1;
                    bgToWhite = (t - 0.4) / 0.6;
                    bgToWhite = bgToWhite * bgToWhite * (3 - 2 * bgToWhite);
                }
            }

            if (bgAlpha > 0) {
                if (bgToWhite > 0) {
                    const bgR = Math.floor(0 + 255 * bgToWhite);
                    const bgG = Math.floor(0 + 255 * bgToWhite);
                    const bgB = Math.floor(0 + 255 * bgToWhite);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = 'rgb(' + bgR + ', ' + bgG + ', ' + bgB + ')';
                } else {
                    ctx.globalAlpha = bgAlpha;
                    ctx.fillStyle = '#000';
                }
                ctx.fillRect(0, 0, w, h);
            }

            if (this.state === GameState.GAME_OVER) {
                const textAlpha = this.gameOverTextIn || 0;
                if (textAlpha > 0) {
                    const easeText = textAlpha * textAlpha * (3 - 2 * textAlpha);
                    const minDim = Math.min(w, h);
                    const isPortrait = h > w;
                    const titleSize = minDim * 0.09;
                    const btnW = minDim * 0.5;
                    const btnH = minDim * 0.09;
                    const titleYOffset = this.endlessMode ? (1 - easeText) * minDim * 0.06 : (1 - easeText) * minDim * 0.1;
                    const btnYOffset = (1 - easeText) * minDim * 0.06;
                    const titleScale = 0.7 + easeText * 0.3;

                    let extraContent = 0;
                    if (this.endlessMode) {
                        const lastMutations = this.aiGenes.lastMutations || [];
                        const maxMutations = isPortrait ? 3 : 5;
                        const mutationCount = Math.min(lastMutations.length, maxMutations);
                        let mutationHeight = 0;
                        if (lastMutations.length > 0) {
                            mutationHeight = minDim * 0.035 + mutationCount * minDim * 0.028;
                            if (lastMutations.length > maxMutations) {
                                mutationHeight += minDim * 0.025;
                            }
                            mutationHeight += minDim * 0.025;
                        }
                        const talentBtnHeight = minDim * 0.065 + minDim * 0.015;
                        extraContent = minDim * 0.12 + mutationHeight + talentBtnHeight;
                    }

                    const titleY = h / 2 - (this.endlessMode ? minDim * 0.06 : minDim * 0.08) - extraContent / 2 + titleYOffset;
                    const btnY = h / 2 + (this.endlessMode ? minDim * 0.08 : minDim * 0.05) + extraContent / 2 + btnYOffset;

                    ctx.globalAlpha = easeText;

                    ctx.save();
                    ctx.translate(w / 2, titleY);
                    ctx.scale(titleScale, titleScale);
                    ctx.fillStyle = '#000';
                    ctx.font = `bold ${titleSize}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.winnerId === 0 ? '胜 利' : '失 败', 0, 0);
                    ctx.restore();

                    if (this.endlessMode && easeText > 0.5) {
                        ctx.globalAlpha = easeText;
                        ctx.font = `${minDim * 0.04}px monospace`;
                        ctx.fillStyle = '#000';
                        ctx.textAlign = 'center';

                        const infoY = titleY + titleSize * 0.7;
                        ctx.fillText(`回合 ${this.endlessRound} · 胜利 ${this.endlessWins}`, w / 2, infoY);

                        // AI能力评分（基于已解锁基因数量和阶段）
                        const genes = this.aiGenes.genes;
                        const avgScore = (genes.level + genes.aimAccuracy + genes.reactionSpeed + genes.ultimateAggressiveness + genes.evasionAbility) / 5;
                        const scoreText = `AI能力评分: ${(avgScore * 100).toFixed(0)}%`;
                        const scoreY = infoY + minDim * 0.045;
                        ctx.font = `${minDim * 0.035}px monospace`;
                        ctx.fillText(scoreText, w / 2, scoreY);

                        // 基因解锁进度
                        const totalNodes = Object.keys(AIGeneTree.nodes).length;
                        const unlockedCount = this.aiGenes.unlockedGenes ? this.aiGenes.unlockedGenes.length : 0;
                        const talentLevelText = `基因 Lv.${this.aiGenes.maxUnlockedStage + 1} · 已解锁 ${unlockedCount}/${totalNodes}`;
                        const talentProgressY = scoreY + minDim * 0.04;
                        ctx.font = `${minDim * 0.028}px monospace`;
                        ctx.globalAlpha = easeText * 0.8;
                        ctx.fillStyle = '#444';
                        ctx.fillText(talentLevelText, w / 2, talentProgressY);

                        // 基因进度条
                        const progressBarW = minDim * 0.5;
                        const progressBarH = minDim * 0.015;
                        const progressBarX = w / 2 - progressBarW / 2;
                        const progressBarY = talentProgressY + minDim * 0.02;
                        // 背景
                        ctx.globalAlpha = easeText * 0.2;
                        ctx.fillStyle = '#000';
                        ctx.fillRect(progressBarX, progressBarY, progressBarW, progressBarH);
                        // 进度
                        const progress = totalNodes > 0 ? unlockedCount / totalNodes : 0;
                        ctx.globalAlpha = easeText * 0.6;
                        ctx.fillStyle = '#6b3fa0';
                        ctx.fillRect(progressBarX, progressBarY, progressBarW * progress, progressBarH);

                        // 本轮基因变化
                        const lastMutations = this.aiGenes.lastMutations || [];
                        const maxMutations = isPortrait ? 3 : 5;
                        let mutationY = progressBarY + progressBarH + minDim * 0.025;
                        if (lastMutations.length > 0) {
                            ctx.globalAlpha = easeText;
                            ctx.font = `${minDim * 0.028}px monospace`;
                            ctx.fillStyle = '#444';
                            ctx.textAlign = 'center';
                            ctx.fillText('— 本轮基因进化 —', w / 2, mutationY);
                            mutationY += minDim * 0.035;

                            const branchNames = {
                                attack: '攻击',
                                movement: '移动',
                                defense: '防御',
                                ultimate: '大招',
                                special: '特殊',
                            };

                            for (let i = 0; i < Math.min(lastMutations.length, maxMutations); i++) {
                                const mut = lastMutations[i];
                                const branchColor = AIGeneTree.branches[mut.branch] ? AIGeneTree.branches[mut.branch].color : '#6b3fa0';
                                const prefix = mut.type === 'mutation' ? '✦ 突变: ' : '+ 进化: ';
                                const branchName = branchNames[mut.branch] || mut.branch;
                                const text = `${prefix}[${branchName}] ${mut.newValue}`;

                                ctx.globalAlpha = easeText * (0.9 - i * 0.1);
                                ctx.font = `${minDim * 0.025}px monospace`;
                                ctx.fillStyle = branchColor;
                                ctx.fillText(text, w / 2, mutationY);
                                mutationY += minDim * 0.028;
                            }

                            if (lastMutations.length > maxMutations) {
                                ctx.globalAlpha = easeText * 0.5;
                                ctx.font = `${minDim * 0.022}px monospace`;
                                ctx.fillStyle = '#666';
                                ctx.fillText(`... 还有 ${lastMutations.length - maxMutations} 项变化`, w / 2, mutationY);
                                mutationY += minDim * 0.025;
                            }
                        }

                        // 查看基因谱按钮
                        const talentBtnW = minDim * 0.4;
                        const talentBtnH = minDim * 0.065;
                        const talentBtnY = mutationY + minDim * 0.015;
                        ctx.globalAlpha = easeText * 0.15;
                        ctx.fillStyle = '#6b3fa0';
                        ctx.fillRect(w / 2 - talentBtnW / 2, talentBtnY - talentBtnH / 2, talentBtnW, talentBtnH);
                        ctx.globalAlpha = easeText;
                        ctx.strokeStyle = '#6b3fa0';
                        ctx.lineWidth = 2 * dpr;
                        ctx.strokeRect(w / 2 - talentBtnW / 2, talentBtnY - talentBtnH / 2, talentBtnW, talentBtnH);
                        ctx.font = `${talentBtnH * 0.38}px monospace`;
                        ctx.fillStyle = '#6b3fa0';
                        ctx.fillText('查看基因谱', w / 2, talentBtnY);
                    }

                    ctx.globalAlpha = easeText * 0.15;
                    ctx.fillStyle = '#000';
                    ctx.fillRect(w / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH);

                    ctx.globalAlpha = easeText;
                    ctx.font = `${btnH * 0.4}px monospace`;
                    ctx.fillStyle = '#000';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(isMobile ? '点击继续' : '按 R 继续', w / 2, btnY);
                }
            }
        }

        ctx.globalAlpha = 1;

        ctx.restore();
    }
}

class Player {
    constructor(game, id) {
        this.game = game;
        this.id = id;
        this.isPlayer = id === 0;
        this.colors = PLAYER_COLORS[id % PLAYER_COLORS.length];
        this.x = 0;
        this.y = 0;
        this.velX = 0;
        this.velY = 0;
        this.state = PlayerState.MOVE;
        this.aimAngle = this.isPlayer ? -Math.PI / 2 : Math.PI / 2;
        this.chargeTime = 0;
        this.stunTime = 0;
        this.attackCooldown = 0;
        this.rotationAngle = 0;
        this.alive = true;
        this.chargePlayed = false;
        this.normalShotCount = 0;
        this.orbitAngle = 0;
        this.orbitRings = [];
        const ringRadii = [CONFIG.ORBIT_RADIUS_1, CONFIG.ORBIT_RADIUS_2];
        for (let r = 0; r < CONFIG.ORBIT_RING_COUNT; r++) {
            this.orbitRings.push({
                radius: ringRadii[r],
                tilt: (r - 0.5) * 0.5,
                spinDir: r % 2 === 0 ? 1 : -1,
                spinSpeed: 0.6 + r * 0.4,
                morphPhase: r * 0.5,
                angle: Math.random() * Math.PI * 2,
            });
        }
    }

    update(dt, input) {
        if (this.state === PlayerState.DEAD) {
            this.deathTime += dt;
            return;
        }

        if (!this.alive) return;

        switch (this.state) {
            case PlayerState.MOVE:
                this.handleMoveState(input);
                break;
            case PlayerState.ATTACK:
                this.handleAttackState(input);
                break;
            case PlayerState.CHARGE:
                this.handleChargeState(input, dt);
                break;
            case PlayerState.STUN:
                this.handleStunState(dt);
                break;
        }

        this.x += this.velX;
        this.y += this.velY;

        const half = CONFIG.LOGICAL_SIZE / 2 - CONFIG.PLAYER_SIZE / 2;
        if (this.x < -half) { this.x = -half; this.velX *= -0.3; }
        if (this.x > half) { this.x = half; this.velX *= -0.3; }
        if (this.y < -half) { this.y = -half; this.velY *= -0.3; }
        if (this.y > half) { this.y = half; this.velY *= -0.3; }

        const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
        const maxSpeed = Math.max(CONFIG.PLAYER_MAX_VEL_X, CONFIG.PLAYER_MAX_VEL_Y);
        const friction = speed > maxSpeed ? CONFIG.KNOCKBACK_DECAY : CONFIG.PLAYER_FRICTION;

        this.velX *= friction;
        this.velY *= friction;

        this.rotationAngle += (0.05 + 0.015 * (this.velX * this.velX + this.velY * this.velY)) * Math.PI * 2 * dt;

        const speedRatio = Math.min(speed / maxSpeed, 1);
        const baseOrbitSpeed = CONFIG.ORBIT_BASE_SPIN + speedRatio * CONFIG.ORBIT_SPIN_SPEED_FACTOR * 5;
        for (const ring of this.orbitRings) {
            ring.angle += baseOrbitSpeed * ring.spinDir * ring.spinSpeed * dt;
            ring.morphPhase += CONFIG.ORBIT_MORPH_SPEED * dt * ring.spinDir;
            if (ring.morphPhase < 0) ring.morphPhase += 2;
            if (ring.morphPhase >= 2) ring.morphPhase -= 2;
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
    }

    handleMoveState(input) {
        this.addVelocity(input.moveX, input.moveY);

        if (input.zPressed) {
            this.state = PlayerState.ATTACK;
            this.aimAngle = this.getAngleToEnemy();
            return;
        }

        if (input.xPressed) {
            this.state = PlayerState.CHARGE;
            this.chargeTime = 0;
            this.chargePlayed = false;
            this.aimAngle = this.getAngleToEnemy();
            return;
        }
    }

    handleAttackState(input) {
        this.addVelocity(input.moveX * CONFIG.MOVE_SLOW_FACTOR, input.moveY * CONFIG.MOVE_SLOW_FACTOR);

        this.aimAngle = this.getAngleToEnemy();

        if (this.attackCooldown <= 0) {
            this.fireNormal();
            let interval = CONFIG.NORMAL_BULLET_INTERVAL;
            if (!this.isPlayer) {
                const ctrl = this.game.aiControllers.find(c => c.aiId === this.id);
                if (ctrl) {
                    const style = ctrl.getAttackStyle();
                    if (style === 'rapid') interval *= 0.6;
                    if (style === 'heavy') interval *= 1.6;
                    if (style === 'spread') interval *= 1.3;
                }
            }
            this.attackCooldown = interval;
        }

        if (!input.zPressed) {
            this.state = PlayerState.MOVE;
        }
    }

    handleChargeState(input, dt) {
        this.addVelocity(input.moveX * CONFIG.MOVE_SLOW_FACTOR, input.moveY * CONFIG.MOVE_SLOW_FACTOR);

        this.aimAngle += input.moveX * CONFIG.AIM_SPEED * dt;

        if (this.isPlayer) {
            const stunnedEnemy = this.getNearestStunnedEnemy();
            if (stunnedEnemy) {
                const toEnemy = Math.atan2(stunnedEnemy.y - this.y, stunnedEnemy.x - this.x);
                let diff = toEnemy - this.aimAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                const chargeRatio = Math.min(this.chargeTime / CONFIG.ULTIMATE_CHARGE_TIME, 1);
                const boost = 1 + chargeRatio * (CONFIG.AIM_ASSIST_CHARGE_BOOST - 1);
                const stunTrackingStrength = 3.5;
                const maxTrackRange = Math.PI * 0.6;

                if (Math.abs(diff) < maxTrackRange) {
                    this.aimAngle += diff * stunTrackingStrength * boost * dt;
                }
            } else {
                const enemy = this.getNearestEnemy();
                if (enemy) {
                    const toEnemy = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    let diff = toEnemy - this.aimAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const chargeRatio = Math.min(this.chargeTime / CONFIG.ULTIMATE_CHARGE_TIME, 1);
                    const boost = 1 + chargeRatio * (CONFIG.AIM_ASSIST_CHARGE_BOOST - 1);
                    this.aimAngle += diff * CONFIG.AIM_ASSIST_STRENGTH * boost * dt * 10;
                }
            }
        } else {
            const enemy = this.getNearestEnemy();
            if (enemy) {
                const toEnemy = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                let diff = toEnemy - this.aimAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const chargeRatio = Math.min(this.chargeTime / CONFIG.ULTIMATE_CHARGE_TIME, 1);
                const boost = 1 + chargeRatio * (CONFIG.AIM_ASSIST_CHARGE_BOOST - 1);
                const aimStrength = 0.6;
                this.aimAngle += diff * CONFIG.AIM_ASSIST_STRENGTH * boost * aimStrength * dt * 10;
            }
        }

        this.chargeTime += dt;

        const fullyCharged = this.chargeTime >= CONFIG.ULTIMATE_CHARGE_TIME;

        if (fullyCharged && !this.chargePlayed) {
            this.game.playSound('lCharge');
            this.chargePlayed = true;
        }

        if (!input.xPressed && fullyCharged) {
            this.fireUltimate();
            this.state = PlayerState.MOVE;
            this.chargeTime = 0;
            return;
        }

        if (!input.xPressed && !fullyCharged) {
            this.state = PlayerState.MOVE;
            this.chargeTime = 0;
            return;
        }
    }

    handleStunState(dt) {
        this.stunTime -= dt;
        if (this.stunTime <= 0) {
            this.state = PlayerState.MOVE;
        }
    }

    addVelocity(x, y) {
        const targetVX = x * CONFIG.PLAYER_MAX_VEL_X;
        const targetVY = y * CONFIG.PLAYER_MAX_VEL_Y;

        const hasInput = x !== 0 || y !== 0;
        let accelX, accelY;

        if (hasInput) {
            const inputMag = Math.sqrt(x * x + y * y);
            const nx = x / inputMag;
            const ny = y / inputMag;
            const maxSpeed = Math.sqrt(targetVX * targetVX + targetVY * targetVY);
            const currentSpeed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);

            const accel = currentSpeed < maxSpeed ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_DECEL;
            accelX = nx * accel;
            accelY = ny * accel;
        } else {
            accelX = 0;
            accelY = 0;
        }

        this.velX += accelX;
        this.velY += accelY;

        const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
        const maxSpeed = Math.max(CONFIG.PLAYER_MAX_VEL_X, CONFIG.PLAYER_MAX_VEL_Y);
        if (speed > maxSpeed * 1.5) {
            const scale = maxSpeed * 1.5 / speed;
            this.velX *= scale;
            this.velY *= scale;
        }
    }

    getNearestEnemy() {
        let nearest = null;
        let minDist = Infinity;
        for (const p of this.game.players) {
            if (p.id === this.id || !p.alive) continue;
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearest = p;
            }
        }
        return nearest;
    }

    getNearestStunnedEnemy() {
        let nearest = null;
        let minDist = Infinity;
        for (const p of this.game.players) {
            if (p.id === this.id || !p.alive || p.stunTime <= 0) continue;
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearest = p;
            }
        }
        return nearest;
    }

    getAngleToEnemy() {
        const enemy = this.getNearestEnemy();
        if (!enemy) return this.aimAngle;
        return Math.atan2(enemy.y - this.y, enemy.x - this.x);
    }

    fireNormal() {
        const offset = 24;
        const bx = this.x + offset * Math.cos(this.aimAngle);
        const by = this.y + offset * Math.sin(this.aimAngle);

        if (this.isPlayer) {
            this.game.spawnBullet(bx, by, this.aimAngle, CONFIG.NORMAL_BULLET_SPEED, false, this.id, false);
        } else {
            const ctrl = this.game.aiControllers.find(c => c.aiId === this.id);
            const style = ctrl ? ctrl.getAttackStyle() : 'basic';

            if (style === 'rapid') {
                this.game.spawnBullet(bx, by, this.aimAngle, CONFIG.NORMAL_BULLET_SPEED * 0.9, false, this.id, false);
            } else if (style === 'heavy') {
                this.game.spawnBullet(bx, by, this.aimAngle, CONFIG.NORMAL_BULLET_SPEED * 1.3, false, this.id, false);
            } else if (style === 'spread') {
                for (let i = -1; i <= 1; i++) {
                    const angle = this.aimAngle + i * 0.25;
                    const spreadX = this.x + offset * Math.cos(angle);
                    const spreadY = this.y + offset * Math.sin(angle);
                    this.game.spawnBullet(spreadX, spreadY, angle, CONFIG.NORMAL_BULLET_SPEED * 0.85, false, this.id, false);
                }
            } else {
                this.game.spawnBullet(bx, by, this.aimAngle, CONFIG.NORMAL_BULLET_SPEED, false, this.id, false);
            }
        }

        this.game.playSound('sFire');
        this.normalShotCount++;
    }

    fireUltimate() {
        if (this.isPlayer) {
            this.game.spawnUltimateBullets(this.x, this.y, this.aimAngle, this.id, 'standard');
        } else {
            const ctrl = this.game.aiControllers.find(c => c.aiId === this.id);
            const style = ctrl ? ctrl.getUltimateStyle() : 'standard';
            this.game.spawnUltimateBullets(this.x, this.y, this.aimAngle, this.id, style);
        }
    }

    draw(ctx) {
        if (this.state === PlayerState.DEAD) {
            this.drawDeathAnimation(ctx);
            return;
        }

        if (!this.alive) return;

        const s = CONFIG.PLAYER_SIZE;
        const color = this.colors.body;
        const strokeColor = this.colors.stroke;

        this.drawOrbitShapes(ctx);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);

        ctx.fillStyle = color;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);

        ctx.restore();

        if (this.state === PlayerState.CHARGE) {
            this.drawLaserCharge(ctx);
        }

        if (this.state === PlayerState.STUN) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotationAngle);
            ctx.fillStyle = 'rgba(192, 64, 64, 0.4)';
            ctx.fillRect(-s / 2, -s / 2, s, s);
            ctx.restore();
        }

        if (!this.isPlayer) {
            const ctrl = this.game.aiControllers.find(c => c.aiId === this.id);
            if (ctrl && ctrl.getSpecialTrait() === 'shield' && ctrl.shieldActive > 0) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.globalAlpha = 0.6 * Math.min(ctrl.shieldActive, 1);
                ctx.strokeStyle = this.colors.glow + '0.9)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = this.colors.glow + '1)';
                ctx.fill();
                ctx.restore();
            }
        }
    }

    drawOrbitShapes(ctx) {
        const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
        const maxSpeed = Math.max(CONFIG.PLAYER_MAX_VEL_X, CONFIG.PLAYER_MAX_VEL_Y);
        const speedRatio = Math.min(speed / maxSpeed, 1);

        const strokeColor = this.colors.orbit;
        const glowColor = this.colors.glow;

        ctx.save();
        ctx.translate(this.x, this.y);

        for (let r = 0; r < this.orbitRings.length; r++) {
            const ring = this.orbitRings[r];
            const baseRadius = ring.radius * (1 + speedRatio * 0.6);
            const alpha = 0.5 + speedRatio * 0.35;

            ctx.save();
            ctx.rotate(ring.angle);

            const cyclePhase = ring.morphPhase % 2;
            const shapeIdx = Math.floor(cyclePhase);
            const morphProgress = cyclePhase - shapeIdx;

            let size1, size2;
            if (shapeIdx === 0) {
                size1 = baseRadius * 0.9;
                size2 = baseRadius * 0.78;
            } else {
                size1 = baseRadius * 0.78;
                size2 = baseRadius * 0.9;
            }

            const size = size1 + (size2 - size1) * morphProgress;

            ctx.strokeStyle = glowColor + (alpha * 0.3) + ')';
            ctx.lineWidth = CONFIG.ORBIT_GLOW_WIDTH + 2;
            ctx.globalAlpha = 0.5;
            this.drawMorphRingShape(ctx, shapeIdx, morphProgress, size);

            ctx.globalAlpha = 1;
            ctx.strokeStyle = strokeColor + alpha + ')';
            ctx.lineWidth = CONFIG.ORBIT_LINE_WIDTH;
            ctx.fillStyle = glowColor + (alpha * 0.06) + ')';
            this.drawMorphRingShape(ctx, shapeIdx, morphProgress, size);

            ctx.restore();
        }

        ctx.restore();
    }

    drawMorphRingShape(ctx, fromIdx, blend, size) {
        const shapes = [
            this.getTrianglePoints(size),
            this.getSquarePoints(size),
        ];

        const safeFromIdx = Math.abs(Math.floor(fromIdx)) % shapes.length;
        const safeToIdx = (safeFromIdx + 1) % shapes.length;
        const fromPoints = shapes[safeFromIdx] || [];
        const toPoints = shapes[safeToIdx] || [];

        if (fromPoints.length === 0 || toPoints.length === 0) return;

        const pointCount = Math.max(fromPoints.length, toPoints.length);

        ctx.beginPath();
        for (let i = 0; i <= pointCount; i++) {
            const idx = i % pointCount;
            const fp = fromPoints[idx];
            const tp = toPoints[idx];
            const x = fp.x + (tp.x - fp.x) * blend;
            const y = fp.y + (tp.y - fp.y) * blend;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    getTrianglePoints(size) {
        const points = [];
        const s = Math.max(1, size);
        const segPerEdge = 12;
        for (let i = 0; i < 3; i++) {
            const a1 = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 3) * Math.PI * 2 - Math.PI / 2;
            const x1 = Math.cos(a1) * s;
            const y1 = Math.sin(a1) * s;
            const x2 = Math.cos(a2) * s;
            const y2 = Math.sin(a2) * s;
            for (let j = 0; j < segPerEdge; j++) {
                const t = j / segPerEdge;
                points.push({
                    x: x1 + (x2 - x1) * t,
                    y: y1 + (y2 - y1) * t,
                });
            }
        }
        return points;
    }

    getSquarePoints(size) {
        const points = [];
        const s = Math.max(1, size * 0.88);
        const segPerEdge = 9;
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const x1 = Math.cos(angle) * s;
            const y1 = Math.sin(angle) * s;
            const nextAngle = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
            const x2 = Math.cos(nextAngle) * s;
            const y2 = Math.sin(nextAngle) * s;
            for (let j = 0; j < segPerEdge; j++) {
                const t = j / segPerEdge;
                points.push({
                    x: x1 + (x2 - x1) * t,
                    y: y1 + (y2 - y1) * t,
                });
            }
        }
        return points;
    }

    drawDeathAnimation(ctx) {
        const progress = Math.min(this.deathTime / CONFIG.DEATH_ANIMATION_DURATION, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const scale = 1 - easeOut * 0.8;
        const alpha = 1 - easeOut;

        if (alpha <= 0) return;

        const s = CONFIG.PLAYER_SIZE * scale;
        const color = this.colors.body;
        const strokeColor = this.colors.stroke;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle + this.deathTime * 5);

        ctx.fillStyle = color;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);

        ctx.restore();
    }

    drawLaserCharge(ctx) {
        const ratio = Math.min(this.chargeTime / CONFIG.ULTIMATE_CHARGE_TIME, 1);
        const easeOut = 1 - Math.pow(1 - ratio, 3);
        const ringR = CONFIG.RING_SIZE;
        const pulse = ratio >= 1 ? 1 + Math.sin(this.chargeTime * 30) * 0.08 : 1;

        const indicatorLength = 80 + easeOut * 280;
        const coreWidth = CONFIG.LASER_CHARGE_WIDTH_START + easeOut * (CONFIG.LASER_CHARGE_WIDTH_END - CONFIG.LASER_CHARGE_WIDTH_START);
        const glowWidth = coreWidth * 3.5;
        const midWidth = coreWidth * 1.8;

        const glowColor = this.colors.glow;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.aimAngle);

        const gradOuter = ctx.createLinearGradient(20, 0, indicatorLength, 0);
        gradOuter.addColorStop(0, glowColor + '0)');
        gradOuter.addColorStop(0.1, glowColor + (0.25 * easeOut) + ')');
        gradOuter.addColorStop(0.9, glowColor + (0.25 * easeOut) + ')');
        gradOuter.addColorStop(1, glowColor + '0)');

        ctx.strokeStyle = gradOuter;
        ctx.lineWidth = glowWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(indicatorLength, 0);
        ctx.stroke();

        const gradMid = ctx.createLinearGradient(20, 0, indicatorLength, 0);
        gradMid.addColorStop(0, glowColor + '0)');
        gradMid.addColorStop(0.15, glowColor + (0.5 * easeOut) + ')');
        gradMid.addColorStop(0.85, glowColor + (0.5 * easeOut) + ')');
        gradMid.addColorStop(1, glowColor + '0)');

        ctx.strokeStyle = gradMid;
        ctx.lineWidth = midWidth;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(indicatorLength, 0);
        ctx.stroke();

        const gradInner = ctx.createLinearGradient(20, 0, indicatorLength, 0);
        gradInner.addColorStop(0, glowColor + '0)');
        gradInner.addColorStop(0.2, glowColor + (0.85 * easeOut) + ')');
        gradInner.addColorStop(0.8, glowColor + (0.85 * easeOut) + ')');
        gradInner.addColorStop(1, glowColor + '0)');

        ctx.strokeStyle = gradInner;
        ctx.lineWidth = coreWidth;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(indicatorLength, 0);
        ctx.stroke();

        if (ratio >= 0.6) {
            const brightRatio = (ratio - 0.6) / 0.4;
            const brightEase = 1 - Math.pow(1 - brightRatio, 2);
            ctx.strokeStyle = this.colors.laserInner.replace('0.8', 0.9 * brightEase);
            ctx.lineWidth = coreWidth * 0.5;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(indicatorLength, 0);
            ctx.stroke();
        }

        if (ratio >= 1) {
            const pulseIntensity = 0.7 + Math.sin(this.chargeTime * 40) * 0.3;
            ctx.strokeStyle = this.colors.laserInner.replace('0.8', pulseIntensity);
            ctx.lineWidth = coreWidth * 0.7;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(indicatorLength, 0);
            ctx.stroke();

            ctx.fillStyle = this.colors.laserInner.replace('0.8', pulseIntensity * 0.9);
            ctx.beginPath();
            ctx.arc(indicatorLength, 0, coreWidth * 0.6 + Math.sin(this.chargeTime * 30) * 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(indicatorLength, 0, coreWidth * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = CONFIG.RING_STROKE;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        if (ratio > 0) {
            const mainColor = this.colors.laserMid;

            ctx.strokeStyle = glowColor + '0.3)';
            ctx.lineWidth = CONFIG.RING_STROKE + 6;
            ctx.beginPath();
            ctx.arc(0, 0, ringR * pulse, -Math.PI / 2 + this.aimAngle, -Math.PI / 2 + this.aimAngle + ratio * Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = mainColor;
            ctx.lineWidth = CONFIG.RING_STROKE;
            ctx.beginPath();
            ctx.arc(0, 0, ringR * pulse, -Math.PI / 2 + this.aimAngle, -Math.PI / 2 + this.aimAngle + ratio * Math.PI * 2);
            ctx.stroke();
        }

        const aimColor = this.colors.laserCore;
        ctx.strokeStyle = aimColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ringR * Math.cos(this.aimAngle - 0), ringR * Math.sin(this.aimAngle - 0));
        ctx.stroke();

        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle, speed, isLethal, ownerId, isHead) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.lethal = isLethal;
        this.ownerId = ownerId;
        this.isHead = isHead;
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const colors = PLAYER_COLORS[this.ownerId % PLAYER_COLORS.length];

        if (this.lethal) {
            const coreColor = colors.laserCore;
            const glowOuter = colors.laserOuter;
            const glowMid = colors.laserMid;
            const glowInner = colors.laserInner;
            const len = CONFIG.ULTIMATE_LASER_LENGTH;
            const coreW = CONFIG.ULTIMATE_LASER_CORE_WIDTH;
            const glowW = CONFIG.ULTIMATE_LASER_GLOW_WIDTH;

            const gradOuter = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
            gradOuter.addColorStop(0, 'transparent');
            gradOuter.addColorStop(0.15, glowOuter);
            gradOuter.addColorStop(0.85, glowOuter);
            gradOuter.addColorStop(1, 'transparent');

            ctx.fillStyle = gradOuter;
            ctx.beginPath();
            ctx.ellipse(0, 0, len / 2, glowW / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            const gradMid = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
            gradMid.addColorStop(0, 'transparent');
            gradMid.addColorStop(0.25, glowMid);
            gradMid.addColorStop(0.75, glowMid);
            gradMid.addColorStop(1, 'transparent');

            ctx.fillStyle = gradMid;
            ctx.beginPath();
            ctx.ellipse(0, 0, len / 2, glowW / 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            const gradInner = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
            gradInner.addColorStop(0, 'transparent');
            gradInner.addColorStop(0.35, glowInner);
            gradInner.addColorStop(0.65, glowInner);
            gradInner.addColorStop(1, 'transparent');

            ctx.fillStyle = gradInner;
            ctx.beginPath();
            ctx.ellipse(0, 0, len / 2, coreW * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = coreColor;
            ctx.beginPath();
            ctx.ellipse(0, 0, len / 2, coreW / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(len / 2 - 6, 0, coreW / 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = glowInner;
            ctx.beginPath();
            ctx.arc(-len / 2 + 8, 0, coreW * 0.8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const color = colors.bullet;
            const len = CONFIG.NORMAL_BULLET_LENGTH;

            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-len / 2, 0);
            ctx.lineTo(len / 2, 0);
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-len / 2 + 2, 0);
            ctx.lineTo(len / 2 - 2, 0);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, angle, speed, size, lifespan, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = lifespan;
        this.maxLife = lifespan;
        this.size = size;
        this.color = color;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.isShard = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.vy += 50 * dt;
        this.life -= dt;
        if (this.rotationSpeed) {
            this.rotation += this.rotationSpeed * dt;
        }
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);

        if (this.isShard) {
            ctx.rotate(this.rotation);
            ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class AIController {
    constructor(game, aiId, genes = null, abilities = null) {
        this.game = game;
        this.aiId = aiId;
        this.currentPlan = 'move';
        this.horizontalMove = 0;
        this.verticalMove = 0;
        this.killCooldown = 0;
        this.planTimer = 0;
        this.dashCooldown = 0;
        this.shieldCooldown = 0;
        this.shieldActive = 0;
        this.weavePhase = 0;
        this.genes = genes || { ...AIGeneDefaults };
        this.abilities = abilities || []; // 天赋解锁的特殊能力
        this.trackTimer = 0;
        this.lastTrackedEnemy = null;
    }

    getEffectiveLevel() {
        return this.genes.level;
    }

    getAimAccuracy() {
        return this.genes.aimAccuracy;
    }

    getUltimateAggressiveness() {
        return this.genes.ultimateAggressiveness;
    }

    getEvasionAbility() {
        return this.genes.evasionAbility;
    }

    getReactionSpeed() {
        return this.genes.reactionSpeed;
    }

    getAttackStyle() {
        return this.genes.attackStyle;
    }

    getMovementStyle() {
        return this.genes.movementStyle;
    }

    getUltimateStyle() {
        return this.genes.ultimateStyle;
    }

    getSpecialTrait() {
        return this.genes.specialTrait;
    }

    getStrategyMutation() {
        return this.genes.strategyMutation;
    }

    // 获取已解锁的天赋能力（按 key 查找）
    getAbility(key) {
        for (let i = 0; i < this.abilities.length; i++) {
            if (this.abilities[i].key === key) return this.abilities[i];
        }
        return null;
    }

    getThreatInfo(ai) {
        let nearbyCount = 0;
        let stunnedEnemy = null;
        let lowHpEnemy = null;
        let minStunDist = Infinity;
        let minHpDist = Infinity;
        const closeThreshold = 150000;
        for (const p of this.game.players) {
            if (p.id === ai.id || !p.alive || p.state === PlayerState.DEAD) continue;
            const dx = p.x - ai.x;
            const dy = p.y - ai.y;
            const dist = dx * dx + dy * dy;
            if (dist < closeThreshold) nearbyCount++;
            if (p.stunTime > 0 && dist < minStunDist) {
                minStunDist = dist;
                stunnedEnemy = p;
            }
            if (p.state === PlayerState.STUN && dist < minHpDist) {
                minHpDist = dist;
                lowHpEnemy = p;
            }
        }
        return { nearbyCount, stunnedEnemy, lowHpEnemy };
    }

    getNearestEnemy(ai) {
        let nearest = null;
        let minDist = Infinity;
        for (const p of this.game.players) {
            if (p.id === ai.id || !p.alive || p.state === PlayerState.DEAD) continue;
            const dx = p.x - ai.x;
            const dy = p.y - ai.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearest = p;
            }
        }
        return nearest;
    }

    getInput(ai, dt) {
        if (this.killCooldown > 0) this.killCooldown -= dt;

        this.trackTimer += dt;
        const shouldTrack = this.trackTimer >= 0.05;
        if (shouldTrack) this.trackTimer = 0;

        let target = null;
        if (shouldTrack) {
            target = this.getNearestEnemy(ai);
        } else {
            target = this.lastTrackedEnemy;
        }

        if (!target) {
            return {
                moveX: 0,
                moveY: 0,
                zPressed: false,
                xPressed: false,
            };
        }

        if (shouldTrack) {
            this.lastTrackedEnemy = target;
        }

        const canUseUltimate = ai.normalShotCount >= CONFIG.AI_ULTIMATE_MIN_JABS;
        let xPressed = this.currentPlan === 'kill' && canUseUltimate;

        const aimAcc = this.getAimAccuracy();

        if (this.currentPlan === 'jab' && shouldTrack) {
            const toEnemy = Math.atan2(target.y - ai.y, target.x - ai.x);
            ai.aimAngle = toEnemy + (Math.random() - 0.5) * 0.3 * (1 - aimAcc);
        }

        if (this.currentPlan === 'kill' && canUseUltimate) {
            if (shouldTrack) {
                const toEnemy = Math.atan2(target.y - ai.y, target.x - ai.x);
                ai.aimAngle = toEnemy + (Math.random() - 0.5) * 0.25 * (1 - aimAcc);
            }

            const fullyCharged = ai.chargeTime >= CONFIG.ULTIMATE_CHARGE_TIME;
            if (fullyCharged) {
                const toEnemy = Math.atan2(target.y - ai.y, target.x - ai.x);
                let relative = toEnemy - ai.aimAngle;
                while (relative > Math.PI) relative -= Math.PI * 2;
                while (relative < -Math.PI) relative += Math.PI * 2;

                const overcharged = ai.chargeTime >= CONFIG.ULTIMATE_CHARGE_TIME + CONFIG.ULTIMATE_RELEASE_WINDOW;
                if (Math.abs(relative) < 0.25 || overcharged) {
                    xPressed = false;
                    if (ai.chargeTime >= CONFIG.ULTIMATE_CHARGE_TIME + 0.05) {
                        this.currentPlan = 'jab';
                        ai.normalShotCount = 0;
                        const distToPlayer = (ai.x - target.x) ** 2 + (ai.y - target.y) ** 2;
                        if (target.state === PlayerState.STUN) {
                            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_STUN;
                        } else if (distToPlayer < 80000) {
                            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_CLOSE;
                        } else {
                            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_FAR;
                        }
                    }
                }
            }
        }

        return {
            moveX: this.horizontalMove,
            moveY: this.verticalMove,
            zPressed: this.currentPlan === 'jab',
            xPressed: xPressed,
            // 天赋增强标记
            fireRateBoost: this.getAbility('fireRateBoost'),
            powerShot: this.getAbility('powerShot'),
        };
    }

    getDemoInput(ai, player, dt) {
        this.planTimer += dt;
        if (this.planTimer >= CONFIG.AI_PLAN_UPDATE_INTERVAL) {
            this.planTimer = 0;
            this.updatePlan(ai, dt);
        }

        return {
            moveX: this.horizontalMove * 0.7,
            moveY: this.verticalMove * 0.7,
            zPressed: this.currentPlan === 'jab',
            xPressed: this.currentPlan === 'kill' && Math.random() < 0.5,
        };
    }

    updatePlan(ai, dt) {
        this.planTimer += dt;
        const updateInterval = CONFIG.AI_PLAN_UPDATE_INTERVAL / this.getReactionSpeed();
        if (this.planTimer < updateInterval) return;
        this.planTimer = 0;

        let target = this.getNearestEnemy(ai);
        if (!target) return;

        const threat = this.getThreatInfo(ai);
        const playerCount = this.game.players.filter(p => p.alive && p.state !== PlayerState.DEAD).length;
        const isMultiplayer = playerCount > 2;

        if (isMultiplayer && threat.nearbyCount >= 2) {
            if (threat.stunnedEnemy) {
                target = threat.stunnedEnemy;
            }
        }

        const level = this.getEffectiveLevel();
        const ultAggro = this.getUltimateAggressiveness();
        const aimAcc = this.getAimAccuracy();
        const evasion = this.getEvasionAbility();
        const movementStyle = this.getMovementStyle();
        const specialTrait = this.getSpecialTrait();
        const ultimateStyle = this.getUltimateStyle();
        const strategyMutation = this.getStrategyMutation();
        const half = CONFIG.LOGICAL_SIZE / 2;

        let ultimateThreshold = CONFIG.AI_ULTIMATE_MIN_JABS;
        if (ultimateStyle === 'quick') ultimateThreshold = Math.floor(ultimateThreshold * 0.6);
        if (ultimateStyle === 'massive') ultimateThreshold = Math.floor(ultimateThreshold * 1.5);
        const canUseUltimate = ai.normalShotCount >= ultimateThreshold;

        let nearestArrow = null;
        let minDist = Infinity;
        const enemyBullets = this.game.bullets.filter(b => b.ownerId !== ai.id);

        for (const b of enemyBullets) {
            const dx = ai.x - b.x;
            const dy = ai.y - b.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearestArrow = b;
            }
        }

        if (specialTrait === 'dash' && this.dashCooldown > 0) this.dashCooldown -= dt;
        if (specialTrait === 'shield' && this.shieldCooldown > 0) this.shieldCooldown -= dt;
        if (specialTrait === 'shield' && this.shieldActive > 0) this.shieldActive -= dt;

        if (specialTrait === 'dash' && this.dashCooldown <= 0 && minDist < 40000 && nearestArrow) {
            const bulletAngle = nearestArrow.angle;
            const playerAngle = Math.atan2(ai.y - nearestArrow.y, ai.x - nearestArrow.x);
            let dashAngle = bulletAngle;
            if (playerAngle - bulletAngle > 0) {
                dashAngle += Math.PI / 2;
            } else {
                dashAngle -= Math.PI / 2;
            }
            ai.velX += Math.cos(dashAngle) * 8;
            ai.velY += Math.sin(dashAngle) * 6;
            this.dashCooldown = 3.0 + Math.random() * 2;
        }

        if (specialTrait === 'shield' && this.shieldCooldown <= 0 && minDist < 30000) {
            this.shieldActive = 1.0;
            this.shieldCooldown = 8.0 + Math.random() * 4;
        }

        if (strategyMutation === 'turtle') {
            if (canUseUltimate && this.killCooldown <= 0 && Math.random() < 0.25) {
                this.horizontalMove = 0;
                this.verticalMove = 0;
                this.currentPlan = 'kill';
                this.setKillDirection(ai, target);
                this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_CLOSE;
            } else {
                this.horizontalMove = 0;
                this.verticalMove = 0;
                this.currentPlan = 'jab';
            }
            return;
        }

        if (strategyMutation === 'stay_corner') {
            if (!this.cornerTarget) {
                const corners = [
                    { x: -half + 80, y: -half + 80 },
                    { x: half - 80, y: -half + 80 },
                    { x: -half + 80, y: half - 80 },
                    { x: half - 80, y: half - 80 },
                ];
                this.cornerTarget = corners[Math.floor(Math.random() * corners.length)];
            }
            const distToCorner = Math.sqrt((ai.x - this.cornerTarget.x) ** 2 + (ai.y - this.cornerTarget.y) ** 2);
            if (distToCorner > 30) {
                this.setMoveDirectionToPoint(ai, this.cornerTarget.x, this.cornerTarget.y, 20);
                this.currentPlan = 'move';
            } else {
                this.horizontalMove = 0;
                this.verticalMove = 0;
                if (canUseUltimate && this.killCooldown <= 0 && Math.random() < 0.15) {
                    this.currentPlan = 'kill';
                    this.setKillDirection(ai, target);
                    this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_CLOSE;
                } else {
                    this.currentPlan = 'jab';
                }
            }
            return;
        }

        if (strategyMutation === 'mirror_move') {
            const mirrorX = -target.x;
            const mirrorY = -target.y;
            const distToMirror = Math.sqrt((ai.x - mirrorX) ** 2 + (ai.y - mirrorY) ** 2);
            if (distToMirror > 50) {
                this.setMoveDirectionToPoint(ai, mirrorX, mirrorY, 30);
            } else {
                this.horizontalMove = 0;
                this.verticalMove = 0;
            }
            this.currentPlan = Math.random() < 0.15 ? 'move' : 'jab';
            return;
        }

        if (strategyMutation === 'predictive' && nearestArrow) {
            const bulletSpeed = CONFIG.NORMAL_BULLET_SPEED;
            const distToBullet = Math.sqrt(minDist);
            const timeToHit = distToBullet / bulletSpeed;
            const predictedX = ai.x + ai.velX * timeToHit * 2;
            const predictedY = ai.y + ai.velY * timeToHit * 2;
            const escapeAngle = nearestArrow.angle + Math.PI;
            const tx = predictedX + 80 * Math.cos(escapeAngle);
            const ty = predictedY + 80 * Math.sin(escapeAngle);
            this.setMoveDirectionToPoint(ai, tx, ty, 0);
            this.currentPlan = Math.random() < 0.2 ? 'move' : 'jab';
            return;
        }

        if (isMultiplayer && threat.nearbyCount >= 2 && !threat.stunnedEnemy && this.killCooldown > 0) {
            const safeAngle = Math.atan2(ai.y - target.y, ai.x - target.x);
            const tx = ai.x + 120 * Math.cos(safeAngle);
            const ty = ai.y + 120 * Math.sin(safeAngle);
            this.setMoveDirectionToPoint(ai, tx, ty, 0);
            this.currentPlan = Math.random() < 0.2 ? 'move' : 'jab';
            return;
        }

        if (this.currentPlan === 'kill') {
            if (!canUseUltimate) {
                this.currentPlan = strategyMutation === 'only_ultimate' ? 'move' : 'jab';
                this.setMoveDirection(ai, target, movementStyle, strategyMutation);
                return;
            }
            this.setKillDirection(ai, target);
            return;
        }

        if (target.state === PlayerState.STUN && this.killCooldown <= 0 && canUseUltimate) {
            this.currentPlan = 'kill';
            ai.aimAngle += (Math.random() - 0.5) * 0.3 * (1 - aimAcc);
            this.setKillDirection(ai, target);
            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_STUN;
            return;
        }

        const evasionThreshold = 60000 * (1 - evasion * 0.5);
        if (minDist < evasionThreshold && nearestArrow) {
            const bulletAngle = nearestArrow.angle;
            const playerAngle = Math.atan2(ai.y - nearestArrow.y, ai.x - nearestArrow.x);
            let escapeAngle = bulletAngle;
            if (playerAngle - bulletAngle > 0) {
                escapeAngle += Math.PI / 4 + Math.random() * Math.PI / 4;
            } else {
                escapeAngle -= Math.PI / 4 + Math.random() * Math.PI / 4;
            }
            const tx = ai.x + 100 * Math.cos(escapeAngle);
            const ty = ai.y + 100 * Math.sin(escapeAngle);
            this.setMoveDirectionToPoint(ai, tx, ty, 0);
            this.currentPlan = strategyMutation === 'no_attack' ? 'move' : (Math.random() < 0.15 ? 'move' : 'jab');
            return;
        }

        const distToPlayer = this.distPow2(ai, target);

        const closeDist = movementStyle === 'aggressive' || strategyMutation === 'berserker' ? 120000 : 80000;
        const farDist = movementStyle === 'defensive' ? 200000 : 150000;
        const actualUltAggro = strategyMutation === 'berserker' ? ultAggro * 2 : ultAggro;

        if (distToPlayer < closeDist && this.killCooldown <= 0 && canUseUltimate && Math.random() < 0.12 * actualUltAggro) {
            this.currentPlan = 'kill';
            ai.aimAngle += (Math.random() - 0.5) * 0.35 * (1 - aimAcc);
            this.setKillDirection(ai, target);
            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_CLOSE;
            return;
        }

        if (distToPlayer < farDist && this.killCooldown <= 0 && canUseUltimate && Math.random() < 0.08 * actualUltAggro) {
            this.currentPlan = 'kill';
            ai.aimAngle += (Math.random() - 0.5) * 0.3 * (1 - aimAcc);
            this.setKillDirection(ai, target);
            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_CLOSE * 1.2;
            return;
        }

        if (strategyMutation === 'chase_only') {
            this.setMoveDirection(ai, target, 'aggressive');
            this.currentPlan = Math.random() < 0.12 ? 'move' : 'jab';
            return;
        }

        if (strategyMutation === 'only_ultimate') {
            this.setMoveDirection(ai, target, movementStyle);
            if (canUseUltimate && this.killCooldown <= 0 && Math.random() < 0.06 * ultAggro) {
                this.currentPlan = 'kill';
                this.setKillDirection(ai, target);
                this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_CLOSE;
            } else {
                this.currentPlan = 'move';
            }
            return;
        }

        if (distToPlayer < farDist) {
            this.setMoveDirection(ai, target, movementStyle, strategyMutation);
            const attackChance = strategyMutation === 'berserker' ? 0.2 : 0.15;
            this.currentPlan = strategyMutation === 'no_attack' ? 'move' : (Math.random() < attackChance ? 'move' : 'jab');
            return;
        }

        if (Math.random() < 0.05 * level && this.killCooldown <= 0 && canUseUltimate && distToPlayer < 250000) {
            this.currentPlan = 'kill';
            this.setKillDirection(ai, target);
            this.killCooldown = CONFIG.AI_ULTIMATE_COOLDOWN_FAR;
            return;
        }

        if (Math.random() < 0.15) {
            this.currentPlan = 'move';
        } else {
            this.currentPlan = strategyMutation === 'no_attack' ? 'move' : 'jab';
        }
        this.setMoveDirection(ai, target, movementStyle, strategyMutation);
    }

    setMoveDirection(ai, target, style = 'balanced', strategy = 'none') {
        const half = CONFIG.LOGICAL_SIZE / 2;
        let tx, ty;

        if (strategy === 'only_linear') {
            if (!this.linearAngle) {
                this.linearAngle = Math.random() * Math.PI * 2;
            }
            this.linearAngle += Math.random() * 0.1 - 0.05;
            tx = ai.x + 150 * Math.cos(this.linearAngle);
            ty = ai.y + 150 * Math.sin(this.linearAngle);
        } else if (style === 'aggressive') {
            const dist = Math.sqrt(this.distPow2(ai, target));
            const idealDist = 120;
            if (dist > idealDist + 30) {
                tx = target.x;
                ty = target.y;
            } else if (dist < idealDist - 30) {
                tx = -target.x;
                ty = -target.y;
            } else {
                this.weavePhase += 0.15;
                const perpAngle = Math.atan2(target.y - ai.y, target.x - ai.x) + Math.PI / 2;
                tx = ai.x + Math.cos(perpAngle) * 80 * Math.sin(this.weavePhase);
                ty = ai.y + Math.sin(perpAngle) * 80 * Math.sin(this.weavePhase);
            }
        } else if (style === 'defensive') {
            const dist = Math.sqrt(this.distPow2(ai, target));
            const idealDist = 250;
            if (dist < idealDist - 30) {
                tx = -target.x;
                ty = -target.y;
            } else if (dist > idealDist + 30) {
                tx = target.x;
                ty = target.y;
            } else {
                this.weavePhase += 0.1;
                const perpAngle = Math.atan2(target.y - ai.y, target.x - ai.x) + Math.PI / 2;
                tx = ai.x + Math.cos(perpAngle) * 100 * Math.sin(this.weavePhase);
                ty = ai.y + Math.sin(perpAngle) * 100 * Math.sin(this.weavePhase);
            }
        } else if (style === 'weaving') {
            this.weavePhase += 0.12;
            const baseAngle = Math.atan2(target.y - ai.y, target.x - ai.x);
            const perpAngle = baseAngle + Math.PI / 2;
            const weaveAmt = 120 * Math.sin(this.weavePhase);
            tx = ai.x + Math.cos(baseAngle) * 50 + Math.cos(perpAngle) * weaveAmt;
            ty = ai.y + Math.sin(baseAngle) * 50 + Math.sin(perpAngle) * weaveAmt;
        } else {
            if (target.x > 0) {
                tx = -half + Math.random() * (half * 0.5);
            } else {
                tx = Math.random() * (half * 0.5);
            }
            if (target.y > 0) {
                ty = -half + Math.random() * (half * 0.5);
            } else {
                ty = Math.random() * (half * 0.5);
            }
        }

        const allowance = 100;
        if (tx > ai.x + allowance) this.horizontalMove = 1;
        else if (tx < ai.x - allowance) this.horizontalMove = -1;
        else this.horizontalMove = 0;
        if (ty > ai.y + allowance) this.verticalMove = 1;
        else if (ty < ai.y - allowance) this.verticalMove = -1;
        else this.verticalMove = 0;

        // 天赋增强：移动速度加成
        const moveBoost = this.getAbility('moveSpeedBoost');
        if (moveBoost) {
            const multiplier = moveBoost.params && moveBoost.params.multiplier || 1.5;
            this.horizontalMove *= multiplier;
            this.verticalMove *= multiplier;
        }
    }

    setMoveDirectionToPoint(ai, tx, ty, allowance) {
        if (tx > ai.x + allowance) this.horizontalMove = 1;
        else if (tx < ai.x - allowance) this.horizontalMove = -1;
        else this.horizontalMove = 0;
        if (ty > ai.y + allowance) this.verticalMove = 1;
        else if (ty < ai.y - allowance) this.verticalMove = -1;
        else this.verticalMove = 0;
    }

    setKillDirection(ai, enemy) {
        const toEnemy = Math.atan2(enemy.y - ai.y, enemy.x - ai.x);
        let relative = toEnemy - ai.aimAngle;

        while (relative > Math.PI) relative -= Math.PI * 2;
        while (relative < -Math.PI) relative += Math.PI * 2;

        if (Math.abs(relative) < 0.02) {
            this.horizontalMove = 0;
        } else if (relative > 0) {
            this.horizontalMove = 1;
        } else {
            this.horizontalMove = -1;
        }

        this.verticalMove = 0;
    }

    distPow2(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }
}

window.addEventListener('load', () => {
    window.game = new Game();
    window.initUI();
});
