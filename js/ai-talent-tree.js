/**
 * AI 天赋树数据结构
 * 
 * 天赋树包含5大分支（攻击/移动/防御/大招/特殊），共4个阶段（Stage 0-3）。
 * 越高阶段的天赋越强，但需要先解锁前置节点。
 * AI 通过积累胜利次数来解锁新的阶段。
 * 
 * 每个天赋效果都经过设计，确保玩家可以明显感知到AI行为的变化。
 * 不包含无意义的微小数值调整。
 */

const AITalentTree = {
    nodes: {

        // ============================================================
        //  攻击系 (attack) - 22个节点
        // ============================================================

        // --- Stage 0: 初始觉醒 - 攻击基础强化 ---
        'atk_s0_rapid_fire': {
            id: 'atk_s0_rapid_fire',
            name: '速射本能',
            desc: 'AI射速大幅提升，子弹发射间隔缩短50%',
            stage: 0,
            branch: 'attack',
            prerequisites: [],
            effect: { type: 'ability', key: 'fireRateBoost', params: { multiplier: 0.5 } }
        },
        'atk_s0_power_shot': {
            id: 'atk_s0_power_shot',
            name: '强力弹',
            desc: '每5发子弹中强化1发，伤害翻倍且击退距离增加',
            stage: 0,
            branch: 'attack',
            prerequisites: [],
            effect: { type: 'ability', key: 'powerShot', params: { interval: 5, damageMultiplier: 2.0, knockbackMultiplier: 2.0 } }
        },
        'atk_s0_precision': {
            id: 'atk_s0_precision',
            name: '精准瞄准',
            desc: 'AI瞄准精度大幅提升至0.95，几乎百发百中',
            stage: 0,
            branch: 'attack',
            prerequisites: [],
            effect: { type: 'stat', key: 'aimAccuracy', value: 0.95 }
        },
        'atk_s0_double_tap': {
            id: 'atk_s0_double_tap',
            name: '双发连射',
            desc: '每次射击自动发射2颗子弹，火力密度翻倍',
            stage: 0,
            branch: 'attack',
            prerequisites: ['atk_s0_rapid_fire'],
            effect: { type: 'ability', key: 'multiShot', params: { count: 2, spreadAngle: 0.05 } }
        },
        'atk_s0_aim_lock': {
            id: 'atk_s0_aim_lock',
            name: '锁定追踪',
            desc: 'AI瞄准时会持续修正方向，子弹飞行途中略微追踪目标',
            stage: 0,
            branch: 'attack',
            prerequisites: ['atk_s0_precision'],
            effect: { type: 'ability', key: 'homingBullet', params: { trackingStrength: 0.3 } }
        },
        'atk_s0_aggressive': {
            id: 'atk_s0_aggressive',
            name: '攻击姿态',
            desc: 'AI更积极寻找射击机会，主动靠近敌人',
            stage: 0,
            branch: 'attack',
            prerequisites: [],
            effect: { type: 'stat', key: 'level', value: 0.7 }
        },

        // --- Stage 1: 进阶强化 - 攻击多样化 ---
        'atk_s1_barrage': {
            id: 'atk_s1_barrage',
            name: '弹幕射击',
            desc: 'AI进入弹幕模式，连续3秒疯狂发射子弹',
            stage: 1,
            branch: 'attack',
            prerequisites: ['atk_s0_rapid_fire', 'atk_s0_aggressive'],
            effect: { type: 'ability', key: 'barrageFire', params: { duration: 3.0, fireInterval: 0.06, cooldown: 8.0 } }
        },
        'atk_s1_weakpoint': {
            id: 'atk_s1_weakpoint',
            name: '弱点追踪',
            desc: 'AI专门瞄准玩家移动方向的提前量位置射击',
            stage: 1,
            branch: 'attack',
            prerequisites: ['atk_s0_precision'],
            effect: { type: 'ability', key: 'weakpointTracking', params: { predictionFactor: 1.5 } }
        },
        'atk_s1_crit': {
            id: 'atk_s1_crit',
            name: '暴击本能',
            desc: '30%概率发射暴击弹，造成3倍伤害',
            stage: 1,
            branch: 'attack',
            prerequisites: ['atk_s0_power_shot'],
            effect: { type: 'ability', key: 'criticalShot', params: { chance: 0.3, damageMultiplier: 3.0 } }
        },
        'atk_s1_suppress': {
            id: 'atk_s1_suppress',
            name: '火力压制',
            desc: 'AI持续向玩家位置密集射击，限制其移动空间',
            stage: 1,
            branch: 'attack',
            prerequisites: ['atk_s0_double_tap', 'atk_s0_aggressive'],
            effect: { type: 'ability', key: 'suppressiveFire', params: { density: 4, coneAngle: 0.6 } }
        },
        'atk_s1_style_rapid': {
            id: 'atk_s1_style_rapid',
            name: '速射风格',
            desc: 'AI切换为速射攻击风格，射速极快但单发伤害较低',
            stage: 1,
            branch: 'attack',
            prerequisites: ['atk_s0_rapid_fire'],
            effect: { type: 'style', key: 'attackStyle', value: 'rapid' }
        },
        'atk_s1_style_heavy': {
            id: 'atk_s1_style_heavy',
            name: '重炮风格',
            desc: 'AI切换为重炮攻击风格，射速慢但每发威力巨大',
            stage: 1,
            branch: 'attack',
            prerequisites: ['atk_s0_power_shot'],
            effect: { type: 'style', key: 'attackStyle', value: 'heavy' }
        },

        // --- Stage 2: 精英突变 - 攻击质变 ---
        'atk_s2_pierce': {
            id: 'atk_s2_pierce',
            name: '穿透弹',
            desc: '子弹穿透一切，不会消失，可以连续命中',
            stage: 2,
            branch: 'attack',
            prerequisites: ['atk_s1_crit', 'atk_s0_power_shot'],
            effect: { type: 'ability', key: 'piercingShot', params: { pierceCount: 3 } }
        },
        'atk_s2_triple_shot': {
            id: 'atk_s2_triple_shot',
            name: '三连散射',
            desc: '每次射击发射3颗子弹，呈扇形散开',
            stage: 2,
            branch: 'attack',
            prerequisites: ['atk_s1_barrage', 'atk_s0_double_tap'],
            effect: { type: 'ability', key: 'multiShot', params: { count: 3, spreadAngle: 0.25 } }
        },
        'atk_s2_bullet_speed': {
            id: 'atk_s2_bullet_speed',
            name: '超高速弹',
            desc: '子弹飞行速度翻倍，敌人几乎没有反应时间',
            stage: 2,
            branch: 'attack',
            prerequisites: ['atk_s1_weakpoint', 'atk_s0_aim_lock'],
            effect: { type: 'ability', key: 'bulletSpeedBoost', params: { multiplier: 2.0 } }
        },
        'atk_s2_explosive': {
            id: 'atk_s2_explosive',
            name: '爆裂弹',
            desc: '子弹命中后产生爆炸，造成范围伤害和额外击退',
            stage: 2,
            branch: 'attack',
            prerequisites: ['atk_s1_crit', 'atk_s0_power_shot'],
            effect: { type: 'ability', key: 'explosiveShot', params: { blastRadius: 60, knockbackBonus: 8 } }
        },
        'atk_s2_style_spread': {
            id: 'atk_s2_style_spread',
            name: '散射风格',
            desc: 'AI切换为散射攻击风格，每次攻击覆盖更大范围',
            stage: 2,
            branch: 'attack',
            prerequisites: ['atk_s2_triple_shot'],
            effect: { type: 'style', key: 'attackStyle', value: 'spread' }
        },
        'atk_s2_chase': {
            id: 'atk_s2_chase',
            name: '追猎模式',
            desc: 'AI进入追猎策略，只追击不退缩，持续施压',
            stage: 2,
            branch: 'attack',
            prerequisites: ['atk_s1_suppress', 'atk_s0_aggressive'],
            effect: { type: 'style', key: 'strategyMutation', value: 'chase_only' }
        },

        // --- Stage 3: 终极进化 - 攻击极致 ---
        'atk_s3_omni_barrage': {
            id: 'atk_s3_omni_barrage',
            name: '全方位弹幕',
            desc: '同时向8个方向发射弹幕，覆盖整个战场',
            stage: 3,
            branch: 'attack',
            prerequisites: ['atk_s2_triple_shot', 'atk_s2_bullet_speed', 'atk_s2_pierce'],
            effect: { type: 'ability', key: 'omniBarrage', params: { directions: 8, bulletsPerDir: 5, cooldown: 12.0 } }
        },
        'atk_s3_insta_kill': {
            id: 'atk_s3_insta_kill',
            name: '致命一击',
            desc: '10%概率发射瞬杀弹，被命中直接击败（无视护盾）',
            stage: 3,
            branch: 'attack',
            prerequisites: ['atk_s2_explosive', 'atk_s1_crit', 'atk_s1_weakpoint'],
            effect: { type: 'ability', key: 'instantKill', params: { chance: 0.10, cooldown: 15.0 } }
        },
        'atk_s3_bullet_storm': {
            id: 'atk_s3_bullet_storm',
            name: '子弹风暴',
            desc: '持续发射追踪弹幕，所有子弹都具有追踪能力',
            stage: 3,
            branch: 'attack',
            prerequisites: ['atk_s2_pierce', 'atk_s0_aim_lock', 'atk_s2_bullet_speed'],
            effect: { type: 'ability', key: 'bulletStorm', params: { duration: 4.0, trackingStrength: 0.6, cooldown: 18.0 } }
        },

        // ============================================================
        //  移动系 (movement) - 21个节点
        // ============================================================

        // --- Stage 0: 初始觉醒 - 移动基础强化 ---
        'mov_s0_swift': {
            id: 'mov_s0_swift',
            name: '疾风步',
            desc: 'AI移动速度提升50%，更加灵活',
            stage: 0,
            branch: 'movement',
            prerequisites: [],
            effect: { type: 'ability', key: 'moveSpeedBoost', params: { multiplier: 1.5 } }
        },
        'mov_s0_dodge': {
            id: 'mov_s0_dodge',
            name: '闪避直觉',
            desc: 'AI闪避能力大幅提升至0.9，能躲避大部分攻击',
            stage: 0,
            branch: 'movement',
            prerequisites: [],
            effect: { type: 'stat', key: 'evasionAbility', value: 0.9 }
        },
        'mov_s0_reaction': {
            id: 'mov_s0_reaction',
            name: '闪电反应',
            desc: 'AI反应速度提升至0.85，对威胁做出快速响应',
            stage: 0,
            branch: 'movement',
            prerequisites: [],
            effect: { type: 'stat', key: 'reactionSpeed', value: 0.85 }
        },
        'mov_s0_dash': {
            id: 'mov_s0_dash',
            name: '冲刺闪避',
            desc: 'AI获得冲刺特性，可以快速短距离冲刺来躲避攻击',
            stage: 0,
            branch: 'movement',
            prerequisites: ['mov_s0_dodge'],
            effect: { type: 'style', key: 'specialTrait', value: 'dash' }
        },
        'mov_s0_orbit': {
            id: 'mov_s0_orbit',
            name: '环绕走位',
            desc: 'AI绕着敌人环绕移动，保持距离的同时不断变换角度',
            stage: 0,
            branch: 'movement',
            prerequisites: ['mov_s0_swift'],
            effect: { type: 'style', key: 'movementStyle', value: 'weaving' }
        },

        // --- Stage 1: 进阶强化 - 移动技巧化 ---
        'mov_s1_weave': {
            id: 'mov_s1_weave',
            name: '蛇形走位',
            desc: 'AI移动时采用蛇形路线，子弹极难命中',
            stage: 1,
            branch: 'movement',
            prerequisites: ['mov_s0_orbit', 'mov_s0_dodge'],
            effect: { type: 'ability', key: 'weaveMovement', params: { frequency: 3.0, amplitude: 40 } }
        },
        'mov_s1_burst': {
            id: 'mov_s1_burst',
            name: '瞬间冲刺',
            desc: 'AI可以瞬间爆发冲刺一段距离，留下残影',
            stage: 1,
            branch: 'movement',
            prerequisites: ['mov_s0_dash', 'mov_s0_swift'],
            effect: { type: 'ability', key: 'burstDash', params: { distance: 120, cooldown: 2.0, duration: 0.15 } }
        },
        'mov_s1_circle': {
            id: 'mov_s1_circle',
            name: '环绕运动',
            desc: 'AI围绕玩家做圆周运动，持续改变射击角度',
            stage: 1,
            branch: 'movement',
            prerequisites: ['mov_s0_orbit'],
            effect: { type: 'ability', key: 'circleMovement', params: { radius: 100, speed: 2.5 } }
        },
        'mov_s1_aggressive_move': {
            id: 'mov_s1_aggressive_move',
            name: '激进冲锋',
            desc: 'AI移动风格变为激进，快速逼近敌人',
            stage: 1,
            branch: 'movement',
            prerequisites: ['mov_s0_swift'],
            effect: { type: 'style', key: 'movementStyle', value: 'aggressive' }
        },
        'mov_s1_predict': {
            id: 'mov_s1_predict',
            name: '弹道预判',
            desc: 'AI能预判敌方弹道方向，提前闪避',
            stage: 1,
            branch: 'movement',
            prerequisites: ['mov_s0_reaction', 'mov_s0_dodge'],
            effect: { type: 'style', key: 'strategyMutation', value: 'predictive' }
        },
        'mov_s1_defensive_move': {
            id: 'mov_s1_defensive_move',
            name: '保守撤退',
            desc: 'AI移动风格变为保守，保持安全距离',
            stage: 1,
            branch: 'movement',
            prerequisites: ['mov_s0_dodge'],
            effect: { type: 'style', key: 'movementStyle', value: 'defensive' }
        },

        // --- Stage 2: 精英突变 - 移动质变 ---
        'mov_s2_afterimage': {
            id: 'mov_s2_afterimage',
            name: '分身残影',
            desc: 'AI移动时留下2个残影，干扰玩家判断',
            stage: 2,
            branch: 'movement',
            prerequisites: ['mov_s1_burst', 'mov_s1_weave'],
            effect: { type: 'ability', key: 'afterimage', params: { count: 2, duration: 0.8, fadeTime: 0.5 } }
        },
        'mov_s2_blink': {
            id: 'mov_s2_blink',
            name: '瞬移闪现',
            desc: 'AI瞬间传送到附近位置，闪烁消失再出现',
            stage: 2,
            branch: 'movement',
            prerequisites: ['mov_s1_burst', 'mov_s0_reaction'],
            effect: { type: 'ability', key: 'blink', params: { range: 150, cooldown: 3.0 } }
        },
        'mov_s2_gravity': {
            id: 'mov_s2_gravity',
            name: '重力牵引',
            desc: 'AI向敌人施加牵引力，缓慢拉近距离',
            stage: 2,
            branch: 'movement',
            prerequisites: ['mov_s1_circle', 'mov_s1_aggressive_move'],
            effect: { type: 'ability', key: 'gravityPull', params: { force: 3.0, range: 200, duration: 2.0, cooldown: 6.0 } }
        },
        'mov_s2_wallbounce': {
            id: 'mov_s2_wallbounce',
            name: '弹墙技巧',
            desc: 'AI撞墙时利用反弹获得额外速度',
            stage: 2,
            branch: 'movement',
            prerequisites: ['mov_s1_burst', 'mov_s0_swift'],
            effect: { type: 'ability', key: 'wallBounce', params: { speedBonus: 1.8 } }
        },
        'mov_s2_mirrorman': {
            id: 'mov_s2_mirrorman',
            name: '镜像移动',
            desc: 'AI模仿玩家的移动方向进行反向移动，对称走位',
            stage: 2,
            branch: 'movement',
            prerequisites: ['mov_s1_predict', 'mov_s1_circle'],
            effect: { type: 'style', key: 'strategyMutation', value: 'mirror_move' }
        },

        // --- Stage 3: 终极进化 - 移动极致 ---
        'mov_s3_hyper_speed': {
            id: 'mov_s3_hyper_speed',
            name: '超光速闪避',
            desc: 'AI获得极限闪避能力，被攻击瞬间自动闪避到安全位置',
            stage: 3,
            branch: 'movement',
            prerequisites: ['mov_s2_blink', 'mov_s2_afterimage', 'mov_s0_dodge'],
            effect: { type: 'ability', key: 'hyperDodge', params: { triggerRadius: 30, cooldown: 1.5, dodgeDistance: 200 } }
        },
        'mov_s3_phase': {
            id: 'mov_s3_phase',
            name: '相位穿越',
            desc: 'AI可以短暂进入相位状态，穿透墙壁和障碍物',
            stage: 3,
            branch: 'movement',
            prerequisites: ['mov_s2_blink', 'mov_s2_wallbounce', 'mov_s1_burst'],
            effect: { type: 'ability', key: 'phaseWalk', params: { duration: 1.5, cooldown: 10.0, throughWalls: true } }
        },
        'mov_s3_infinite_dodge': {
            id: 'mov_s3_infinite_dodge',
            name: '无限闪避',
            desc: '闪避冷却完全消除，AI可以连续闪避',
            stage: 3,
            branch: 'movement',
            prerequisites: ['mov_s2_afterimage', 'mov_s2_blink', 'mov_s1_weave'],
            effect: { type: 'ability', key: 'infiniteDodge', params: { cooldownReduction: 1.0 } }
        },
        'mov_s3_gravity_well': {
            id: 'mov_s3_gravity_well',
            name: '重力力场',
            desc: 'AI在自身位置生成强力重力场，将敌人拉向自己同时快速环绕射击',
            stage: 3,
            branch: 'movement',
            prerequisites: ['mov_s2_gravity', 'mov_s2_afterimage', 'mov_s1_circle'],
            effect: { type: 'ability', key: 'gravityWell', params: { pullForce: 6.0, radius: 180, duration: 3.0, cooldown: 15.0 } }
        },

        // ============================================================
        //  防御系 (defense) - 21个节点
        // ============================================================

        // --- Stage 0: 初始觉醒 - 防御基础强化 ---
        'def_s0_shield': {
            id: 'def_s0_shield',
            name: '能量护盾',
            desc: 'AI获得护盾特性，可以生成防御护盾',
            stage: 0,
            branch: 'defense',
            prerequisites: [],
            effect: { type: 'style', key: 'specialTrait', value: 'shield' }
        },
        'def_s0_damage_reduce': {
            id: 'def_s0_damage_reduce',
            name: '坚韧体魄',
            desc: 'AI受到的伤害减少50%，更加耐打',
            stage: 0,
            branch: 'defense',
            prerequisites: [],
            effect: { type: 'ability', key: 'damageReduction', params: { multiplier: 0.5 } }
        },
        'def_s0_regen': {
            id: 'def_s0_regen',
            name: '快速再生',
            desc: 'AI获得再生特性，缓慢恢复生命值',
            stage: 0,
            branch: 'defense',
            prerequisites: [],
            effect: { type: 'style', key: 'specialTrait', value: 'regen' }
        },
        'def_s0_stun_resist': {
            id: 'def_s0_stun_resist',
            name: '抗晕体质',
            desc: 'AI被击晕的时间减少60%，更快恢复',
            stage: 0,
            branch: 'defense',
            prerequisites: [],
            effect: { type: 'ability', key: 'stunResistance', params: { reduction: 0.6 } }
        },
        'def_s0_knockback_resist': {
            id: 'def_s0_knockback_resist',
            name: '稳如泰山',
            desc: 'AI受到的击退效果减少50%，不易被打飞',
            stage: 0,
            branch: 'defense',
            prerequisites: [],
            effect: { type: 'ability', key: 'knockbackResistance', params: { reduction: 0.5 } }
        },

        // --- Stage 1: 进阶强化 - 防御主动化 ---
        'def_s1_reflect': {
            id: 'def_s1_reflect',
            name: '反弹护盾',
            desc: 'AI的护盾可以反弹敌方子弹，将伤害还给对手',
            stage: 1,
            branch: 'defense',
            prerequisites: ['def_s0_shield'],
            effect: { type: 'ability', key: 'reflectShield', params: { reflectChance: 0.6, reflectSpeed: 1.5 } }
        },
        'def_s1_regen_boost': {
            id: 'def_s1_regen_boost',
            name: '持续再生',
            desc: 'AI再生速度大幅提升，每秒恢复大量生命值',
            stage: 1,
            branch: 'defense',
            prerequisites: ['def_s0_regen'],
            effect: { type: 'ability', key: 'regenBoost', params: { hpPerSecond: 0.08 } }
        },
        'def_s1_shrink': {
            id: 'def_s1_shrink',
            name: '体型缩小',
            desc: 'AI体型缩小40%，变得更难被击中',
            stage: 1,
            branch: 'defense',
            prerequisites: ['def_s0_damage_reduce'],
            effect: { type: 'ability', key: 'sizeShrink', params: { scale: 0.6 } }
        },
        'def_s1_turtle': {
            id: 'def_s1_turtle',
            name: '缩壳防御',
            desc: 'AI进入缩壳策略，待在角落防守，只在大招准备好时出击',
            stage: 1,
            branch: 'defense',
            prerequisites: ['def_s0_shield', 'def_s0_stun_resist'],
            effect: { type: 'style', key: 'strategyMutation', value: 'turtle' }
        },
        'def_s1_defensive_move': {
            id: 'def_s1_defensive_move',
            name: '防守走位',
            desc: 'AI移动风格变为保守，始终与敌人保持距离',
            stage: 1,
            branch: 'defense',
            prerequisites: ['def_s0_damage_reduce'],
            effect: { type: 'style', key: 'movementStyle', value: 'defensive' }
        },

        // --- Stage 2: 精英突变 - 防御质变 ---
        'def_s2_invincible': {
            id: 'def_s2_invincible',
            name: '无敌时刻',
            desc: 'AI在受到致命伤害时自动触发2秒无敌状态',
            stage: 2,
            branch: 'defense',
            prerequisites: ['def_s1_reflect', 'def_s0_stun_resist'],
            effect: { type: 'ability', key: 'invincibility', params: { duration: 2.0, cooldown: 12.0, triggerOnCritical: true } }
        },
        'def_s2_em_field': {
            id: 'def_s2_em_field',
            name: '电磁护盾',
            desc: 'AI周围生成电磁场，减速靠近的敌方子弹',
            stage: 2,
            branch: 'defense',
            prerequisites: ['def_s1_reflect', 'def_s0_shield'],
            effect: { type: 'ability', key: 'emField', params: { radius: 80, slowFactor: 0.3, duration: 5.0, cooldown: 10.0 } }
        },
        'def_s2_self_repair': {
            id: 'def_s2_self_repair',
            name: '自修复协议',
            desc: 'AI在低血量时自动快速修复，恢复30%最大生命值',
            stage: 2,
            branch: 'defense',
            prerequisites: ['def_s1_regen_boost', 'def_s0_regen'],
            effect: { type: 'ability', key: 'selfRepair', params: { triggerHpPercent: 0.3, healPercent: 0.3, cooldown: 15.0 } }
        },
        'def_s2_armor': {
            id: 'def_s2_armor',
            name: '重装护甲',
            desc: 'AI获得极厚的护甲，受到的所有伤害额外减免40%',
            stage: 2,
            branch: 'defense',
            prerequisites: ['def_s1_shrink', 'def_s0_damage_reduce'],
            effect: { type: 'ability', key: 'armorPlating', params: { extraReduction: 0.4 } }
        },
        'def_s2_counter': {
            id: 'def_s2_counter',
            name: '防守反击',
            desc: 'AI在被攻击后立即进行反击，反击子弹伤害翻倍',
            stage: 2,
            branch: 'defense',
            prerequisites: ['def_s1_reflect', 'def_s0_knockback_resist'],
            effect: { type: 'ability', key: 'counterAttack', params: { damageMultiplier: 2.0, responseDelay: 0.2 } }
        },

        // --- Stage 3: 终极进化 - 防御极致 ---
        'def_s3_immortal': {
            id: 'def_s3_immortal',
            name: '不死之身',
            desc: 'AI获得一次免死金牌，被击败时以满血复活一次',
            stage: 3,
            branch: 'defense',
            prerequisites: ['def_s2_invincible', 'def_s2_self_repair', 'def_s2_armor'],
            effect: { type: 'ability', key: 'immortal', params: { reviveOnce: true, healToFull: true } }
        },
        'def_s3_absolute_defense': {
            id: 'def_s3_absolute_defense',
            name: '绝对防御',
            desc: 'AI进入绝对防御状态3秒，完全免疫所有伤害',
            stage: 3,
            branch: 'defense',
            prerequisites: ['def_s2_em_field', 'def_s2_invincible', 'def_s2_armor'],
            effect: { type: 'ability', key: 'absoluteDefense', params: { duration: 3.0, cooldown: 20.0 } }
        },
        'def_s3_retribution': {
            id: 'def_s3_retribution',
            name: '反伤领域',
            desc: 'AI周围生成反伤力场，所有伤害的100%反弹给攻击者',
            stage: 3,
            branch: 'defense',
            prerequisites: ['def_s2_counter', 'def_s2_em_field', 'def_s1_reflect'],
            effect: { type: 'ability', key: 'retributionField', params: { radius: 100, reflectPercent: 1.0, duration: 5.0, cooldown: 18.0 } }
        },

        // ============================================================
        //  大招系 (ultimate) - 21个节点
        // ============================================================

        // --- Stage 0: 初始觉醒 - 大招基础强化 ---
        'ult_s0_cd_reduce': {
            id: 'ult_s0_cd_reduce',
            name: '快速蓄力',
            desc: 'AI大招冷却时间减少50%，更频繁使用大招',
            stage: 0,
            branch: 'ultimate',
            prerequisites: [],
            effect: { type: 'ability', key: 'ultCooldownReduce', params: { multiplier: 0.5 } }
        },
        'ult_s0_range_up': {
            id: 'ult_s0_range_up',
            name: '延伸射线',
            desc: 'AI大招射线长度增加80%，覆盖更远距离',
            stage: 0,
            branch: 'ultimate',
            prerequisites: [],
            effect: { type: 'ability', key: 'ultRangeBoost', params: { multiplier: 1.8 } }
        },
        'ult_s0_aggressive': {
            id: 'ult_s0_aggressive',
            name: '积极放大招',
            desc: 'AI更积极使用大招，大招积极性大幅提升至0.8',
            stage: 0,
            branch: 'ultimate',
            prerequisites: [],
            effect: { type: 'stat', key: 'ultimateAggressiveness', value: 0.8 }
        },
        'ult_s0_width_up': {
            id: 'ult_s0_width_up',
            name: '宽幅光束',
            desc: 'AI大招光束宽度翻倍，更容易命中',
            stage: 0,
            branch: 'ultimate',
            prerequisites: [],
            effect: { type: 'ability', key: 'ultWidthBoost', params: { multiplier: 2.0 } }
        },
        'ult_s0_quick': {
            id: 'ult_s0_quick',
            name: '迅捷大招',
            desc: 'AI大招风格变为迅捷，更快释放但范围较小',
            stage: 0,
            branch: 'ultimate',
            prerequisites: ['ult_s0_cd_reduce'],
            effect: { type: 'style', key: 'ultimateStyle', value: 'quick' }
        },

        // --- Stage 1: 进阶强化 - 大招多样化 ---
        'ult_s1_double': {
            id: 'ult_s1_double',
            name: '双重大招',
            desc: 'AI连续释放两次大招，间隔极短',
            stage: 1,
            branch: 'ultimate',
            prerequisites: ['ult_s0_cd_reduce', 'ult_s0_aggressive'],
            effect: { type: 'ability', key: 'doubleUltimate', params: { interval: 0.3, cooldown: 8.0 } }
        },
        'ult_s1_charge_speed': {
            id: 'ult_s1_charge_speed',
            name: '蓄力加速',
            desc: 'AI大招蓄力时间减少70%，几乎瞬间释放',
            stage: 1,
            branch: 'ultimate',
            prerequisites: ['ult_s0_cd_reduce'],
            effect: { type: 'ability', key: 'ultChargeSpeed', params: { multiplier: 0.3 } }
        },
        'ult_s1_tracking': {
            id: 'ult_s1_tracking',
            name: '追踪大招',
            desc: 'AI大招会缓慢追踪玩家位置',
            stage: 1,
            branch: 'ultimate',
            prerequisites: ['ult_s0_range_up'],
            effect: { type: 'ability', key: 'ultTracking', params: { trackingSpeed: 2.0 } }
        },
        'ult_s1_massive': {
            id: 'ult_s1_massive',
            name: '巨型大招',
            desc: 'AI大招风格变为重型，范围极大但释放较慢',
            stage: 1,
            branch: 'ultimate',
            prerequisites: ['ult_s0_range_up', 'ult_s0_width_up'],
            effect: { type: 'style', key: 'ultimateStyle', value: 'massive' }
        },
        'ult_s1_multi': {
            id: 'ult_s1_multi',
            name: '多发大招',
            desc: 'AI大招风格变为多发，一次释放3道较窄的光束',
            stage: 1,
            branch: 'ultimate',
            prerequisites: ['ult_s0_width_up'],
            effect: { type: 'style', key: 'ultimateStyle', value: 'multi' }
        },
        'ult_s1_ult_only': {
            id: 'ult_s1_ult_only',
            name: '大招专精',
            desc: 'AI策略变为只放大招，放弃普通攻击全力蓄力',
            stage: 1,
            branch: 'ultimate',
            prerequisites: ['ult_s0_aggressive', 'ult_s0_cd_reduce'],
            effect: { type: 'style', key: 'strategyMutation', value: 'only_ultimate' }
        },

        // --- Stage 2: 精英突变 - 大招质变 ---
        'ult_s2_triple': {
            id: 'ult_s2_triple',
            name: '三连大招',
            desc: 'AI连续释放3次大招，每次间隔0.5秒',
            stage: 2,
            branch: 'ultimate',
            prerequisites: ['ult_s1_double', 'ult_s1_charge_speed'],
            effect: { type: 'ability', key: 'tripleUltimate', params: { count: 3, interval: 0.5, cooldown: 12.0 } }
        },
        'ult_s2_field': {
            id: 'ult_s2_field',
            name: '大招领域',
            desc: 'AI大招释放后在大招区域内持续造成伤害3秒',
            stage: 2,
            branch: 'ultimate',
            prerequisites: ['ult_s1_massive', 'ult_s0_width_up'],
            effect: { type: 'ability', key: 'ultField', params: { duration: 3.0, damagePerTick: 0.1 } }
        },
        'ult_s2_shield': {
            id: 'ult_s2_shield',
            name: '大招护盾',
            desc: '释放大招时AI同时获得护盾，攻防一体',
            stage: 2,
            branch: 'ultimate',
            prerequisites: ['ult_s1_double', 'ult_s0_aggressive'],
            effect: { type: 'ability', key: 'ultShield', params: { duration: 2.0, damageAbsorb: 0.3 } }
        },
        'ult_s2_stun_ult': {
            id: 'ult_s2_stun_ult',
            name: '眩晕大招',
            desc: 'AI大招命中后对敌人造成2秒眩晕',
            stage: 2,
            branch: 'ultimate',
            prerequisites: ['ult_s1_tracking', 'ult_s0_range_up'],
            effect: { type: 'ability', key: 'ultStun', params: { stunDuration: 2.0 } }
        },
        'ult_s2_pierce_ult': {
            id: 'ult_s2_pierce_ult',
            name: '贯穿大招',
            desc: 'AI大招可以穿过地图边界继续延伸',
            stage: 2,
            branch: 'ultimate',
            prerequisites: ['ult_s1_tracking', 'ult_s0_range_up'],
            effect: { type: 'ability', key: 'ultPierce', params: { throughWalls: true, rangeBonus: 2.0 } }
        },

        // --- Stage 3: 终极进化 - 大招极致 ---
        'ult_s3_omni_ult': {
            id: 'ult_s3_omni_ult',
            name: '大招散射',
            desc: 'AI同时向8个方向释放大招，整个战场无处可逃',
            stage: 3,
            branch: 'ultimate',
            prerequisites: ['ult_s2_triple', 'ult_s2_field', 'ult_s1_multi'],
            effect: { type: 'ability', key: 'omniUltimate', params: { directions: 8, cooldown: 25.0 } }
        },
        'ult_s3_mega_ult': {
            id: 'ult_s3_mega_ult',
            name: '超大型大招',
            desc: '释放覆盖全屏的超巨型大招，宽度极大',
            stage: 3,
            branch: 'ultimate',
            prerequisites: ['ult_s2_field', 'ult_s2_pierce_ult', 'ult_s1_massive'],
            effect: { type: 'ability', key: 'megaUltimate', params: { widthMultiplier: 5.0, lengthMultiplier: 3.0, cooldown: 20.0 } }
        },
        'ult_s3_infinite_ult': {
            id: 'ult_s3_infinite_ult',
            name: '无限大招',
            desc: 'AI大招冷却完全消除，可以连续不断释放大招',
            stage: 3,
            branch: 'ultimate',
            prerequisites: ['ult_s2_triple', 'ult_s2_shield', 'ult_s1_charge_speed'],
            effect: { type: 'ability', key: 'infiniteUltimate', params: { cooldownReduction: 1.0 } }
        },

        // ============================================================
        //  特殊系 (special) - 21个节点
        // ============================================================

        // --- Stage 0: 初始觉醒 - 特殊基础 ---
        'spc_s0_predict': {
            id: 'spc_s0_predict',
            name: '预判走位',
            desc: 'AI策略变为预判走位，提前移动到玩家将要到达的位置',
            stage: 0,
            branch: 'special',
            prerequisites: [],
            effect: { type: 'style', key: 'strategyMutation', value: 'predictive' }
        },
        'spc_s0_mirror': {
            id: 'spc_s0_mirror',
            name: '镜像移动',
            desc: 'AI策略变为镜像移动，模仿玩家的操作',
            stage: 0,
            branch: 'special',
            prerequisites: [],
            effect: { type: 'style', key: 'strategyMutation', value: 'mirror_move' }
        },
        'spc_s0_berserker': {
            id: 'spc_s0_berserker',
            name: '狂暴模式',
            desc: 'AI进入狂暴模式，移速和射速大幅提升但防御降低',
            stage: 0,
            branch: 'special',
            prerequisites: [],
            effect: { type: 'style', key: 'strategyMutation', value: 'berserker' }
        },
        'spc_s0_corner': {
            id: 'spc_s0_corner',
            name: '角落战术',
            desc: 'AI策略变为守角落，利用地形优势防守反击',
            stage: 0,
            branch: 'special',
            prerequisites: [],
            effect: { type: 'style', key: 'strategyMutation', value: 'stay_corner' }
        },
        'spc_s0_chase_only': {
            id: 'spc_s0_chase_only',
            name: '死缠烂打',
            desc: 'AI策略变为只追击，不射击只靠近',
            stage: 0,
            branch: 'special',
            prerequisites: [],
            effect: { type: 'style', key: 'strategyMutation', value: 'chase_only' }
        },

        // --- Stage 1: 进阶强化 - 特殊技巧化 ---
        'spc_s1_reverse': {
            id: 'spc_s1_reverse',
            name: '反向操控',
            desc: 'AI采用反向移动策略，朝玩家预判的反方向移动',
            stage: 1,
            branch: 'special',
            prerequisites: ['spc_s0_predict'],
            effect: { type: 'ability', key: 'reverseControl', params: { predictionMultiplier: -1.0 } }
        },
        'spc_s1_terrain': {
            id: 'spc_s1_terrain',
            name: '地形利用',
            desc: 'AI利用墙壁弹射子弹，从刁钻角度攻击',
            stage: 1,
            branch: 'special',
            prerequisites: ['spc_s0_corner'],
            effect: { type: 'ability', key: 'terrainBounce', params: { bounceCount: 2, damageRetention: 0.8 } }
        },
        'spc_s1_bullet_dodge': {
            id: 'spc_s1_bullet_dodge',
            name: '弹道闪避专精',
            desc: 'AI专门优化子弹闪避，能看到所有子弹并精确躲避',
            stage: 1,
            branch: 'special',
            prerequisites: ['spc_s0_predict'],
            effect: { type: 'ability', key: 'bulletDodgeExpert', params: { detectionRange: 200, dodgePrecision: 0.95 } }
        },
        'spc_s1_linear': {
            id: 'spc_s1_linear',
            name: '直线突击',
            desc: 'AI策略变为直线移动，高速冲向敌人',
            stage: 1,
            branch: 'special',
            prerequisites: ['spc_s0_chase_only'],
            effect: { type: 'style', key: 'strategyMutation', value: 'only_linear' }
        },
        'spc_s1_taunt': {
            id: 'spc_s1_taunt',
            name: '挑衅战术',
            desc: 'AI故意露出破绽引诱玩家攻击，然后闪避反击',
            stage: 1,
            branch: 'special',
            prerequisites: ['spc_s0_mirror', 'spc_s0_predict'],
            effect: { type: 'ability', key: 'tauntBait', params: { baitDuration: 1.0, counterDamage: 2.0, cooldown: 6.0 } }
        },

        // --- Stage 2: 精英突变 - 特殊质变 ---
        'spc_s2_swarm': {
            id: 'spc_s2_swarm',
            name: '集体意识',
            desc: '所有AI协同行动，从多个方向同时攻击同一目标',
            stage: 2,
            branch: 'special',
            prerequisites: ['spc_s1_reverse', 'spc_s1_terrain'],
            effect: { type: 'ability', key: 'swarmIntelligence', params: { coordinationRadius: 300, syncAttackDelay: 0.2 } }
        },
        'spc_s2_retreat': {
            id: 'spc_s2_retreat',
            name: '战术撤退',
            desc: 'AI低血量时自动战术撤退，恢复状态后再反击',
            stage: 2,
            branch: 'special',
            prerequisites: ['spc_s1_bullet_dodge', 'spc_s0_predict'],
            effect: { type: 'ability', key: 'tacticalRetreat', params: { triggerHpPercent: 0.25, fleeSpeed: 2.0, recoverTime: 4.0 } }
        },
        'spc_s2_counter': {
            id: 'spc_s2_counter',
            name: '精准反击',
            desc: 'AI完美闪避后立即发射追踪反击弹',
            stage: 2,
            branch: 'special',
            prerequisites: ['spc_s1_bullet_dodge', 'spc_s1_taunt'],
            effect: { type: 'ability', key: 'preciseCounter', params: { counterDamage: 2.5, trackingStrength: 0.8, cooldown: 2.0 } }
        },
        'spc_s2_decoy': {
            id: 'spc_s2_decoy',
            name: '诱饵部署',
            desc: 'AI投放一个诱饵残影，吸引敌方子弹和注意力',
            stage: 2,
            branch: 'special',
            prerequisites: ['spc_s1_taunt', 'spc_s0_mirror'],
            effect: { type: 'ability', key: 'deployDecoy', params: { decoyDuration: 3.0, cooldown: 8.0, decoyHp: 0.2 } }
        },
        'spc_s2_momentum': {
            id: 'spc_s2_momentum',
            name: '势头积累',
            desc: 'AI每次成功命中都会提升射速和移速，最高叠加5层',
            stage: 2,
            branch: 'special',
            prerequisites: ['spc_s1_linear', 'spc_s0_berserker'],
            effect: { type: 'ability', key: 'momentumStack', params: { maxStacks: 5, speedPerStack: 0.15, fireRatePerStack: 0.1 } }
        },

        // --- Stage 3: 终极进化 - 特殊极致 ---
        'spc_s3_adaptive': {
            id: 'spc_s3_adaptive',
            name: '自适应AI',
            desc: 'AI根据玩家操作习惯实时调整策略，找到玩家弱点',
            stage: 3,
            branch: 'special',
            prerequisites: ['spc_s2_swarm', 'spc_s2_counter', 'spc_s0_predict'],
            effect: { type: 'ability', key: 'adaptiveAI', params: { adaptationSpeed: 5.0, strategySwitchCooldown: 3.0 } }
        },
        'spc_s3_time_slow': {
            id: 'spc_s3_time_slow',
            name: '时间减速',
            desc: 'AI激活时间减速场，在局部区域内减缓敌人速度60%',
            stage: 3,
            branch: 'special',
            prerequisites: ['spc_s2_retreat', 'spc_s2_decoy', 'spc_s1_bullet_dodge'],
            effect: { type: 'ability', key: 'timeSlow', params: { radius: 150, slowFactor: 0.4, duration: 4.0, cooldown: 20.0 } }
        },
        'spc_s3_destiny': {
            id: 'spc_s3_destiny',
            name: '命运操控',
            desc: 'AI操控战场，预知未来3秒的弹道和移动轨迹，完美闪避和反击',
            stage: 3,
            branch: 'special',
            prerequisites: ['spc_s3_adaptive', 'spc_s2_momentum', 'spc_s2_counter'],
            effect: { type: 'ability', key: 'destinyControl', params: { predictionTime: 3.0, dodgePerfect: true, counterBonus: 3.0, cooldown: 25.0 } }
        },

        // ============================================================
        //  跨分支综合节点 (bonus) - 6个节点
        //  这些节点需要多个分支的前置天赋
        // ============================================================

        'bonus_s2_hybrid_atk_def': {
            id: 'bonus_s2_hybrid_atk_def',
            name: '攻守兼备',
            desc: '攻击时自动生成护盾，防守时自动反击',
            stage: 2,
            branch: 'special',
            prerequisites: ['atk_s1_barrage', 'def_s1_reflect'],
            effect: { type: 'ability', key: 'hybridAtkDef', params: { attackShieldDuration: 1.0, defendCounterDamage: 1.5 } }
        },
        'bonus_s2_hybrid_atk_mov': {
            id: 'bonus_s2_hybrid_atk_mov',
            name: '游击战术',
            desc: '移动中射击不减速，且移速越快伤害越高',
            stage: 2,
            branch: 'special',
            prerequisites: ['atk_s1_suppress', 'mov_s1_burst'],
            effect: { type: 'ability', key: 'guerrillaTactics', params: { noMoveSlowdown: true, speedDamageBonus: 0.5 } }
        },
        'bonus_s3_full_power': {
            id: 'bonus_s3_full_power',
            name: '全力全开',
            desc: 'AI所有基础属性提升至最大值，全面强化',
            stage: 3,
            branch: 'special',
            prerequisites: ['atk_s0_aggressive', 'mov_s0_swift', 'def_s0_damage_reduce', 'ult_s0_aggressive'],
            effect: {
                type: 'ability',
                key: 'fullPower',
                params: {
                    stats: {
                        level: 1.0,
                        aimAccuracy: 1.0,
                        reactionSpeed: 1.0,
                        evasionAbility: 1.0,
                        ultimateAggressiveness: 1.0
                    }
                }
            }
        },
        'bonus_s3_counter_ult': {
            id: 'bonus_s3_counter_ult',
            name: '反制大招',
            desc: '当敌方释放大招时，AI自动释放反向大招抵消',
            stage: 3,
            branch: 'ultimate',
            prerequisites: ['def_s2_invincible', 'ult_s2_triple', 'spc_s2_counter'],
            effect: { type: 'ability', key: 'counterUltimate', params: { cancelEnemyUlt: true, cooldown: 10.0 } }
        },
        'bonus_s3_momentum_ult': {
            id: 'bonus_s3_momentum_ult',
            name: '连锁爆发',
            desc: '每次命中敌人都会缩短大招冷却，连击越多大招来得越快',
            stage: 3,
            branch: 'ultimate',
            prerequisites: ['atk_s2_triple_shot', 'ult_s1_charge_speed', 'spc_s2_momentum'],
            effect: { type: 'ability', key: 'chainUltimate', params: { cdReductionPerHit: 0.5, maxStacks: 10 } }
        },
        'bonus_s3_phase_attack': {
            id: 'bonus_s3_phase_attack',
            name: '相位打击',
            desc: 'AI进入相位状态时攻击穿透护盾直接命中本体',
            stage: 3,
            branch: 'attack',
            prerequisites: ['mov_s3_phase', 'atk_s2_pierce', 'def_s2_em_field'],
            effect: { type: 'ability', key: 'phaseAttack', params: { ignoreShield: true, damageBonus: 1.5, cooldown: 12.0 } }
        },
    },

    // ================================================================
    //  阶段定义
    // ================================================================
    stages: {
        0: { name: '初始觉醒', unlockWins: 0, desc: 'AI刚觉醒基础能力，获得第一层天赋强化' },
        1: { name: '进阶强化', unlockWins: 3, desc: 'AI经过3次胜利后进化，解锁更强的技能和策略' },
        2: { name: '精英突变', unlockWins: 8, desc: 'AI发生精英级突变，获得质变级能力' },
        3: { name: '终极进化', unlockWins: 15, desc: 'AI达到终极形态，获得压倒性的终极能力' },
    },

    // ================================================================
    //  分支定义
    // ================================================================
    branches: {
        attack:  { name: '攻击系', color: '#ff4444', icon: 'sword' },
        movement: { name: '移动系', color: '#44aaff', icon: 'wind' },
        defense:  { name: '防御系', color: '#44ff44', icon: 'shield' },
        ultimate: { name: '大招系', color: '#ffaa00', icon: 'star' },
        special:  { name: '特殊系', color: '#cc44ff', icon: 'eye' },
    },
};

