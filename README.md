# 呼呼去哪儿

<p align="center">
  <strong>AI 驱动的智能旅行规划助手</strong>
</p>

<p align="center">
  输入目的地、出行方式、预算与日期，生成一份可编辑、可保存、可分享的个性化行程，
  并结合实时天气、气候参考与地理信息做智能加成。
</p>

<p align="center">
  <a href="#-快速开始"><img src="https://img.shields.io/badge/Angular-16-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular 16" /></a>
  <a href="#-快速开始"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 18+" /></a>
  <a href="#-技术栈"><img src="https://img.shields.io/badge/DeepSeek-AI-2A6DF4?style=for-the-badge" alt="DeepSeek AI" /></a>
  <a href="#-技术栈"><img src="https://img.shields.io/badge/SQLite-sql.js-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" /></a>
  <a href="#-生产部署"><img src="https://img.shields.io/badge/Deploy-Express%20%2B%20Angular-5C2D91?style=for-the-badge&logo=express&logoColor=white" alt="Deploy Express + Angular" /></a>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> ·
  <a href="#-页面与流程">页面与流程</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-api-一览">API</a> ·
  <a href="#-项目结构">项目结构</a> ·
  <a href="#-部署">部署</a>
</p>

<p align="center">
  🌐 网站示例：<a href="http://travel.hopehu.xyz">http://travel.hopehu.xyz</a>
</p>
---

## 📖 项目简介

**呼呼去哪儿** 是一个「前端 Angular + 后端 Express」的一体化旅行规划应用。

用户通过多步骤问卷式流程填写旅行偏好，服务端调用 DeepSeek 生成结构化行程；前端再叠加天气、气候、季节与地理信息，产出包含每日路线、景点、预算与贴士的完整方案。方案支持在线编辑（替换 / 补充 / 手动添加景点）、保存到账户、生成分享链接以及从分享链接导入。

## ✨ 功能特性

| 能力 | 说明 |
| --- | --- |
| 🧭 问卷式规划 | 逐步收集目的地、伴侣、兴趣点类型、出行目的、天数、人数、日期与预算 |
| 🤖 AI 行程生成 | 基于 DeepSeek 输出严格 JSON，包含每日安排、景点、预算与建议 |
| 🌤 实时旅行情报 | 天气预报 + 超出预报窗口的气候参考 + 地理坐标 + 热点地点 + 智能建议 |
| 🗺 行程可视化 | 基于 Leaflet 的地图面板与景点标记，景点详情弹窗内置小地图 |
| ✏️ 行程编辑 | 景点替换、当天补充景点、手动输入地名并确认信息，均带 AI 兜底 |
| 💰 预算面板 | 分类预算、总预算估算，超支时输出降本建议 |
| 👤 账户体系 | 注册 / 登录 / 资料编辑 / 修改密码，JWT 鉴权 |
| 📁 方案管理 | 保存、更新、复制、删除，方案列表集中在个人主页 |
| 🔗 分享与导入 | 生成分享链接，统计浏览 / 导入次数，他人可一键导入到自己的账户 |
| 🛡 降级兜底 | AI 或外部接口异常时自动回退到本地推荐逻辑，页面不中断 |
| 📊 轻量埋点 | 匿名会话级批量上报，不采集个人身份信息 |

## 🗺 页面与流程

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 | 产品介绍与入口 |
| `/wizard` | 规划问卷 | 多步骤收集旅行偏好 |
| `/idea` | 灵感页 | 目的地与玩法灵感 |
| `/result` | 结果页 | 行程、地图、预算、编辑与保存分享 |
| `/auth` | 登录注册 | 用户名密码登录 / 注册 |
| `/profile` | 个人主页 | 资料管理、方案列表、分享状态 |
| `/share/:token` | 分享详情 | 游客可查看已分享方案，登录后可导入 |

```text
首页 / 灵感页
   │
   ▼
规划问卷 ──► AI 生成行程 ──► 结果页（编辑 / 地图 / 预算）
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
           保存到账户                   生成分享链接
                │                           │
                ▼                           ▼
           个人主页管理              好友通过 /share/:token 查看并导入
```

## 🧩 技术栈

**前端**

- Angular 16 + TypeScript 5.1 + RxJS 7.8
- SCSS、PrimeNG 16、PrimeIcons
- Leaflet 1.9（地图与景点标记）

**后端**

- Node.js + Express 4
- SQLite（`sql.js`，零原生依赖，自动从旧 `data.json` 迁移）
- `bcryptjs` 密码哈希、`jsonwebtoken` 鉴权
- `express-rate-limit` 接口限流、`cors` 跨域控制

**外部服务**

