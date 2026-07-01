<div align="center">

# GEOMETRY DUEL

### 几何决斗

<br>

<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC">
<img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white" alt="Cloudflare">

<br>

一款几何极简风格的多人对战射击游戏，支持人机对战与 P2P 联机对战。

</div>

<br>

## ✨ 特性

- 🎮 **多种游戏模式** — 人机对战（1v2 大乱斗）、联机对战（2-4 人 P2P）
- 🎨 **几何极简风格** — 纯粹的几何图形与简约配色，视觉冲击力强
- ⚡ **流畅的操作手感** — 惯性移动、阻尼效果、击退反馈
- 🔫 **丰富的技能系统** — 普攻 + 蓄力大招（激光炮）
- 🌀 **动态环绕效果** — 浑天仪式几何轨道环绕，随移动速度变化
- 📱 **全平台适配** — 支持键盘与触控操作，多屏幕比例自适应
- 🌐 **P2P 联机** — 基于 WebRTC 的帧同步联机，低延迟高同步
- 🎵 **音效反馈** — 射击、命中、激光等丰富音效

<br>

## 🎯 游戏操作

### 键盘操作

| 按键 | 功能 |
|:---:|:---|
| `W` `A` `S` `D` | 移动 |
| `Z` | 普攻 |
| `X` | 蓄力大招（按住蓄力，松开释放） |
| `P` | 暂停 |

### 触控操作

- **左侧摇杆** — 移动方向
- **右侧 Z 按钮** — 普攻
- **右侧 X 按钮** — 蓄力大招
- **右上角暂停按钮** — 暂停游戏

<br>

## 🚀 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/Yun-OwO/geometry-duel.git
cd geometry-duel

# 启动本地服务器（任选其一）
python3 -m http.server 8080
# 或
npx serve .
```

然后在浏览器中访问 `http://localhost:8080` 即可开始游戏。

### 联机模式部署

联机模式需要部署 Cloudflare Worker 作为信令服务器：

```bash
# 进入 worker 目录
cd worker

# 安装 wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 部署
wrangler deploy
```

部署完成后，修改 `js/network.js` 中的 `SIGNALING_SERVER` 地址为你的 Worker 地址。

<br>

## 🏗️ 技术架构

### 技术栈

- **渲染引擎** — [PixiJS](https://pixijs.com/) (WebGL/Canvas 2D)
- **音频引擎** — [Howler.js](https://howlerjs.com/)
- **网络通信** — WebRTC DataChannel (P2P)
- **信令服务** — Cloudflare Worker
- **同步方案** — 固定时间步长帧同步

### 项目结构

```
geometry-duel/
├── index.html          # 入口文件
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── config.js       # 游戏配置
│   ├── game.js         # 游戏主逻辑
│   ├── network.js      # 网络层（WebRTC + 帧同步）
│   ├── ui.js           # UI 控制
│   ├── pixi.js         # PixiJS 引擎
│   └── howler.js       # Howler.js 音频库
├── worker/
│   ├── index.js        # Cloudflare Worker 信令服务
│   └── wrangler.toml   # Worker 配置
├── assets/
│   └── audio/          # 音效资源
├── PRD.md              # 需求文档
├── TECH_DESIGN.md      # 技术设计文档
└── TODO.md             # 任务清单
```

### 核心设计

- **逻辑/渲染分离** — 逻辑分辨率 640×640，渲染分辨率自适应高 DPI 设备
- **视角场拓展** — 根据屏幕比例动态调整视口，无黑边不裁切
- **固定时间步长** — 逻辑帧率固定 60FPS，确保不同设备一致性
- **确定性随机** — 联机模式下所有客户端随机数生成一致
- **帧延迟补偿** — 输入延迟 FRAME_DELAY 帧，减少网络波动影响

<br>

## 🎮 游戏模式

### 人机对战

- 1 名玩家 vs 2 名 AI
- AI 具有不同难度等级
- AI 必须射击一定数量普攻后才能使用大招
- 随玩家移动速度动态变化的环绕效果

### 联机对战

- 支持 2-4 人房间
- 通过 6 位房间号匹配
- P2P 直连，低延迟
- 帧同步确保所有玩家画面一致

<br>

## 📝 配置说明

游戏所有可调参数位于 `js/config.js`：

| 参数 | 说明 | 默认值 |
|:---|:---|:---:|
| `PLAYER_MAX_VEL_X` | 最大水平速度 | 12 |
| `PLAYER_ACCEL` | 加速度 | 1.8 |
| `PLAYER_FRICTION` | 摩擦系数 | 0.92 |
| `NORMAL_BULLET_SPEED` | 普攻子弹速度 | 10 |
| `ULTIMATE_BULLET_SPEED` | 大招激光速度 | 48 |
| `ULTIMATE_CHARGE_TIME` | 大招蓄力时间 | 0.25s |
| `AIM_ASSIST_STRENGTH` | 辅助瞄准强度 | 0.22 |
| `AI_LEVEL` | AI 难度等级 | 0.55 |
| `ORBIT_RING_COUNT` | 环绕层数量 | 2 |

<br>

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

<br>

## 📄 许可证

MIT License

<br>

<div align="center">

Made with ❤️ by Yun-OwO

</div>
