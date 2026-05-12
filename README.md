# MopDDnet WebUI — DDNet 游戏服务器管理面板

基于 React 19 + HeroUI + Vite 6 + Express + WebSocket 的 DDNet 地图服务器 Web 管理面板。


## 功能

| 页面 | 路径 | 说明 |
|------|------|------|
| 仪表盘 | `/` | 服务器启停、CPU/内存实时监控、DDNet 进程资源、RCON 连接状态 |
| 地图管理 | `/maps` | 本地地图启用/禁用/删除，缩略图、类型、难度星级显示 |
| 地图商店 | `/store` | 浏览 2400+ 张 DDNet 地图，类型/星级/特性标签筛选，一键下载 |
| 控制台 | `/console` | xterm.js RCON 实时终端，50+ 快捷指令（服务器/地图/玩家/传送/道具/调参） |
| 面板日志 | `/log` | ddnet-panel 服务运行日志，颜色标记，实时刷新 |

## 技术栈

- **前端**: React 19, HeroUI (NextUI fork), TailwindCSS, Framer Motion, xterm.js, Redux Toolkit
- **后端**: Express 4, WebSocket (ws), JWT 认证, express-rate-limit, helmet
- **构建**: Vite 6, TypeScript, tsx (后端运行时)
- **地图来源**: [ddnet.org/releases/maps.json](https://ddnet.org/releases/maps.json) + [maps.ddnet.org/compilations/](https://maps.ddnet.org/compilations/)

## 前置要求

- **Node.js** ≥ 20（推荐 ≥ 22）
- **DDNet 游戏服务器** 已安装并配置（[ddnet.org](https://ddnet.org/)）
- **Linux** 服务器（依赖 systemctl / journalctl）
- 系统工具：`unzip`（地图下载用）

## 一句话搭建

把下面这行发给你的 AI 编程助手，它会帮你完成全部配置：

```
git clone https://github.com/bilibiligao/DDNET-PANNEL.git && 帮我在工作区内跑起一个 DDNet 服务器，并使用该面板作为管理。
```

## 手动搭建

### 1. 克隆项目

```bash
git clone https://github.com/bilibiligao/DDNET-PANNEL.git
cd DDNET-PANNEL
```

### 2. 安装依赖

```bash
npm install
cd server && npm install && cd ..
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入实际值：

```env
PANEL_PORT=8400                          # 面板端口
PANEL_PASSWORD=your-admin-password       # 管理员密码（不设置则随机生成，启动时控制台输出）
JWT_SECRET=your-random-secret            # JWT 签名密钥（不设置则随机生成）
DDNET_MAPS_DIR=/opt/ddnet/data/maps      # DDNet 地图目录
DDNET_RCON_HOST=127.0.0.1                # RCON 地址
DDNET_RCON_PORT=8304                     # RCON 端口（需与 DDNet ec_port 一致）
DDNET_RCON_PASSWORD=your-rcon-password   # RCON 密码（需与 DDNet ec_password 一致）
```

### 4. 配置 DDNet 外部控制台

在 DDNet 的 `autoexec.cfg` 中添加：

```
ec_port 8304
ec_password your-rcon-password
```

`ec_port` 必须为非零值，否则面板无法通过 RCON 连接服务器。

### 5. 构建前端

```bash
npm run build
```

### 6. 启动服务

```bash
# 开发模式（直接运行，不构建）
npm run server

# 生产模式（先构建再运行）
npm start
```

访问 `http://localhost:8400`，用 `.env` 中设置的密码登录。

### 7. 注册 systemd 服务（推荐）

创建 `/etc/systemd/system/ddnet-panel.service`：

```ini
[Unit]
Description=DDNet Map Management Panel
After=network.target ddnet-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ddnet-panel
EnvironmentFile=/opt/ddnet-panel/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now ddnet-panel
```

## 项目结构

```
DDNET-PANNEL/
├── src/                    # 前端 React 源码
│   ├── api/                # HTTP 客户端
│   ├── components/         # 共享组件 (UsagePie, SystemStatusDisplay, Sidebar...)
│   ├── config/             # 站点配置 (导航、品牌)
│   ├── layouts/            # 布局组件
│   ├── pages/
│   │   └── dashboard/      # 仪表盘 / 地图管理 / 地图商店 / 控制台 / 日志
│   ├── store/              # Redux 状态管理
│   └── styles/             # 全局 CSS + 字体
├── server/                 # 后端 Express 源码
│   ├── index.ts            # 服务入口
│   ├── config.ts           # 配置（环境变量读取）
│   ├── auth.ts             # JWT 认证
│   ├── rcon-client.ts      # DDNet RCON 客户端
│   └── routes/
│       ├── rcon.ts          # 系统状态 / 服务控制 / 日志 API
│       ├── feed.ts          # 地图元数据 API (maps.json 缓存)
│       ├── maps.ts          # 本地地图管理 API
│       └── download.ts      # 地图下载（ZIP 流式提取 + 目录回退）
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── .env.example
└── README.md
```

## 地图下载机制

面板使用两层策略下载地图：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| ① ZIP 提取 | `maps.ddnet.org/compilations/{type}.zip` | ZIP 缓存于 `/tmp/ddnet-zips/`，流式 pipe 提取（不缓冲内存） |
| ② 目录回退 | `maps.ddnet.org/` 目录索引 | 新地图回退方案，按名称模糊匹配哈希文件名 |

## 安全性

- JWT 认证，所有 `/api/*` 路由需要 Bearer Token
- 登录接口独立限流（10次/15分钟），API 全局限流（600次/15分钟）
- RCON 命令拦截列表可配置（`rcon-client.ts` → `blockedCommands`）
- `helmet` + `cors` + `rate-limit` 基础 Web 防护
- 生产环境建议 Nginx 反向代理 + HTTPS

## 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PANEL_PORT` | `8400` | 面板 HTTP 端口 |
| `PANEL_PASSWORD` | 随机生成 | 管理员登录密码 |
| `JWT_SECRET` | 随机生成 | JWT 签名密钥 |
| `DDNET_MAPS_DIR` | `/opt/ddnet/data/maps` | DDNet 地图文件目录 |
| `DDNET_RCON_HOST` | `127.0.0.1` | DDNet 外部控制台地址 |
| `DDNET_RCON_PORT` | `8304` | DDNet 外部控制台端口 |
| `DDNET_RCON_PASSWORD` | (必填) | DDNet 外部控制台密码 |

## 常见问题

### 构建失败：`styleText is not exported from node:util`
Node.js 版本过低，升级到 ≥ 22。

### 地图下载失败
1. 确认服务器能访问 `maps.ddnet.org`（国内 VPS 可能需要代理）
2. 检查面板日志页面查看具体错误

### 仪表盘显示"DDNet 已停止"
点击启动按钮，或 SSH 执行 `systemctl start ddnet-server`。首次启动需确保地图目录下至少有一张 `.map` 文件。

### 控制台无输出
确认 `.env` 中 `DDNET_RCON_PASSWORD` 与 DDNet `ec_password` 一致，且 `ec_port` 非零。

### RCON 连接失败
默认端口 8304。确认 DDNet 配置中 `ec_port` 非零且未被防火墙拦截。

## License

MIT
