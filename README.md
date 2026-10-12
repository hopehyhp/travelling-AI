# Travelling AI

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Angular-16-DD0031?style=for-the-badge&logo=angular" alt="Angular 16" /></a>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js 18+" /></a>
  <a href="#-architecture"><img src="https://img.shields.io/badge/DeepSeek-AI-2A6DF4?style=for-the-badge" alt="DeepSeek AI" /></a>
  <a href="#-deployment"><img src="https://img.shields.io/badge/Deploy-Express%20%2B%20Angular-5C2D91?style=for-the-badge" alt="Deploy Express + Angular" /></a>
</p>

<p align="center">
  <strong>AI 驱动的智能旅行规划助手</strong>
</p>

<p align="center">
  根据用户的目的地、旅行方式、预算与时间，生成更贴合真实出行场景的个性化旅行建议，并结合天气、地理和季节信息做智能加成。
</p>

## ✨ 产品概览

Travelling AI 是一个结合 Angular 前端与 Node 后端的旅行规划应用，用户可以在一套多步骤引导流程中填写需求，系统随后生成一份结构化旅行方案，包括：

- 目的地与旅行主题选择
- 伴侣、兴趣点、出行目的偏好
- 天数、人数、日期和预算参数
- AI 生成的推荐路线与活动安排
- 天气/季节适配与智能建议

它适合用于：

- 个人旅行规划
- 伴侣/朋友出游决策
- 旅行内容生成辅助
- AI 应用产品原型展示

## 🌟 核心能力

- 智能问卷式体验：一步步收集旅行偏好
- AI 生成攻略：调用 DeepSeek 生成推荐内容
- 实时旅游信息：整合地理位置、天气预测、热点目的地
- 兜底推荐：当 AI 异常时自动回退到本地推荐逻辑
- 安全部署：API Key 仅留在后端，不暴露到前端代码
- 一体式部署：前端静态产物与 Express 后端可同一进程提供服务

## 🏗️ 架构设计

```text
浏览器
  │
  ▼
Angular Frontend (src/)
  │  - 问卷页面
  │  - 结果展示
  │  - 偏好参数收集
  ▼
Node.js Backend (server/)
  ├── /api/generate      -> DeepSeek 生成旅行建议
  ├── /api/travel-intelligence -> 天气/地理/热点信息
  └── /api/health        -> 健康检查
  │
  ▼
DeepSeek API + Open-Meteo
```

重点说明：

- 前端只访问 `/api/*`，不能直接拿到真实 API Key
- DeepSeek Key 仅存放于 `server/.env`
- `dist/` 中不会出现敏感配置

## 🧩 技术栈

- Frontend: Angular 16, TypeScript, RxJS, SCSS
- Backend: Node.js, Express
- AI: DeepSeek Chat Completions API
- Weather / Geo: Open-Meteo API
- Build: Angular CLI

## 📁 项目结构

```text
travelling-AI/
├── src/                          # Angular 前端代码
│   ├── app/
│   │   ├── components/          # 问卷、结果页等 UI
│   │   ├── data/                # 目的地数据
│   │   ├── models/              # 类型与接口定义
│   │   └── services/            # AI、季节、推荐逻辑
│   ├── assets/
│   ├── main.ts
│   └── styles.scss
├── server/                       # Node 后端
│   ├── index.js                  # Express 入口
│   ├── normalize.js              # 规范化返回数据
│   ├── prompt.js                 # AI 提示词生成
│   └── package.json
├── docs/                         # 需求与逻辑说明文档
├── angular.json
├── package.json
├── proxy.conf.json
├── DEPLOY.md                     # 部署与安全说明
├── README.md
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
└── .gitignore
```

## 🚀 Quick Start

### 1) 安装依赖

```bash
npm install
```

### 2) 配置后端环境变量

在 `server/` 目录下新建 `.env`：

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-chat
PORT=3000
```

> 注意：`server/.env` 不应提交到 Git，安全说明详见 `DEPLOY.md`。

### 3) 启动开发环境

终端 A：启动后端

```bash
cd server
node index.js
```

终端 B：启动前端

```bash
npm start
```

访问地址：

```text
http://localhost:4200
```

## 🏭 生产部署

```bash
npm run build
cd server && npm install --omit=dev
node index.js
```

此项目支持单机部署：后端会同时托管 Angular 构建产物，并暴露 `/api/*` 接口，方便直接部署到服务器。

完整部署说明请查看：

- [`DEPLOY.md`](./DEPLOY.md)

## 🔌 关键接口

- `GET /api/health`：检查服务状态
- `GET /api/travel-intelligence`：获取目的地、天气、热点景点和建议
- `POST /api/generate`：基于用户偏好生成旅行推荐

## 🔒 安全设计

这个项目使用了“后端持有 Secret”的安全模式：

- `DEEPSEEK_API_KEY` 仅保存在 `server/.env`
- 前端浏览器端无法访问真实密钥
- 构建产物不会包含敏感配置
- 生产环境可参考 `DEPLOY.md` 中的部署与安全方案

## 🧪 测试

```bash
npm test
```

## 📚 相关文档

- [`DEPLOY.md`](./DEPLOY.md)：部署与安全说明
- [`docs/requirements/functional-requirements.md`](./docs/requirements/functional-requirements.md)：功能需求说明
- [`docs/logic/travel-intelligence-logic.md`](./docs/logic/travel-intelligence-logic.md)：旅行智能逻辑说明

## 🚀 后续扩展方向

- 用户登录与收藏功能
- 行程导出与保存
- 地图可视化展示
- 多语言支持
- 更强的推荐评估与优化策略

## 结语

Travelling AI 结合了 AI 生成能力和真实旅行决策场景，旨在让用户从“填写偏好”变成“获得一份更靠谱的旅行方案”。

如果你希望，我还可以继续为这个项目补充：

- 英文版 README
- 更炫的 GitHub 首页风格版本
- 项目截图/演示图占位区
- 架构图与流程图版 README