- DeepSeek Chat Completions API：行程生成、景点替换 / 补充 / 信息确认
- Open-Meteo：天气预报、气候参考、地理编码兜底
- 高德 Web 服务 API（可选）：POI 搜索、地理编码、价格区间

## 🏗 架构设计

```text
浏览器
  │
  ▼
Angular Frontend (src/)
  │  - 问卷 / 灵感 / 结果 / 个人主页 / 分享页
  │  - 认证拦截器自动附带 Bearer Token
  ▼
Node.js Backend (server/)
  ├── /api/generate            → DeepSeek 生成行程
  ├── /api/replace-spot        → AI 替换景点
  ├── /api/add-spot            → AI 补充当天景点
  ├── /api/spot-info           → AI 确认自定义地点信息
  ├── /api/travel-intelligence → 天气 / 气候 / 地理 / 热点
  ├── /api/geocode             → 高德 POI → 高德地理编码 → Open-Meteo 三级降级
  ├── /api/price-range         → 高德 POI 价格字段
  ├── /api/auth                → 注册 / 登录 / 资料
  ├── /api/plans               → 方案 CRUD / 分享 / 导入（需登录）
  ├── /api/shared/:token       → 公开读取分享方案
  ├── /api/events              → 埋点批量上报
  └── /api/health              → 健康检查
  │
  ▼
DeepSeek API + Open-Meteo + 高德开放平台 + SQLite
```

**关键设计**

- 前端只访问 `/api/*`，真实密钥永远不会进入浏览器代码与构建产物
- `DEEPSEEK_API_KEY` 只存在于 `server/.env`
- 生产环境强制要求 `JWT_SECRET`，未配置时服务拒绝启动
- AI 生成、地理编码、价格查询分别限流，并带缓存降低外网压力

## 📁 项目结构

```text
travelling-AI/
├── src/                                  # Angular 前端
│   ├── app/
│   │   ├── components/
│   │   │   ├── landing/                  # 首页
│   │   │   ├── questionnaire/            # 规划问卷
│   │   │   ├── idea/                     # 灵感页
│   │   │   ├── result/                   # 结果页及子组件
│   │   │   │   ├── result.component.ts
│   │   │   │   ├── spot-replacement-panel.component.ts
│   │   │   │   ├── spot-detail-modal.component.ts
│   │   │   │   ├── plan-save-dialog.component.ts
│   │   │   │   └── plan-share-dialog.component.ts
│   │   │   ├── auth/                     # 登录注册
│   │   │   ├── profile/                  # 个人主页
│   │   │   └── shared/                   # 分享详情
│   │   ├── data/travel-data.ts           # 目的地基础数据
│   │   ├── models/travel.model.ts        # 类型与接口定义
│   │   ├── services/                     # AI / 认证 / 方案 / 季节 / 埋点等
│   │   └── shared/primeng.module.ts      # PrimeNG 组件集中导出
│   ├── assets/
│   ├── main.ts
│   └── styles.scss                       # 全局样式与设计令牌
├── server/                               # Node 后端
│   ├── index.js                          # Express 入口、外部服务与限流
│   ├── prompt.js / normalize.js          # 行程提示词与结果规范化
│   ├── spot-replacement.js               # 景点替换
│   ├── spot-addition.js                  # 景点补充
│   ├── spot-info.js                      # 自定义地点信息
│   ├── auth.js / auth-routes.js          # JWT 与认证路由
│   ├── plan-routes.js / share-routes.js  # 方案与分享路由
│   ├── db.js                             # SQLite（sql.js）数据层
│   ├── travel-idea.test.js               # 后端测试
│   └── .env.example                      # 环境变量模板
├── docs/
│   ├── requirements/                     # 功能需求与 PRD
│   └── logic/                            # 接口契约与旅行智能逻辑
├── DEPLOY.md                             # 部署与安全说明
├── proxy.conf.json                       # 开发环境 /api 代理到 3000
├── angular.json
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
# 前端（项目根目录）
npm install

# 后端
cd server
npm install
```

### 2. 配置环境变量

复制模板并填写真实值：

```bash
# 在 server/ 目录下
cp .env.example .env
```

`server/.env`：

```env
# 必填：JWT 签名密钥（生产环境必须配置）
JWT_SECRET=your_random_secret

# 必填：DeepSeek API Key
DEEPSEEK_API_KEY=sk-xxxxxxxx

# 可选
DEEPSEEK_MODEL=deepseek-chat
PORT=3000
ALLOWED_ORIGINS=http://localhost:4200
NODE_ENV=development
AMAP_API_KEY=your_amap_key
```

> `server/.env` 已被 `.gitignore` 忽略，切勿提交到仓库。安全细节见 [DEPLOY.md](./DEPLOY.md)。

### 3. 启动开发环境

终端 A（后端）：

```bash
cd server
npm start
```

