// JWT 中间件 —— 保护需要登录的路由
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '30d';

// P0-3 改进：生产环境必须显式配置 JWT_SECRET，否则拒绝启动
// 开发环境可以通过 NODE_ENV=development 绕过
if (!JWT_SECRET) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    console.warn('[auth] JWT_SECRET 未配置，开发环境使用临时密钥（生产环境务必配置）');
  } else {
    console.error('[auth] ❌ JWT_SECRET 未配置！生产环境必须设置。');
    console.error('    在 server/.env 中添加: JWT_SECRET=一个随机长字符串');
    process.exit(1);
  }
}

const SECRET = JWT_SECRET || 'dev-only-temp-secret-change-me';

function sign(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username },
    SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'NO_TOKEN', message: '需要登录' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = Number(payload.sub);
    req.username = payload.username;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: '登录已过期，请重新登录' });
    }
    return res.status(401).json({ error: 'INVALID_TOKEN', message: '无效的登录凭证' });
  }
}

module.exports = { sign, authMiddleware };
