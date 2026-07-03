const PLAYER_COLORS = [
    { body: '#ffffff', stroke: '#000000', orbit: 'rgba(45, 65, 140, ', glow: 'rgba(90, 140, 255, ', laserCore: '#101030', laserOuter: 'rgba(60, 100, 255, 0.25)', laserMid: 'rgba(100, 150, 255, 0.5)', laserInner: 'rgba(180, 200, 255, 0.8)', deathShard: '#303060', deathGlow: 'rgba(100, 120, 255, 0.6)', bullet: '#7a9fff' },
    { body: '#000000', stroke: '#ffffff', orbit: 'rgba(155, 115, 30, ', glow: 'rgba(255, 200, 80, ', laserCore: '#fff8e0', laserOuter: 'rgba(255, 200, 60, 0.25)', laserMid: 'rgba(255, 220, 100, 0.5)', laserInner: 'rgba(255, 240, 180, 0.8)', deathShard: '#606080', deathGlow: 'rgba(255, 200, 100, 0.6)', bullet: '#ffcc55' },
    { body: '#8b0000', stroke: '#ff6b6b', orbit: 'rgba(120, 30, 30, ', glow: 'rgba(255, 100, 100, ', laserCore: '#300000', laserOuter: 'rgba(255, 60, 60, 0.25)', laserMid: 'rgba(255, 100, 100, 0.5)', laserInner: 'rgba(255, 150, 150, 0.8)', deathShard: '#603030', deathGlow: 'rgba(255, 100, 100, 0.6)', bullet: '#ff5555' },
    { body: '#006400', stroke: '#90ee90', orbit: 'rgba(30, 100, 30, ', glow: 'rgba(100, 255, 100, ', laserCore: '#003000', laserOuter: 'rgba(60, 255, 60, 0.25)', laserMid: 'rgba(100, 255, 100, 0.5)', laserInner: 'rgba(150, 255, 150, 0.8)', deathShard: '#306030', deathGlow: 'rgba(100, 255, 100, 0.6)', bullet: '#55ff77' },
    { body: '#4b0082', stroke: '#dda0dd', orbit: 'rgba(80, 30, 130, ', glow: 'rgba(200, 100, 255, ', laserCore: '#200040', laserOuter: 'rgba(150, 60, 255, 0.25)', laserMid: 'rgba(200, 100, 255, 0.5)', laserInner: 'rgba(220, 150, 255, 0.8)', deathShard: '#403060', deathGlow: 'rgba(200, 100, 255, 0.6)', bullet: '#cc77ff' },
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
    NORMAL_BULLET_SPEED: 14,
    NORMAL_BULLET_INTERVAL: 0.18,
    NORMAL_BULLET_LENGTH: 20,
    ULTIMATE_BULLET_SPEED: 48,
    ULTIMATE_CHARGE_TIME: 0.25,
    ULTIMATE_LASER_LENGTH: 160,
    ULTIMATE_LASER_CORE_WIDTH: 6,
    ULTIMATE_LASER_GLOW_WIDTH: 28,
    ULTIMATE_RELEASE_WINDOW: 2.0,
    STUN_DURATION: 0.5,
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
    AI_ULTIMATE_COOLDOWN_STUN: 3.5,
    AI_ULTIMATE_COOLDOWN_CLOSE: 6.0,
    AI_ULTIMATE_COOLDOWN_FAR: 9.0,
    DEATH_ANIMATION_DURATION: 0.8,
    DEATH_SHARD_COUNT: 16,
    DEATH_SHARD_SPEED: 200,
    DEATH_FADE_DURATION: 0.6,
    GAME_OVER_TRANSITION_DURATION: 0.6,
    GAME_OVER_TEXT_DELAY: 0.1,
};

