# 几何决斗 HTML5 复刻 - 技术设计文档

## 1. 技术选型

### 1.1 渲染引擎
| 项目 | 选择 | 理由 |
|------|------|------|
| 引擎 | PixiJS v8 | 2D WebGL/Canvas渲染、高效、CDN可本地化 |
| 版本 | Latest stable | 稳定可靠 |

### 1.2 音频处理
| 项目 | 选择 | 理由 |
|------|------|------|
| 库 | Howler.js | 跨平台音频、CDN可本地化 |
| 格式 | OGG | 开源格式、支持流式播放 |

### 1.3 文件结构
```
geometry-duel/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── pixi.min.js
│   ├── howler.min.js
│   └── game.js
└── assets/
    └── audio/
        ├── MECHClik_Mine Deploy_02.ogg
        ├── LASRGun_Plasma Rifle Fire_03.ogg
        ├── GUNMech_Mechanical_12.ogg
        └── HIT_METAL_WRENCH_HEAVIEST_02.ogg
```

## 2. 架构设计

### 2.1 模块划分
```
game.js
├── Config          # 配置常量
├── Game           # 主游戏类
├── Player         # 玩家/AI角色
├── Bullet         # 子弹基类
│   ├── NormalBullet
│   └── UltimateBullet
├── InputManager   # 输入管理
│   ├── KeyboardInput
│   └── TouchInput
├── AIController   # AI控制器
├── CollisionSystem # 碰撞检测
├── AudioManager   # 音频管理
└── Renderer       # 渲染管理
```

### 2.2 类图关系
```
Game
├── PIXI.Application
├── InputManager
│   ├── KeyboardInput
│   └── TouchInput
├── AudioManager
├── Player[]
│   ├── Player (this)
│   └── AI (extends Player)
├── Bullet[]
│   ├── NormalBullet
│   └── UltimateBullet
└── CollisionSystem
```

## 3. 核心算法

### 3.1 屏幕自适应算法
```javascript
function calculateViewport(screenWidth, screenHeight) {
    const screenRatio = screenWidth / screenHeight;
    const gameLogicSize = 640;

    if (screenRatio > 1) {
        // 宽屏: 扩展视口高度
        viewHeight = gameLogicSize;
        viewWidth = gameLogicSize * screenRatio;
    } else {
        // 竖屏: 扩展视口宽度
        viewWidth = gameLogicSize;
        viewHeight = gameLogicSize / screenRatio;
    }

    return { width: viewWidth, height: viewHeight };
}
```

### 3.2 子弹碰撞检测
```javascript
function checkBulletCollision(bullet, target) {
    const dx = bullet.x - target.x;
    const dy = bullet.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (bullet.radius + target.radius);
}
```

### 3.3 AI瞄准算法
```javascript
function calculateAIAim(player, enemy, aimAngle) {
    const toEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    let relativeAngle = toEnemy - aimAngle;

    // 归一化到 [-PI, PI]
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

    return aimAngle + relativeAngle * 0.1;
}
```

### 3.4 击退算法
```javascript
function applyThrust(target, source) {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const randomOffset = (Math.random() - 0.5) * Math.PI; // ±45度
    const thrustAngle = angle + randomOffset;

    target.velX += 20 * Math.cos(thrustAngle);
    target.velY += 20 * Math.sin(thrustAngle);
}
```

## 4. 输入处理

### 4.1 键盘输入
```javascript
const keyMap = {
    'KeyZ': 'attack',
    'KeyX': 'ultimate',
    'KeyW': 'up',
    'KeyA': 'left',
    'KeyS': 'down',
    'KeyD': 'right',
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'KeyP': 'pause'
};
```

### 4.2 触控输入
```
┌─────────────────────────────────┐
│                                 │
│                                 │
│          游戏区域               │
│                                 │
│                                 │
├───────────────┬─────────────────┤
│    X区域      │    Z区域        │
│  (终极技能)    │   (普通攻击)     │
└───────────────┴─────────────────┘
     左侧30%           右侧30%
        ↓                 ↓
   移动摇杆区域      移动摇杆区域
   (虚拟摇杆)
```

