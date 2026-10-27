// /api/shared/:token —— 公开读取分享方案（无需登录）
const express = require('express');
const db = require('./db');

const router = express.Router();

router.get('/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'MISSING_TOKEN' });
  }

  const share = await db.findShareByToken(token);
  if (!share) {
    return res.status(404).json({ error: 'SHARE_NOT_FOUND', message: '分享链接已失效或不存在' });
  }

  // 自增浏览次数
  await db.incrementShareStat(token, 'view_count');

  const snap = share.snapshot || {};
  res.json({
    token,
    owner: snap.owner || '旅友',
    plan_name: snap.name || '未命名方案',
    preferences: snap.preferences || {},
    recommendation: snap.recommendation,
    view_count: (share.view_count || 0) + 1,
    import_count: share.import_count || 0
  });
});

module.exports = router;
