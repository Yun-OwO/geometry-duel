const PLAYER_COLORS = [
    { body: '#ffffff', stroke: '#000000', orbit: 'rgba(45, 65, 140, ', glow: 'rgba(90, 140, 255, ', laserCore: '#101030', laserOuter: 'rgba(60, 100, 255, 0.25)', laserMid: 'rgba(100, 150, 255, 0.5)', laserInner: 'rgba(180, 200, 255, 0.8)', deathShard: '#303060', deathGlow: 'rgba(100, 120, 255, 0.6)', bullet: '#808080' },
    { body: '#000000', stroke: '#ffffff', orbit: 'rgba(155, 115, 30, ', glow: 'rgba(255, 200, 80, ', laserCore: '#fff8e0', laserOuter: 'rgba(255, 200, 60, 0.25)', laserMid: 'rgba(255, 220, 100, 0.5)', laserInner: 'rgba(255, 240, 180, 0.8)', deathShard: '#606080', deathGlow: 'rgba(255, 200, 100, 0.6)', bullet: '#a0a0a0' },
    { body: '#8b0000', stroke: '#ff6b6b', orbit: 'rgba(120, 30, 30, ', glow: 'rgba(255, 100, 100, ', laserCore: '#300000', laserOuter: 'rgba(255, 60, 60, 0.25)', laserMid: 'rgba(255, 100, 100, 0.5)', laserInner: 'rgba(255, 150, 150, 0.8)', deathShard: '#603030', deathGlow: 'rgba(255, 100, 100, 0.6)', bullet: '#c06060' },
    { body: '#006400', stroke: '#90ee90', orbit: 'rgba(30, 100, 30, ', glow: 'rgba(100, 255, 100, ', laserCore: '#003000', laserOuter: 'rgba(60, 255, 60, 0.25)', laserMid: 'rgba(100, 255, 100, 0.5)', laserInner: 'rgba(150, 255, 150, 0.8)', deathShard: '#306030', deathGlow: 'rgba(100, 255, 100, 0.6)', bullet: '#60c060' },
    { body: '#4b0082', stroke: '#dda0dd', orbit: 'rgba(80, 30, 130, ', glow: 'rgba(200, 100, 255, ', laserCore: '#200040', laserOuter: 'rgba(150, 60, 255, 0.25)', laserMid: 'rgba(200, 100, 255, 0.5)', laserInner: 'rgba(220, 150, 255, 0.8)', deathShard: '#403060', deathGlow: 'rgba(200, 100, 255, 0.6)', bullet: '#a060c0' },
];

const CONFIG = {
    LOGICAL_SIZE: 640,
    FPS: 60,
    AI_COUNT: 2,
    PLAYER_SIZE: 32,
    PLAYER_MAX_VEL_X: 12,
    PLAYER_MAX_VEL_Y: 9,
    PLAYER_ACCEL: 1.8,
    PLAYER_DECEL: 1.2,
    PLAYER_FRICTION: 0.92,
    PLAYER_AIR_FRICTION: 0.95,
    ORBIT_RING_COUNT: 2,
    ORBIT_RADIUS_1: 52,
    ORBIT_RADIUS_2: 72,
    ORBIT_LINE_WIDTH: 2,
    ORBIT_GLOW_WIDTH: 6,
    ORBIT_BASE_SPIN: 0.5,
    ORBIT_SPIN_SPEED_FACTOR: 0.15,
    ORBIT_MORPH_SPEED: 0.25,
    MAX_BULLETS: 50,
    MAX_PARTICLES: 200,
    NORMAL_BULLET_SPEED: 10,
    NORMAL_BULLET_INTERVAL: 0.18,
    NORMAL_BULLET_LENGTH: 16,
    ULTIMATE_BULLET_SPEED: 48,
    ULTIMATE_CHARGE_TIME: 0.25,
    ULTIMATE_LASER_LENGTH: 160,
    ULTIMATE_LASER_CORE_WIDTH: 6,
    ULTIMATE_LASER_GLOW_WIDTH: 28,
    ULTIMATE_RELEASE_WINDOW: 2.0,
    STUN_DURATION: 0.75,
    MOVE_SLOW_FACTOR: 0.25,
    AIM_SPEED: 0.18 * Math.PI * 2,
    AIM_ASSIST_STRENGTH: 0.22,
    AIM_ASSIST_CHARGE_BOOST: 2.0,
    LASER_CHARGE_WIDTH_START: 3,
    LASER_CHARGE_WIDTH_END: 22,
    RING_SIZE: 80,
    RING_STROKE: 8,
    BULLET_COLLISION_RADIUS: 6,
    PLAYER_COLLISION_RADIUS: 16,
    AI_PLAN_UPDATE_INTERVAL: 0.12,
    AI_LEVEL: 0.7,
    KNOCKBACK_POWER: 10,
    KNOCKBACK_VARIANCE: 3,
    KNOCKBACK_DECAY: 0.88,
    AI_ULTIMATE_MIN_JABS: 6,
    AI_ULTIMATE_COOLDOWN_STUN: 3.0,
    AI_ULTIMATE_COOLDOWN_CLOSE: 5.0,
    AI_ULTIMATE_COOLDOWN_FAR: 7.0,
    DEATH_ANIMATION_DURATION: 0.8,
    DEATH_SHARD_COUNT: 16,
    DEATH_SHARD_SPEED: 200,
    DEATH_FADE_DURATION: 0.6,
    GAME_OVER_TRANSITION_DURATION: 0.6,
    GAME_OVER_TEXT_DELAY: 0.1,
};