const AIGeneTree = {
    nodes: {
        // ============================================================
        //  攻击系 (attack) - 15个节点（二叉树：1+2+4+8）
        // ============================================================

        // --- Stage 0: 根节点 ---
        'atk_s0_root': {
            id: 'atk_s0_root',
            name: '攻击基因',
            desc: '攻击系基因组的起点，决定AI的攻击倾向',
            stage: 0,
            branch: 'attack',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: [],
            effect: { type: 'stat', key: 'aimAccuracy', value: 0.75 }
        },

        // --- Stage 1: 2条路径 ---
        'atk_s1_rapid': {
            id: 'atk_s1_rapid',
            name: '速射路线',
            desc: '走射速提升路线，攻击频率大幅提高',
            stage: 1,
            branch: 'attack',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['atk_s0_root'],
            effect: { type: 'ability', key: 'fireRateBoost', params: { multiplier: 0.65 } }
        },
        'atk_s1_power': {
            id: 'atk_s1_power',
            name: '重炮路线',
            desc: '走单发威力路线，每发子弹伤害巨大',
            stage: 1,
            branch: 'attack',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['atk_s0_root'],
            effect: { type: 'ability', key: 'powerShot', params: { interval: 3, damageMultiplier: 2.5, knockbackMultiplier: 2.0 } }
        },

        // --- Stage 2: 4条路径 ---
        'atk_s2_rapid_barrage': {
            id: 'atk_s2_rapid_barrage',
            name: '弹幕倾泻',
            desc: '进入弹幕模式，连续3秒疯狂发射子弹',
            stage: 2,
            branch: 'attack',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['atk_s1_rapid'],
            effect: { type: 'ability', key: 'barrageFire', params: { duration: 3.0, fireInterval: 0.08, cooldown: 10.0 } }
        },
        'atk_s2_rapid_multi': {
            id: 'atk_s2_rapid_multi',
            name: '三连散射',
            desc: '每次射击发射3颗子弹，呈扇形散开覆盖范围',
            stage: 2,
            branch: 'attack',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['atk_s1_rapid'],
            effect: { type: 'ability', key: 'multiShot', params: { count: 3, spreadAngle: 0.2 } }
        },
        'atk_s2_power_pierce': {
            id: 'atk_s2_power_pierce',
            name: '穿透重弹',
            desc: '子弹穿透一切，不会消失，可以连续命中多个目标',
            stage: 2,
            branch: 'attack',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['atk_s1_power'],
            effect: { type: 'ability', key: 'piercingShot', params: { pierceCount: 3 } }
        },
        'atk_s2_power_explosive': {
            id: 'atk_s2_power_explosive',
            name: '爆裂弹头',
            desc: '子弹命中后产生爆炸，造成范围伤害和额外击退',
            stage: 2,
            branch: 'attack',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['atk_s1_power'],
            effect: { type: 'ability', key: 'explosiveShot', params: { blastRadius: 50, knockbackBonus: 10 } }
        },

        // --- Stage 3: 8条路径 ---
        'atk_s3_omni_barrage': {
            id: 'atk_s3_omni_barrage',
            name: '全方位弹幕',
            desc: '同时向8个方向发射弹幕，覆盖整个战场',
            stage: 3,
            branch: 'attack',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['atk_s2_rapid_barrage'],
            effect: { type: 'ability', key: 'omniBarrage', params: { directions: 8, bulletsPerDir: 4, cooldown: 15.0 } }
        },
        'atk_s3_hyper_speed': {
            id: 'atk_s3_hyper_speed',
            name: '超高速弹',
            desc: '子弹飞行速度翻倍，敌人几乎没有反应时间',
            stage: 3,
            branch: 'attack',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['atk_s2_rapid_barrage'],
            effect: { type: 'ability', key: 'bulletSpeedBoost', params: { multiplier: 2.2 } }
        },
        'atk_s3_spread_storm': {
            id: 'atk_s3_spread_storm',
            name: '散射风暴',
            desc: '每次发射5颗散射子弹，火力覆盖极大范围',
            stage: 3,
            branch: 'attack',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['atk_s2_rapid_multi'],
            effect: { type: 'ability', key: 'multiShot', params: { count: 5, spreadAngle: 0.4 } }
        },
        'atk_s3_homing_swarm': {
            id: 'atk_s3_homing_swarm',
            name: '追踪弹群',
            desc: '所有子弹都具有追踪能力，自动寻找目标',
            stage: 3,
            branch: 'attack',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['atk_s2_rapid_multi'],
            effect: { type: 'ability', key: 'bulletStorm', params: { duration: 5.0, trackingStrength: 0.5, cooldown: 20.0 } }
        },
        'atk_s3_insta_kill': {
            id: 'atk_s3_insta_kill',
            name: '致命一击',
            desc: '10%概率发射瞬杀弹，被命中直接击败',
            stage: 3,
            branch: 'attack',
            pathIndex: 4,
            isBeneficial: true,
            prerequisites: ['atk_s2_power_pierce'],
            effect: { type: 'ability', key: 'instantKill', params: { chance: 0.10, cooldown: 15.0 } }
        },
        'atk_s3_crit_master': {
            id: 'atk_s3_crit_master',
            name: '暴击大师',
            desc: '50%概率发射暴击弹，造成3.5倍伤害',
            stage: 3,
            branch: 'attack',
            pathIndex: 5,
            isBeneficial: true,
            prerequisites: ['atk_s2_power_pierce'],
            effect: { type: 'ability', key: 'criticalShot', params: { chance: 0.5, damageMultiplier: 3.5 } }
        },
        'atk_s3_nuke_shot': {
            id: 'atk_s3_nuke_shot',
            name: '核弹射击',
            desc: '每10发子弹中强化1发为核弹，爆炸范围极大',
            stage: 3,
            branch: 'attack',
            pathIndex: 6,
            isBeneficial: true,
            prerequisites: ['atk_s2_power_explosive'],
            effect: { type: 'ability', key: 'explosiveShot', params: { blastRadius: 120, knockbackBonus: 20, interval: 10 } }
        },
        'atk_s3_weakpoint': {
            id: 'atk_s3_weakpoint',
            name: '弱点锁定',
            desc: '专门瞄准玩家移动方向的提前量，命中率极高',
            stage: 3,
            branch: 'attack',
            pathIndex: 7,
            isBeneficial: true,
            prerequisites: ['atk_s2_power_explosive'],
            effect: { type: 'ability', key: 'weakpointTracking', params: { predictionFactor: 2.0 } }
        },

        // ============================================================
        //  移动系 (movement) - 15个节点
        // ============================================================

        // --- Stage 0: 根节点 ---
        'mov_s0_root': {
            id: 'mov_s0_root',
            name: '移动基因',
            desc: '移动系基因组的起点，决定AI的机动风格',
            stage: 0,
            branch: 'movement',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: [],
            effect: { type: 'stat', key: 'evasionAbility', value: 0.6 }
        },

        // --- Stage 1: 2条路径 ---
        'mov_s1_swift': {
            id: 'mov_s1_swift',
            name: '疾跑路线',
            desc: '走速度提升路线，移动速度大幅增加',
            stage: 1,
            branch: 'movement',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['mov_s0_root'],
            effect: { type: 'ability', key: 'moveSpeedBoost', params: { multiplier: 1.5 } }
        },
        'mov_s1_dodge': {
            id: 'mov_s1_dodge',
            name: '闪避路线',
            desc: '走闪避技巧路线，躲避子弹能力大幅提升',
            stage: 1,
            branch: 'movement',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['mov_s0_root'],
            effect: { type: 'stat', key: 'evasionAbility', value: 0.85 }
        },

        // --- Stage 2: 4条路径 ---
        'mov_s2_burst': {
            id: 'mov_s2_burst',
            name: '瞬间冲刺',
            desc: '可以瞬间爆发冲刺一段距离，留下残影',
            stage: 2,
            branch: 'movement',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['mov_s1_swift'],
            effect: { type: 'ability', key: 'burstDash', params: { distance: 120, cooldown: 2.5, duration: 0.15 } }
        },
        'mov_s2_circle': {
            id: 'mov_s2_circle',
            name: '环绕运动',
            desc: '围绕玩家做圆周运动，持续改变射击角度',
            stage: 2,
            branch: 'movement',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['mov_s1_swift'],
            effect: { type: 'ability', key: 'circleMovement', params: { radius: 100, speed: 2.5 } }
        },
        'mov_s2_blink': {
            id: 'mov_s2_blink',
            name: '瞬移闪现',
            desc: '瞬间传送到附近位置，闪烁消失再出现',
            stage: 2,
            branch: 'movement',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['mov_s1_dodge'],
            effect: { type: 'ability', key: 'blink', params: { range: 130, cooldown: 3.5 } }
        },
        'mov_s2_weave': {
            id: 'mov_s2_weave',
            name: '蛇形走位',
            desc: '移动时采用蛇形路线，子弹极难命中',
            stage: 2,
            branch: 'movement',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['mov_s1_dodge'],
            effect: { type: 'ability', key: 'weaveMovement', params: { frequency: 3.5, amplitude: 45 } }
        },

        // --- Stage 3: 8条路径 ---
        'mov_s3_afterimage': {
            id: 'mov_s3_afterimage',
            name: '分身残影',
            desc: '移动时留下3个残影，严重干扰玩家判断',
            stage: 3,
            branch: 'movement',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['mov_s2_burst'],
            effect: { type: 'ability', key: 'afterimage', params: { count: 3, duration: 1.0, fadeTime: 0.6 } }
        },
        'mov_s3_wallbounce': {
            id: 'mov_s3_wallbounce',
            name: '弹墙大师',
            desc: '撞墙时利用反弹获得额外速度，越弹越快',
            stage: 3,
            branch: 'movement',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['mov_s2_burst'],
            effect: { type: 'ability', key: 'wallBounce', params: { speedBonus: 2.0 } }
        },
        'mov_s3_gravity': {
            id: 'mov_s3_gravity',
            name: '重力牵引',
            desc: '向敌人施加牵引力，缓慢拉近距离',
            stage: 3,
            branch: 'movement',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['mov_s2_circle'],
            effect: { type: 'ability', key: 'gravityPull', params: { force: 4.0, range: 180, duration: 2.5, cooldown: 7.0 } }
        },
        'mov_s3_mirror': {
            id: 'mov_s3_mirror',
            name: '镜像运动',
            desc: '模仿玩家的移动方向进行反向移动，对称走位',
            stage: 3,
            branch: 'movement',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['mov_s2_circle'],
            effect: { type: 'style', key: 'strategyMutation', value: 'mirror_move' }
        },
        'mov_s3_hyper_dodge': {
            id: 'mov_s3_hyper_dodge',
            name: '超光速闪避',
            desc: '被攻击瞬间自动闪避到安全位置，极限反应',
            stage: 3,
            branch: 'movement',
            pathIndex: 4,
            isBeneficial: true,
            prerequisites: ['mov_s2_blink'],
            effect: { type: 'ability', key: 'hyperDodge', params: { triggerRadius: 35, cooldown: 1.5, dodgeDistance: 180 } }
        },
        'mov_s3_phase': {
            id: 'mov_s3_phase',
            name: '相位穿越',
            desc: '可以短暂进入相位状态，穿透墙壁和障碍物',
            stage: 3,
            branch: 'movement',
            pathIndex: 5,
            isBeneficial: true,
            prerequisites: ['mov_s2_blink'],
            effect: { type: 'ability', key: 'phaseWalk', params: { duration: 1.5, cooldown: 12.0, throughWalls: true } }
        },
        'mov_s3_infinite_dodge': {
            id: 'mov_s3_infinite_dodge',
            name: '无限闪避',
            desc: '闪避冷却完全消除，可以连续闪避',
            stage: 3,
            branch: 'movement',
            pathIndex: 6,
            isBeneficial: true,
            prerequisites: ['mov_s2_weave'],
            effect: { type: 'ability', key: 'infiniteDodge', params: { cooldownReduction: 1.0 } }
        },
        'mov_s3_gravity_well': {
            id: 'mov_s3_gravity_well',
            name: '重力力场',
            desc: '在自身位置生成强力重力场，将敌人拉向自己',
            stage: 3,
            branch: 'movement',
            pathIndex: 7,
            isBeneficial: true,
            prerequisites: ['mov_s2_weave'],
            effect: { type: 'ability', key: 'gravityWell', params: { pullForce: 7.0, radius: 160, duration: 3.5, cooldown: 18.0 } }
        },

        // ============================================================
        //  防御系 (defense) - 15个节点
        // ============================================================

        // --- Stage 0: 根节点 ---
        'def_s0_root': {
            id: 'def_s0_root',
            name: '防御基因',
            desc: '防御系基因组的起点，决定AI的生存能力',
            stage: 0,
            branch: 'defense',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: [],
            effect: { type: 'ability', key: 'damageReduction', params: { multiplier: 0.75 } }
        },

        // --- Stage 1: 2条路径 ---
        'def_s1_shield': {
            id: 'def_s1_shield',
            name: '护盾路线',
            desc: '走护盾防御路线，获得能量护盾保护',
            stage: 1,
            branch: 'defense',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['def_s0_root'],
            effect: { type: 'style', key: 'specialTrait', value: 'shield' }
        },
        'def_s1_regen': {
            id: 'def_s1_regen',
            name: '再生路线',
            desc: '走生命恢复路线，缓慢但持续恢复生命值',
            stage: 1,
            branch: 'defense',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['def_s0_root'],
            effect: { type: 'style', key: 'specialTrait', value: 'regen' }
        },

        // --- Stage 2: 4条路径 ---
        'def_s2_reflect': {
            id: 'def_s2_reflect',
            name: '反弹护盾',
            desc: '护盾可以反弹敌方子弹，将伤害还给对手',
            stage: 2,
            branch: 'defense',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['def_s1_shield'],
            effect: { type: 'ability', key: 'reflectShield', params: { reflectChance: 0.7, reflectSpeed: 1.6 } }
        },
        'def_s2_armor': {
            id: 'def_s2_armor',
            name: '重装护甲',
            desc: '获得极厚的护甲，受到的所有伤害额外减免40%',
            stage: 2,
            branch: 'defense',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['def_s1_shield'],
            effect: { type: 'ability', key: 'armorPlating', params: { extraReduction: 0.4 } }
        },
        'def_s2_self_repair': {
            id: 'def_s2_self_repair',
            name: '自修复协议',
            desc: '低血量时自动快速修复，恢复35%最大生命值',
            stage: 2,
            branch: 'defense',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['def_s1_regen'],
            effect: { type: 'ability', key: 'selfRepair', params: { triggerHpPercent: 0.35, healPercent: 0.35, cooldown: 15.0 } }
        },
        'def_s2_shrink': {
            id: 'def_s2_shrink',
            name: '体型缩小',
            desc: '体型缩小40%，变得更难被击中',
            stage: 2,
            branch: 'defense',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['def_s1_regen'],
            effect: { type: 'ability', key: 'sizeShrink', params: { scale: 0.6 } }
        },

        // --- Stage 3: 8条路径 ---
        'def_s3_absolute_defense': {
            id: 'def_s3_absolute_defense',
            name: '绝对防御',
            desc: '进入绝对防御状态3秒，完全免疫所有伤害',
            stage: 3,
            branch: 'defense',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['def_s2_reflect'],
            effect: { type: 'ability', key: 'absoluteDefense', params: { duration: 3.0, cooldown: 22.0 } }
        },
        'def_s3_em_field': {
            id: 'def_s3_em_field',
            name: '电磁护盾',
            desc: '周围生成电磁场，大幅减速靠近的敌方子弹',
            stage: 3,
            branch: 'defense',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['def_s2_reflect'],
            effect: { type: 'ability', key: 'emField', params: { radius: 100, slowFactor: 0.2, duration: 6.0, cooldown: 12.0 } }
        },
        'def_s3_invincible': {
            id: 'def_s3_invincible',
            name: '无敌时刻',
            desc: '受到致命伤害时自动触发2.5秒无敌状态',
            stage: 3,
            branch: 'defense',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['def_s2_armor'],
            effect: { type: 'ability', key: 'invincibility', params: { duration: 2.5, cooldown: 15.0, triggerOnCritical: true } }
        },
        'def_s3_counter': {
            id: 'def_s3_counter',
            name: '防守反击',
            desc: '被攻击后立即进行反击，反击子弹伤害翻2.5倍',
            stage: 3,
            branch: 'defense',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['def_s2_armor'],
            effect: { type: 'ability', key: 'counterAttack', params: { damageMultiplier: 2.5, responseDelay: 0.15 } }
        },
        'def_s3_immortal': {
            id: 'def_s3_immortal',
            name: '不死之身',
            desc: '获得一次免死金牌，被击败时以满血复活一次',
            stage: 3,
            branch: 'defense',
            pathIndex: 4,
            isBeneficial: true,
            prerequisites: ['def_s2_self_repair'],
            effect: { type: 'ability', key: 'immortal', params: { reviveOnce: true, healToFull: true } }
        },
        'def_s3_retribution': {
            id: 'def_s3_retribution',
            name: '反伤领域',
            desc: '周围生成反伤力场，所有伤害的80%反弹给攻击者',
            stage: 3,
            branch: 'defense',
            pathIndex: 5,
            isBeneficial: true,
            prerequisites: ['def_s2_self_repair'],
            effect: { type: 'ability', key: 'retributionField', params: { radius: 90, reflectPercent: 0.8, duration: 5.0, cooldown: 20.0 } }
        },
        'def_s3_stun_immune': {
            id: 'def_s3_stun_immune',
            name: '眩晕免疫',
            desc: '完全免疫眩晕效果，不会被任何攻击击晕',
            stage: 3,
            branch: 'defense',
            pathIndex: 6,
            isBeneficial: true,
            prerequisites: ['def_s2_shrink'],
            effect: { type: 'ability', key: 'stunResistance', params: { reduction: 1.0 } }
        },
        'def_s3_knockback_immune': {
            id: 'def_s3_knockback_immune',
            name: '不屈意志',
            desc: '完全免疫击退效果，稳如泰山纹丝不动',
            stage: 3,
            branch: 'defense',
            pathIndex: 7,
            isBeneficial: true,
            prerequisites: ['def_s2_shrink'],
            effect: { type: 'ability', key: 'knockbackResistance', params: { reduction: 1.0 } }
        },

        // ============================================================
        //  大招系 (ultimate) - 15个节点
        // ============================================================

        // --- Stage 0: 根节点 ---
        'ult_s0_root': {
            id: 'ult_s0_root',
            name: '大招基因',
            desc: '大招系基因组的起点，决定AI的大招风格',
            stage: 0,
            branch: 'ultimate',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: [],
            effect: { type: 'stat', key: 'ultimateAggressiveness', value: 0.6 }
        },

        // --- Stage 1: 2条路径 ---
        'ult_s1_frequency': {
            id: 'ult_s1_frequency',
            name: '高频路线',
            desc: '走高频释放路线，大招冷却大幅缩短',
            stage: 1,
            branch: 'ultimate',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['ult_s0_root'],
            effect: { type: 'ability', key: 'ultCooldownReduce', params: { multiplier: 0.55 } }
        },
        'ult_s1_power': {
            id: 'ult_s1_power',
            name: '威力路线',
            desc: '走威力增强路线，大招范围和伤害大幅提升',
            stage: 1,
            branch: 'ultimate',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['ult_s0_root'],
            effect: { type: 'ability', key: 'ultRangeBoost', params: { multiplier: 1.6 } }
        },

        // --- Stage 2: 4条路径 ---
        'ult_s2_double': {
            id: 'ult_s2_double',
            name: '双重大招',
            desc: '连续释放两次大招，间隔极短',
            stage: 2,
            branch: 'ultimate',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['ult_s1_frequency'],
            effect: { type: 'ability', key: 'doubleUltimate', params: { interval: 0.35, cooldown: 9.0 } }
        },
        'ult_s2_charge': {
            id: 'ult_s2_charge',
            name: '极速蓄力',
            desc: '大招蓄力时间减少75%，几乎瞬间释放',
            stage: 2,
            branch: 'ultimate',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['ult_s1_frequency'],
            effect: { type: 'ability', key: 'ultChargeSpeed', params: { multiplier: 0.25 } }
        },
        'ult_s2_massive': {
            id: 'ult_s2_massive',
            name: '巨型光束',
            desc: '大招风格变为重型，范围极大但释放较慢',
            stage: 2,
            branch: 'ultimate',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['ult_s1_power'],
            effect: { type: 'style', key: 'ultimateStyle', value: 'massive' }
        },
        'ult_s2_tracking': {
            id: 'ult_s2_tracking',
            name: '追踪大招',
            desc: '大招会持续追踪玩家位置，难以躲避',
            stage: 2,
            branch: 'ultimate',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['ult_s1_power'],
            effect: { type: 'ability', key: 'ultTracking', params: { trackingSpeed: 2.5 } }
        },

        // --- Stage 3: 8条路径 ---
        'ult_s3_omni': {
            id: 'ult_s3_omni',
            name: '八方大招',
            desc: '同时向8个方向释放大招，整个战场无处可逃',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['ult_s2_double'],
            effect: { type: 'ability', key: 'omniUltimate', params: { directions: 8, cooldown: 28.0 } }
        },
        'ult_s3_triple': {
            id: 'ult_s3_triple',
            name: '三连大招',
            desc: '连续释放3次大招，每次间隔0.4秒',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['ult_s2_double'],
            effect: { type: 'ability', key: 'tripleUltimate', params: { count: 3, interval: 0.4, cooldown: 14.0 } }
        },
        'ult_s3_infinite': {
            id: 'ult_s3_infinite',
            name: '无限大招',
            desc: '大招冷却大幅缩减，可以连续不断释放大招',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['ult_s2_charge'],
            effect: { type: 'ability', key: 'infiniteUltimate', params: { cooldownReduction: 0.85 } }
        },
        'ult_s3_shield': {
            id: 'ult_s3_shield',
            name: '大招护盾',
            desc: '释放大招时同时获得护盾，攻防一体',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['ult_s2_charge'],
            effect: { type: 'ability', key: 'ultShield', params: { duration: 3.0, damageAbsorb: 0.4 } }
        },
        'ult_s3_mega': {
            id: 'ult_s3_mega',
            name: '超巨型大招',
            desc: '释放覆盖近乎全屏的超巨型大招，宽度极大',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 4,
            isBeneficial: true,
            prerequisites: ['ult_s2_massive'],
            effect: { type: 'ability', key: 'megaUltimate', params: { widthMultiplier: 4.0, lengthMultiplier: 2.5, cooldown: 22.0 } }
        },
        'ult_s3_field': {
            id: 'ult_s3_field',
            name: '大招领域',
            desc: '大招释放后在区域内持续造成伤害4秒',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 5,
            isBeneficial: true,
            prerequisites: ['ult_s2_massive'],
            effect: { type: 'ability', key: 'ultField', params: { duration: 4.0, damagePerTick: 0.08 } }
        },
        'ult_s3_stun': {
            id: 'ult_s3_stun',
            name: '眩晕大招',
            desc: '大招命中后对敌人造成2.5秒眩晕',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 6,
            isBeneficial: true,
            prerequisites: ['ult_s2_tracking'],
            effect: { type: 'ability', key: 'ultStun', params: { stunDuration: 2.5 } }
        },
        'ult_s3_pierce': {
            id: 'ult_s3_pierce',
            name: '贯穿大招',
            desc: '大招可以穿透地图边界继续延伸，出其不意',
            stage: 3,
            branch: 'ultimate',
            pathIndex: 7,
            isBeneficial: true,
            prerequisites: ['ult_s2_tracking'],
            effect: { type: 'ability', key: 'ultPierce', params: { throughWalls: true, rangeBonus: 2.5 } }
        },

        // ============================================================
        //  特殊系 (special) - 15个节点
        // ============================================================

        // --- Stage 0: 根节点 ---
        'spc_s0_root': {
            id: 'spc_s0_root',
            name: '特殊基因',
            desc: '特殊系基因组的起点，决定AI的特殊策略',
            stage: 0,
            branch: 'special',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: [],
            effect: { type: 'stat', key: 'reactionSpeed', value: 0.65 }
        },

        // --- Stage 1: 2条路径 ---
        'spc_s1_aggressive': {
            id: 'spc_s1_aggressive',
            name: '激进路线',
            desc: '走激进进攻路线，AI更加主动凶猛',
            stage: 1,
            branch: 'special',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['spc_s0_root'],
            effect: { type: 'style', key: 'movementStyle', value: 'aggressive' }
        },
        'spc_s1_cunning': {
            id: 'spc_s1_cunning',
            name: '狡诈路线',
            desc: '走狡诈策略路线，AI更加诡计多端',
            stage: 1,
            branch: 'special',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['spc_s0_root'],
            effect: { type: 'style', key: 'strategyMutation', value: 'predictive' }
        },

        // --- Stage 2: 4条路径 ---
        'spc_s2_berserker': {
            id: 'spc_s2_berserker',
            name: '狂暴模式',
            desc: '进入狂暴模式，移速和射速大幅提升但防御降低',
            stage: 2,
            branch: 'special',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['spc_s1_aggressive'],
            effect: { type: 'style', key: 'strategyMutation', value: 'berserker' }
        },
        'spc_s2_chase': {
            id: 'spc_s2_chase',
            name: '死缠烂打',
            desc: '策略变为只追击，持续施压不给喘息机会',
            stage: 2,
            branch: 'special',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['spc_s1_aggressive'],
            effect: { type: 'style', key: 'strategyMutation', value: 'chase_only' }
        },
        'spc_s2_taunt': {
            id: 'spc_s2_taunt',
            name: '挑衅战术',
            desc: '故意露出破绽引诱攻击，然后闪避反击',
            stage: 2,
            branch: 'special',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['spc_s1_cunning'],
            effect: { type: 'ability', key: 'tauntBait', params: { baitDuration: 1.2, counterDamage: 2.5, cooldown: 7.0 } }
        },
        'spc_s2_decoy': {
            id: 'spc_s2_decoy',
            name: '诱饵部署',
            desc: '投放一个诱饵残影，吸引敌方子弹和注意力',
            stage: 2,
            branch: 'special',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['spc_s1_cunning'],
            effect: { type: 'ability', key: 'deployDecoy', params: { decoyDuration: 3.5, cooldown: 9.0, decoyHp: 0.25 } }
        },

        // --- Stage 3: 8条路径 ---
        'spc_s3_momentum': {
            id: 'spc_s3_momentum',
            name: '势不可挡',
            desc: '每次成功命中提升射速和移速，最高叠加6层',
            stage: 3,
            branch: 'special',
            pathIndex: 0,
            isBeneficial: true,
            prerequisites: ['spc_s2_berserker'],
            effect: { type: 'ability', key: 'momentumStack', params: { maxStacks: 6, speedPerStack: 0.18, fireRatePerStack: 0.12 } }
        },
        'spc_s3_swarm': {
            id: 'spc_s3_swarm',
            name: '蜂群意识',
            desc: '所有AI协同行动，从多个方向同时攻击同一目标',
            stage: 3,
            branch: 'special',
            pathIndex: 1,
            isBeneficial: true,
            prerequisites: ['spc_s2_berserker'],
            effect: { type: 'ability', key: 'swarmIntelligence', params: { coordinationRadius: 350, syncAttackDelay: 0.15 } }
        },
        'spc_s3_linear': {
            id: 'spc_s3_linear',
            name: '直线突击',
            desc: '策略变为直线高速冲锋，一击必杀',
            stage: 3,
            branch: 'special',
            pathIndex: 2,
            isBeneficial: true,
            prerequisites: ['spc_s2_chase'],
            effect: { type: 'style', key: 'strategyMutation', value: 'only_linear' }
        },
        'spc_s3_time_slow': {
            id: 'spc_s3_time_slow',
            name: '时间减速',
            desc: '激活时间减速场，在局部区域内减缓敌人速度65%',
            stage: 3,
            branch: 'special',
            pathIndex: 3,
            isBeneficial: true,
            prerequisites: ['spc_s2_chase'],
            effect: { type: 'ability', key: 'timeSlow', params: { radius: 160, slowFactor: 0.35, duration: 4.5, cooldown: 22.0 } }
        },
        'spc_s3_adaptive': {
            id: 'spc_s3_adaptive',
            name: '自适应AI',
            desc: '根据玩家操作习惯实时调整策略，找到玩家弱点',
            stage: 3,
            branch: 'special',
            pathIndex: 4,
            isBeneficial: true,
            prerequisites: ['spc_s2_taunt'],
            effect: { type: 'ability', key: 'adaptiveAI', params: { adaptationSpeed: 6.0, strategySwitchCooldown: 2.5 } }
        },
        'spc_s3_counter': {
            id: 'spc_s3_counter',
            name: '精准反击',
            desc: '完美闪避后立即发射追踪反击弹，伤害极高',
            stage: 3,
            branch: 'special',
            pathIndex: 5,
            isBeneficial: true,
            prerequisites: ['spc_s2_taunt'],
            effect: { type: 'ability', key: 'preciseCounter', params: { counterDamage: 3.0, trackingStrength: 0.9, cooldown: 2.0 } }
        },
        'spc_s3_retreat': {
            id: 'spc_s3_retreat',
            name: '战术撤退',
            desc: '低血量时自动战术撤退，恢复状态后再反击',
            stage: 3,
            branch: 'special',
            pathIndex: 6,
            isBeneficial: true,
            prerequisites: ['spc_s2_decoy'],
            effect: { type: 'ability', key: 'tacticalRetreat', params: { triggerHpPercent: 0.3, fleeSpeed: 2.2, recoverTime: 3.5 } }
        },
        'spc_s3_destiny': {
            id: 'spc_s3_destiny',
            name: '命运预知',
            desc: '预知未来2.5秒的弹道和移动轨迹，完美闪避和反击',
            stage: 3,
            branch: 'special',
            pathIndex: 7,
            isBeneficial: true,
            prerequisites: ['spc_s2_decoy'],
            effect: { type: 'ability', key: 'destinyControl', params: { predictionTime: 2.5, dodgePerfect: true, counterBonus: 3.0, cooldown: 28.0 } }
        },
    },

    // ================================================================
    //  有害突变池（每个阶段的负面效果）
    // ================================================================
    harmfulMutations: {
        0: [
            { key: 'aimAccuracy', value: 0.45, name: '视力下降', desc: '瞄准精度降低，更容易射偏' },
            { key: 'reactionSpeed', value: 0.25, name: '反应迟钝', desc: '反应速度变慢，对威胁响应延迟' },
        ],
        1: [
            { key: 'fireRateBoost', params: { multiplier: 1.3 }, name: '射速下降', desc: '射击间隔增加30%，火力减弱' },
            { key: 'moveSpeedBoost', params: { multiplier: 0.75 }, name: '移动缓慢', desc: '移动速度降低25%，机动性下降' },
        ],
        2: [
            { key: 'damageReduction', params: { multiplier: 1.25 }, name: '脆弱身躯', desc: '受到的伤害增加25%，更加脆弱' },
            { key: 'stunResistance', params: { reduction: -0.3 }, name: '易晕体质', desc: '被击晕时间增加30%，恢复更慢' },
        ],
        3: [
            { key: 'ultCooldownReduce', params: { multiplier: 1.5 }, name: '蓄力迟缓', desc: '大招冷却增加50%，使用频率降低' },
            { key: 'evasionAbility', value: 0.2, name: '闪避退化', desc: '闪避能力大幅降低，更容易被命中' },
        ],
    },

    // ================================================================
    //  阶段定义
    // ================================================================
    stages: {
        0: { name: '基因起点', unlockWins: 0, desc: '基因组的起点，决定基础进化方向' },
        1: { name: '第一分支', unlockWins: 2, desc: '第一次基因分支，选择主要进化路线' },
        2: { name: '第二分支', unlockWins: 6, desc: '第二次基因分支，进化路径进一步分化' },
        3: { name: '终极形态', unlockWins: 12, desc: '基因的终极形态，获得最强的进化能力' },
    },

    // ================================================================
    //  分支定义
    // ================================================================
    branches: {
        attack:  { name: '攻击基因', color: '#ff6b6b', icon: 'sword' },
        movement: { name: '移动基因', color: '#4ecdc4', icon: 'wind' },
        defense:  { name: '防御基因', color: '#95e1a3', icon: 'shield' },
        ultimate: { name: '大招基因', color: '#ffd93d', icon: 'star' },
        special:  { name: '特殊基因', color: '#c084fc', icon: 'eye' },
    },
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
    aimAccuracy: 0.65,
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