### 4.3 虚拟摇杆算法
```javascript
function handleTouchMove(touch) {
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (x < canvasWidth * 0.3) {
        // 左侧虚拟摇杆
        const centerX = canvasWidth * 0.15;
        const centerY = canvasHeight * 0.85;
        const dx = x - centerX;
        const dy = y - centerY;
        const magnitude = Math.min(Math.sqrt(dx*dx + dy*dy), 50);

        input.moveX = (dx / magnitude) || 0;
        input.moveY = (dy / magnitude) || 0;
    }
}
```

## 5. 渲染设计

### 5.1 渲染层级
| 层级 | 内容 |
|------|------|
| 0 | 背景网格 |
| 1 | 子弹轨迹 |
| 2 | 子弹 |
| 3 | 玩家/AI |
| 4 | 特效 |
| 5 | UI |

### 5.2 高DPI处理
```javascript
const app = new PIXI.Application({
    width: logicalWidth,
    height: logicalHeight,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    antialias: true,
    roundPixels: false
});
```

### 5.3 相机系统
```javascript
class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom + screenWidth / 2,
            y: (worldY - this.y) * this.zoom + screenHeight / 2
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - screenWidth / 2) / this.zoom + this.x,
            y: (screenY - screenHeight / 2) / this.zoom + this.y
        };
    }
}
```

## 6. 音效设计

### 6.1 音频池管理
```javascript
class AudioManager {
    constructor() {
        this.sounds = {
            attack: new Howl({ src: ['audio/GUNMech_Mechanical_12.ogg'] }),
            ultimateFire: new Howl({ src: ['audio/LASRGun_Plasma Rifle Fire_03.ogg'] }),
            ultimateReady: new Howl({ src: ['audio/MECHClik_Mine Deploy_02.ogg'] }),
            kill: new Howl({ src: ['audio/HIT_METAL_WRENCH_HEAVIEST_02.ogg'] })
        };
    }

    play(name) {
        this.sounds[name]?.play();
    }
}
```

## 7. 状态机

### 7.1 游戏状态
```
┌─────────┐    start()    ┌─────────┐
│  IDLE   │ ───────────→ │  PLAYING │
└─────────┘               └──────────┘
     ↑                        │
     │                        │ pause()
     │                        ↓
     │                   ┌─────────┐
     └────────────────── │  PAUSED │
         resume()         └─────────┘
```

### 7.2 玩家状态机
```
┌────────┐   attack()   ┌───────────┐
│ MOVE   │ ──────────→ │ ATTACKING │
└────────┘              └───────────┘
     ↑                       │
     │ release               │ finish
     └───────────────────────┘
            (return)

┌───────────┐   hold X   ┌───────────┐
│  MOVE     │ ─────────→ │  CHARGING │
└───────────┘            └───────────┘
                              │
                              │ release & charged
                              ↓
                        ┌───────────┐
                        │  FIRING   │
                        └───────────┘
                              │
                              │ finish
                              ↓
                         ┌────────┐
                         │ RETURN │
                         └────────┘
```

## 8. 性能优化

### 8.1 对象池
- 子弹对象池复用
- 粒子效果对象池

### 8.2 渲染优化
- 离屏子弹不渲染
- 脏矩形更新（如适用）

### 8.3 输入优化
- 事件节流
- 触控预判

## 9. 常量配置

```javascript
const CONFIG = {
    // 画布
    LOGICAL_WIDTH: 640,
    LOGICAL_HEIGHT: 640,
    FPS: 60,

    // 玩家
    PLAYER_SIZE: 32,
    PLAYER_SPEED: 10,
    PLAYER_MAX_VEL_X: 10,
    PLAYER_MAX_VEL_Y: 7,

    // 子弹
    NORMAL_BULLET_SPEED: 24,
    NORMAL_BULLET_INTERVAL: 0.2, // 秒
    ULTIMATE_BULLET_SPEED: 64,
    ULTIMATE_CHARGE_TIME: 0.5, // 秒

    // 效果
    STUN_DURATION: 0.75, // 秒
    MOVE_SLOW_FACTOR: 0.25,

    // AI
    AI_PLAN_UPDATE_INTERVAL: 10, // 帧
};
```