// ================================================================
//  辅助函数
// ================================================================

/**
 * 获取某节点及其所有前置节点（递归）
 * @param {string} nodeId - 天赋节点ID
 * @param {Set} [visited] - 内部递归用，防止循环引用
 * @returns {string[]} 所有前置节点ID数组（含自身）
 */
function getTalentPrereqs(nodeId, visited) {
    var node = AITalentTree.nodes[nodeId];
    if (!node) return [];

    visited = visited || new Set();
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    var result = [nodeId];
    var prereqs = node.prerequisites || [];
    for (var i = 0; i < prereqs.length; i++) {
        var subPrereqs = getTalentPrereqs(prereqs[i], visited);
        for (var j = 0; j < subPrereqs.length; j++) {
            result.push(subPrereqs[j]);
        }
    }
    return result;
}

/**
 * 获取某stage下所有可用节点
 * @param {number} stage - 阶段编号 (0-3)
 * @returns {Object[]} 该阶段的所有节点数组
 */
function getTalentNodesByStage(stage) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id) && nodes[id].stage === stage) {
            result.push(nodes[id]);
        }
    }
    return result;
}

/**
 * 获取某分支下所有可用节点
 * @param {string} branch - 分支名称
 * @returns {Object[]} 该分支的所有节点数组
 */
