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
- **后端**: Express 4, WebSocket (ws), JWT 认证, express-rate-limit
- **构建**: Vite 6, TypeScript, tsx (后端运行时)
- **地图来源**: [ddnet.org/releases/maps.json](https://ddnet.org/releases/maps.json) + [maps.ddnet.org/compilations/](https://maps.ddnet.org/compilations/)

## 前置要求

- **Node.js** ≥ 18
- **DDNet 游戏服务器** 已安装并运行（[ddnet.org](https://ddnet.org/)）
- **Linux** 服务器（生产环境推荐，Windows 也可开发）
- 系统工具：`unzip`（地图下载用）、`systemctl`/`journalctl`（服务管理用）

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/DDNPANEL.git
cd DDNPANEL
```

### 2. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server && npm install && cd ..
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
PANEL_PORT=8400                          # 面板端口
PANEL_PASSWORD=your-admin-password       # 管理员密码（不设置则随机生成，启动时控制台输出）
JWT_SECRET=your-random-secret            # JWT 签名密钥（不设置则随机生成）
DDNET_MAPS_DIR=/opt/ddnet/data/maps      # DDNet 地图目录
DDNET_RCON_HOST=127.0.0.1                # RCON 地址
DDNET_RCON_PORT=8304                     # RCON 端口（DDNet ec_port）
DDNET_RCON_PASSWORD=your-rcon-password   # RCON 密码（需与 DDNet ec_password 一致）
```

### 4. 配置 DDNet 外部控制台

在 DDNet 服务器配置文件（如 `autoexec.cfg`）中添加：

```
ec_port 8304
ec_password your-rcon-password
```

### 5. 构建前端

```bash
npm run build
```

### 6. 启动后端

```bash
# 开发模式（热重载）
npm run server

# 生产模式（需先构建前端）
npm start
```

面板启动后访问 `http://localhost:8400`，使用环境变量中设置的密码登录。

### 7. 配置 systemd 服务（推荐）

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
DDNPANEL/
├── src/                    # 前端 React 源码
│   ├── api/                # HTTP 客户端
│   ├── components/         # 共享组件 (UsagePie, SystemStatusDisplay, Sidebar...)
│   ├── config/             # 站点配置 (导航、品牌)
│   ├── hooks/              # 自定义 Hooks
│   ├── layouts/            # 布局组件
│   ├── pages/
│   │   └── dashboard/      # 仪表盘/地图管理/地图商店/控制台/日志
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
├── package.json            # 前端依赖 + 脚本
├── vite.config.ts          # Vite 构建配置
├── tailwind.config.js      # TailwindCSS 主题（HeroUI 樱花粉）
├── .env.example            # 环境变量模板
└── README.md
```

## 地图下载机制

面板使用两层策略下载地图：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| ① ZIP 提取 | `maps.ddnet.org/compilations/{type}.zip` | ZIP 缓存于 `/tmp/ddnet-zips/`，流式 pipe 提取（不缓冲内存） |
| ② 目录回退 | `maps.ddnet.org/` 目录索引 | 新地图回退方案，按名称模糊匹配哈希文件名 |

## 安全性

- 面板使用 JWT 认证，所有 `/api/*` 路由需要 Bearer Token
- 登录接口有独立限流（10次/15分钟）
- RCON 命令拦截列表可配置（`rcon-client.ts` 中 `blockedCommands`）
- `helmet` + `cors` + `rate-limit` 基础 Web 安全防护
- 建议使用 Nginx 反向代理 + HTTPS

## 配置参考

### 环境变量完整列表

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PANEL_PORT` | `8400` | 面板 HTTP 端口 |
| `PANEL_PASSWORD` | 随机生成 | 管理员登录密码 |
| `JWT_SECRET` | 随机生成 | JWT 签名密钥（修改后所有已登录用户需重新登录） |
| `DDNET_MAPS_DIR` | `/opt/ddnet/data/maps` | DDNet 地图文件目录 |
| `DDNET_RCON_HOST` | `127.0.0.1` | DDNet 外部控制台地址 |
| `DDNET_RCON_PORT` | `8304` | DDNet 外部控制台端口 |
| `DDNET_RCON_PASSWORD` | (必填) | DDNet 外部控制台密码 |

## License

MIT