const GameState = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3,
};

const PlayerState = {
    MOVE: 0,
    ATTACK: 1,
    CHARGE: 2,
    STUN: 3,
    DEAD: 4,
};

const AIGeneDefaults = {
    level: 0.3,
    aimAccuracy: 0.5,
    reactionSpeed: 0.4,
    ultimateAggressiveness: 0.3,
    evasionAbility: 0.4,
    attackStyle: 'basic',
    movementStyle: 'balanced',
    ultimateStyle: 'standard',
    specialTrait: 'none',
    strategyMutation: 'none',
};

const AIGeneRanges = {
    level: { min: 0.1, max: 1.0 },
    aimAccuracy: { min: 0.2, max: 1.0 },
    reactionSpeed: { min: 0.2, max: 1.0 },
    ultimateAggressiveness: { min: 0.1, max: 1.0 },
    evasionAbility: { min: 0.2, max: 1.0 },
};

const AIAlleles = {
    attackStyle: ['basic', 'rapid', 'heavy', 'spread'],
    movementStyle: ['balanced', 'aggressive', 'defensive', 'weaving'],
    ultimateStyle: ['standard', 'quick', 'massive', 'multi'],
    specialTrait: ['none', 'shield', 'regen', 'dash'],
    strategyMutation: ['none', 'only_ultimate', 'only_linear', 'no_attack', 'chase_only', 'stay_corner', 'mirror_move', 'predictive', 'berserker', 'turtle'],
};

const AIGeneNames = {
    level: '基础强度',
    aimAccuracy: '瞄准精度',
    reactionSpeed: '反应速度',
    ultimateAggressiveness: '大招积极性',
    evasionAbility: '闪避能力',
    attackStyle: '攻击风格',
    movementStyle: '移动风格',
    ultimateStyle: '大招风格',
    specialTrait: '特殊特性',
    strategyMutation: '策略突变',
};

const AIAlleleNames = {
    attackStyle: { basic: '基础', rapid: '速射', heavy: '重炮', spread: '散射' },
    movementStyle: { balanced: '平衡', aggressive: '激进', defensive: '保守', weaving: '游走' },
    ultimateStyle: { standard: '标准', quick: '迅捷', massive: '重型', multi: '多发' },
    specialTrait: { none: '无', shield: '护盾', regen: '再生', dash: '冲刺' },
    strategyMutation: {
        none: '无',
        only_ultimate: '只放大招',
        only_linear: '直线移动',
        no_attack: '不攻击',
        chase_only: '只追击',
        stay_corner: '守角落',
        mirror_move: '镜像移动',
        predictive: '预判走位',
        berserker: '狂暴模式',
        turtle: '缩壳防御',
    },
};

const AIMutationConfig = {
    beneficialChance: 0.7,
    mutationStrength: 0.15,
    harmfulStrength: 0.08,
    minMutations: 1,
    maxMutations: 2,
    typeGeneChance: 0.5,
    strategyMutationChance: 0.3,
    geneVersion: 2,
};