终端 B（前端）：

```bash
npm start
```

访问 <http://localhost:4200>。前端通过 [proxy.conf.json](./proxy.conf.json) 将 `/api` 转发到 `http://localhost:3000`。

## 🔧 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `JWT_SECRET` | 生产必填 | 无 | JWT 签名密钥，开发环境可临时省略 |
| `DEEPSEEK_API_KEY` | 是 | 无 | DeepSeek API Key |
| `DEEPSEEK_MODEL` | 否 | `deepseek-chat` | 可选 `deepseek-reasoner` |
| `DEEPSEEK_API_URL` | 否 | 官方地址 | 自定义 Chat Completions 地址 |
| `PORT` | 否 | `3000` | 后端监听端口 |
| `ALLOWED_ORIGINS` | 生产建议 | 允许全部 | 逗号分隔的 CORS 白名单 |
| `NODE_ENV` | 否 | 无 | `development` 时跳过 JWT_SECRET 强制校验 |
| `AMAP_API_KEY` | 否 | 无 | 高德 Web 服务 Key；未配置时地理编码回退到 Open-Meteo |

## 📦 生产部署

```bash
# 1. 构建前端（产物位于 dist/travelling-ai）
npm run build

# 2. 启动后端（同一进程托管前端静态资源与 /api）
cd server
npm install --omit=dev
npm start
```

也可以一条命令完成构建与启动：

```bash
npm run serve:prod
```

后端会自动探测 `dist/travelling-ai` 或 `dist` 中的 `index.html`；找不到时以 API-only 模式运行。Nginx、PM2、systemd 以及安全清单详见 [DEPLOY.md](./DEPLOY.md)。

## 🔌 API 一览

### 公开接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务状态、模型名、是否已配置 Key |
| `POST` | `/api/generate` | 根据偏好生成行程 |
| `POST` | `/api/replace-spot` | 为指定景点生成替换候选 |
| `POST` | `/api/add-spot` | 为某一天补充景点候选 |
| `POST` | `/api/spot-info` | 确认用户手动输入的地点信息 |
| `GET` | `/api/travel-intelligence` | 天气、气候参考、地理坐标、热点、建议 |
| `GET` | `/api/geocode?q=&city=&lat=&lng=` | 地点地理编码 |
| `GET` | `/api/price-range?spots=&city=` | 景点价格区间 |
| `POST` | `/api/events` | 批量上报埋点（单次最多 50 条） |
| `GET` | `/api/shared/:token` | 公开读取分享方案 |

### 认证接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/login` | 登录 |
| `GET` | `/api/auth/me` | 当前用户信息 |
| `PUT` | `/api/auth/me` | 更新昵称 / 邮箱 / 简介 |
| `PUT` | `/api/auth/me/password` | 修改密码 |

### 方案接口（需登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/plans` | 方案列表（含分享状态） |
| `POST` | `/api/plans` | 创建方案 |
| `GET` | `/api/plans/:id` | 方案详情 |
| `PUT` | `/api/plans/:id` | 更新方案 |
| `DELETE` | `/api/plans/:id` | 删除方案 |
| `POST` | `/api/plans/:id/duplicate` | 复制方案 |
| `POST` | `/api/plans/:id/share` | 生成分享链接 |
| `GET` | `/api/plans/:id/share` | 分享统计 |
| `DELETE` | `/api/plans/:id/share` | 取消分享 |
| `POST` | `/api/plans/import` | 通过分享 token 导入方案 |

## 🔒 安全设计

- **密钥只留在服务端**：`DEEPSEEK_API_KEY` 仅存于 `server/.env`，前端与构建产物中不会出现
- **JWT 鉴权**：`/api/plans` 全部需要登录，认证拦截器自动附带 `Authorization: Bearer <token>`
- **密码哈希**：`bcryptjs` 加盐存储，接口只返回脱敏后的用户信息
- **限流保护**：AI 生成每小时 60 次（登录用户 120 次）、地理编码每分钟 120 次、价格查询每分钟 30 次、埋点每分钟 120 次
- **CORS 收敛**：生产环境通过 `ALLOWED_ORIGINS` 显式白名单
- **埋点脱敏**：只上报页面路径与匿名会话 ID，不采集用户名、邮箱与行程名称

## 🧪 测试

```bash
# 前端单元测试
npm test

# 后端测试（Node 内置 test runner）
cd server
npm test
```

## 🛣 后续方向

- [ ] 行程导出（PDF / 图片 / 日历）
- [ ] 多人协作编辑与评论
- [ ] 更强的推荐评估与个性化排序
- [ ] 多语言支持
- [ ] 移动端体验优化

---

<p align="center">
  如果这个项目对你有帮助，欢迎点个 ⭐ Star
</p>