function getTalentNodesByBranch(branch) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id) && nodes[id].branch === branch) {
            result.push(nodes[id]);
        }
    }
    return result;
}

/**
 * 检查某节点是否可解锁（所有前置节点已解锁）
 * @param {string} nodeId - 天赋节点ID
 * @param {Set|string[]} unlockedSet - 已解锁节点集合（Set或数组）
 * @returns {boolean} 是否可以解锁
 */
function canUnlockTalent(nodeId, unlockedSet) {
    var node = AITalentTree.nodes[nodeId];
    if (!node) return false;

    // 将数组转换为Set以便快速查找
    var unlocked;
    if (unlockedSet instanceof Set) {
        unlocked = unlockedSet;
    } else {
        unlocked = new Set(unlockedSet);
    }

    var prereqs = node.prerequisites || [];
    for (var i = 0; i < prereqs.length; i++) {
        if (!unlocked.has(prereqs[i])) {
            return false;
        }
    }
    return true;
}

/**
 * 获取某节点的直接前置节点（不递归）
 * @param {string} nodeId - 天赋节点ID
 * @returns {string[]} 直接前置节点ID数组
 */
function getDirectPrereqs(nodeId) {
    var node = AITalentTree.nodes[nodeId];
    if (!node) return [];
    return node.prerequisites || [];
}

