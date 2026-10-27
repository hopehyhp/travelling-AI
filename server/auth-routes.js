// /api/auth 路由：注册 / 登录
const express = require('express');
const bcrypt = require('bcryptjs');
const { sign, authMiddleware } = require('./auth');
const db = require('./db');

const router = express.Router();

function validUsername(u) {
  return typeof u === 'string' && /^[A-Za-z0-9_\-\u4e00-\u9fa5]{3,20}$/.test(u.trim());
}

function validPassword(p) {
  return typeof p === 'string' && p.length >= 4 && p.length <= 64;
}

router.post('/register', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!validUsername(username)) {
    return res.status(400).json({ error: 'INVALID_USERNAME', message: '用户名需 3-20 个字符，支持中英文、数字、下划线和横杠' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'INVALID_PASSWORD', message: '密码至少 4 位、最多 64 位' });
  }

  const existing = await db.findUserByUsername(username);
  if (existing) {
    return res.status(409).json({ error: 'USER_EXISTS', message: '该用户名已被注册' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await db.createUser(username, hash);
  const token = sign(user);

  res.status(201).json({
    token,
    user: await db.getPublicUser(user.id)
  });
});

router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'MISSING_CREDENTIALS', message: '请填写用户名和密码' });
  }

  const user = await db.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '用户名或密码错误' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '用户名或密码错误' });
  }

  const token = sign(user);
  res.json({
    token,
    user: await db.getPublicUser(user.id)
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await db.getPublicUser(req.userId);
  if (!user) {
    return res.status(401).json({ error: 'USER_NOT_FOUND', message: '账号不存在' });
  }
  res.json({ user });
});

// 更新个人资料（昵称 / 邮箱 / 简介）
router.put('/me', authMiddleware, async (req, res) => {
  const body = req.body || {};
  const nickname = body.nickname !== undefined ? String(body.nickname).trim() : undefined;
  const email = body.email !== undefined ? String(body.email).trim() : undefined;
  const bio = body.bio !== undefined ? String(body.bio).trim() : undefined;

  if (nickname !== undefined && nickname.length > 20) {
    return res.status(400).json({ error: 'INVALID_NICKNAME', message: '昵称最多 20 个字符' });
  }
  if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: '邮箱格式不正确' });
  }
  if (bio !== undefined && bio.length > 120) {
    return res.status(400).json({ error: 'INVALID_BIO', message: '个人简介最多 120 个字符' });
  }

  const user = await db.updateUserProfile(req.userId, { nickname, email, bio });
  if (!user) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: '账号不存在' });
  }
  res.json({ user: await db.getPublicUser(req.userId) });
});

// 修改密码
router.put('/me/password', authMiddleware, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!validPassword(newPassword)) {
    return res.status(400).json({ error: 'INVALID_PASSWORD', message: '新密码需 4-64 位' });
  }

  const user = await db.findUserById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: '账号不存在' });
  }
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'INVALID_PASSWORD', message: '当前密码不正确' });
  }

  await db.setPasswordHash(req.userId, await bcrypt.hash(newPassword, 10));
  res.json({ ok: true });
});

module.exports = router;
