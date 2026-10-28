# 部署指南（DeepSeek Key 安全）

## 核心结论：Key 本来就只在服务端

本项目是「前端 Angular + 后端 Node 代理」结构：

- 前端（`src/`）只调用 `/api/generate`、`/api/travel-intelligence`，**接触不到 Key**。
- DeepSeek 的真实调用发生在 `server/index.js`，Key 从 `server/.env` 读取。
- `ng build` 产出的 `dist/travelling-ai/` 里**只有前端代码，永远不含 Key**。

所以只要遵守下面两条规则，Key 就不会暴露：

1. **`server/.env` 永不进 git**（`.gitignore` 已配置 `/server/.env`）。
2. **`server/.env` 永不放进前端构建产物**（它本来就不在 `dist/` 里）。

---

## 部署架构

生产环境用一个 Node 进程同时提供：

```
浏览器 ──▶ Node(server/index.js :3000)
              ├── /            → 返回 dist/travelling-ai 静态文件
              ├── /api/*       → 调用 DeepSeek（Key 只在服务端使用）
              └── 其它路由      → SPA 回退到 index.html
```

---

## 一、本地打包

```powershell
# 1. 构建前端（只产物，不含 Key）
npm install
npm run build            # 生成 dist/travelling-ai/

# 2. 准备要上传的文件（不要包含 server/.env！）
#    需要上传：
#      dist/travelling-ai/    ← 前端产物
#      server/                ← 后端源码（index.js / prompt.js / normalize.js / package.json）
#                              ← 但【不要】上传 server/.env
```

> 小技巧：`server/` 目录上传时可以只传 `.js` 和 `package.json`，`.env` 单独在服务器上创建。

---

## 二、服务器部署

假设服务器上项目目录为 `/var/www/travelling-ai`，Node 建议 18+（代码用了全局 `fetch`）。

```bash
# 1. 上传 dist/ 和 server/ 到 /var/www/travelling-ai

# 2. 安装后端依赖
cd /var/www/travelling-ai/server
npm install --omit=dev

# 3. 创建 .env（在服务器上手动创建，值只存在于服务器）
cat > /var/www/travelling-ai/server/.env <<'EOF'
DEEPSEEK_API_KEY=sk-你的真实key
DEEPSEEK_MODEL=deepseek-chat
PORT=3000
EOF

# 4. 收紧 .env 权限，只有服务进程能读
chmod 600 /var/www/travelling-ai/server/.env

# 5. 启动
cd /var/www/travelling-ai/server
node index.js
# 浏览器访问 http://服务器IP:3000
```

> Windows 服务器：用记事本在 `server/` 下新建 `.env`，内容同上即可。

---

## 三、用进程守护（可选但推荐）

### PM2

```bash
npm install -g pm2
cd /var/www/travelling-ai/server
pm2 start index.js --name travelling-ai
pm2 save
pm2 startup
```

### systemd

`/etc/systemd/system/travelling-ai.service`：

```ini
[Unit]
Description=呼呼去哪儿
After=network.target

[Service]
WorkingDirectory=/var/www/travelling-ai/server
ExecStart=/usr/bin/node index.js
Restart=always
User=www-data
# 也可以不用 .env，直接在这里注入环境变量：
# Environment=DEEPSEEK_API_KEY=sk-你的真实key

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now travelling-ai
```

---

## 四、Nginx 反向代理 + HTTPS（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

用 `certbot` 配上 HTTPS 证书即可。

---

## 五、安全清单

- [ ] `.env` 从未提交进 git（已确认：`git ls-files` 里没有 `.env`）。
- [ ] 服务器上 `.env` 权限设为 `600`，且不属于公开可读目录。
- [ ] 如果这个 Key 曾经被提交到远端仓库或发到群里，**立即到 DeepSeek 控制台吊销并重新生成**。
- [ ] 建议给 DeepSeek 账号设置用量/额度上限，防止 Key 泄露后被盗刷。
- [ ] 生产环境如无跨域需求，可把 `server/index.js` 里的 `app.use(cors())` 收敛为同源或指定域名。
- [ ] 生产环境可考虑加简单的限流，防止 `/api/generate` 被刷。

---

## 六、本地联调（开发用，无需改动）

```bash
# 终端 A：后端
cd server && node index.js

# 终端 B：前端（走 proxy.conf.json 转发到 3000）
npm start
```