/**
 * 获取某节点的所有后续节点（依赖此节点的节点）
 * @param {string} nodeId - 天赋节点ID
 * @returns {string[]} 所有后续节点ID数组
 */
function getTalentDependents(nodeId) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var prereqs = nodes[id].prerequisites || [];
            if (prereqs.indexOf(nodeId) !== -1) {
                result.push(id);
            }
        }
    }
    return result;
}

/**
 * 获取在指定已解锁集合下，所有可以解锁的节点
 * @param {Set|string[]} unlockedSet - 已解锁节点集合
 * @param {number} [maxStage] - 最高阶段限制
 * @returns {Object[]} 可解锁的节点数组
 */
function getAvailableTalents(unlockedSet, maxStage) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var node = nodes[id];
            // 阶段限制检查
            if (maxStage !== undefined && node.stage > maxStage) continue;
            // 已解锁的跳过
            var unlocked = unlockedSet instanceof Set ? unlockedSet : new Set(unlockedSet);
            if (unlocked.has(id)) continue;
            // 检查前置是否满足
            if (canUnlockTalent(id, unlockedSet)) {
                result.push(node);
            }
        }
    }
    return result;
}

/**
 * 计算从指定起点解锁到目标节点所需的总节点数
 * @param {string} nodeId - 目标节点ID
 * @returns {number} 需要解锁的总节点数（含自身）
 */
function getTalentTreeSize(nodeId) {
    return getTalentPrereqs(nodeId).length;
}

/**
 * 获取天赋树的统计信息（调试用）
 * @returns {Object} 统计信息
 */
function getTalentTreeStats() {
    var stats = { totalNodes: 0, byStage: {}, byBranch: {}, stage3WithMultiPrereqs: 0 };
    var nodes = AITalentTree.nodes;

    for (var id in nodes) {
        if (!nodes.hasOwnProperty(id)) continue;
        var node = nodes[id];
        stats.totalNodes++;

        // 按阶段统计
        if (!stats.byStage[node.stage]) stats.byStage[node.stage] = 0;
        stats.byStage[node.stage]++;

        // 按分支统计
        if (!stats.byBranch[node.branch]) stats.byBranch[node.branch] = 0;
        stats.byBranch[node.branch]++;

        // Stage 3 多前置统计
        if (node.stage === 3 && node.prerequisites && node.prerequisites.length >= 2) {
            stats.stage3WithMultiPrereqs++;
        }
    }
    return stats;
}
