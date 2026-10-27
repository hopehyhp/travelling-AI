// /api/plans 路由：方案 CRUD + 分享 + 导入
const express = require('express');
const db = require('./db');
const { normalize } = require('./normalize');

const router = express.Router();

function sanitizePlanInput(body) {
  const prefs = body?.preferences || {};
  const rec = body?.recommendation;
  const name = String(body?.name || '').trim().slice(0, 60) || '未命名方案';
  return { name, prefs, rec };
}

// GET /api/plans —— 列出当前用户所有方案（含分享状态）
router.get('/', async (req, res) => {
  const [plans, shares] = await Promise.all([
    db.listPlansByUser(req.userId),
    db.listSharesByUser(req.userId)
  ]);
  const shareByPlanId = new Map(shares.map((s) => [s.plan_id, s]));

  res.json({
    plans: plans.map((p) => {
      const share = shareByPlanId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        destination: p.recommendation?.destinationName || '',
        days: p.recommendation?.days?.length || p.preferences?.days || 0,
        budget: p.recommendation?.estimatedTotal || 0,
        people: p.preferences?.people || 0,
        shared: Boolean(share),
        share_token: share?.share_token || null,
        updated_at: p.updated_at,
        created_at: p.created_at
      };
    })
  });
});

// POST /api/plans —— 创建新方案
router.post('/', async (req, res) => {
  const { name, prefs, rec } = sanitizePlanInput(req.body);
  if (!rec || !Array.isArray(rec.days)) {
    return res.status(400).json({ error: 'INVALID_PLAN', message: '方案数据不完整' });
  }

  const normalized = normalize(rec, prefs);
  const plan = await db.createPlan(req.userId, name, prefs, normalized);

  res.status(201).json({
    plan: {
      id: plan.id,
      name: plan.name,
      destination: plan.recommendation?.destinationName || '',
      updated_at: plan.updated_at
    }
  });
});

// GET /api/plans/:id —— 获取单个方案详情
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'BAD_ID' });
  const plan = await db.findPlanById(id, req.userId);
  if (!plan) return res.status(404).json({ error: 'NOT_FOUND', message: '方案不存在' });
  res.json({ plan });
});

// PUT /api/plans/:id —— 更新方案
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'BAD_ID' });
  const { name, prefs, rec } = sanitizePlanInput(req.body);

  let recommendation = rec;
  if (rec && prefs && Array.isArray(rec.days)) {
    recommendation = normalize(rec, prefs);
  }

  const plan = await db.updatePlan(id, req.userId, name, prefs, recommendation);
  if (!plan) return res.status(404).json({ error: 'NOT_FOUND', message: '方案不存在' });

  res.json({ plan: { id: plan.id, name: plan.name, updated_at: plan.updated_at } });
});

// DELETE /api/plans/:id —— 删除方案（同时清理 share）
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'BAD_ID' });
  const ok = await db.deletePlan(id, req.userId);
  if (!ok) return res.status(404).json({ error: 'NOT_FOUND', message: '方案不存在' });
  res.json({ ok: true });
});

// POST /api/plans/:id/share —— 生成分享 token
router.post('/:id/share', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'BAD_ID' });
  const plan = await db.findPlanById(id, req.userId);
  if (!plan) return res.status(404).json({ error: 'NOT_FOUND', message: '方案不存在' });

  const share = await db.createShare(id, req.userId);
  if (!share) return res.status(500).json({ error: 'SHARE_FAILED' });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    share_token: share.share_token,
    share_url: `${baseUrl}/share/${share.share_token}`,
    plan_name: plan.name,
    view_count: share.view_count || 0,
    import_count: share.import_count || 0
  });
});

// GET /api/plans/:id/share —— 获取分享统计（仅 owner）
router.get('/:id/share', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'BAD_ID' });
  const stats = await db.getShareStatsByPlanId(id, req.userId);
  if (!stats) return res.status(404).json({ error: 'NOT_FOUND', message: '该方案未开启分享' });
  res.json({ share: stats });
});

// DELETE /api/plans/:id/share —— 取消分享
router.delete('/:id/share', async (req, res) => {
  const id = Number(req.params.id);
  const ok = await db.removeShare(id, req.userId);
  res.json({ ok });
});

// POST /api/plans/:id/duplicate —— 复制方案
router.post('/:id/duplicate', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'BAD_ID' });

  const plan = await db.duplicatePlan(id, req.userId);
  if (!plan) return res.status(404).json({ error: 'NOT_FOUND', message: '方案不存在' });

  res.status(201).json({
    plan: {
      id: plan.id,
      name: plan.name,
      destination: plan.recommendation?.destinationName || '',
      updated_at: plan.updated_at
    }
  });
});

// POST /api/plans/import —— 从分享 token 导入方案到当前账户
router.post('/import', async (req, res) => {
  const token = String(req.body?.share_token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'MISSING_TOKEN', message: '请提供分享 token' });
  }

  const share = await db.findShareByToken(token);
  if (!share) {
    return res.status(404).json({ error: 'SHARE_NOT_FOUND', message: '分享链接已失效或不存在' });
  }

  const snap = share.snapshot || {};
  const prefs = snap.preferences || {};
  const rec = snap.recommendation;
  if (!rec) {
    return res.status(400).json({ error: 'INVALID_SHARE', message: '分享数据不完整' });
  }

  const defaultName = `来自 ${snap.owner || '旅友'} 的 ${snap.name || '旅行方案'}`;
  const plan = await db.createPlan(req.userId, defaultName, prefs, rec);

  await db.incrementShareStat(token, 'import_count');

  res.status(201).json({
    plan: {
      id: plan.id,
      name: plan.name,
      destination: plan.recommendation?.destinationName || '',
      updated_at: plan.updated_at
    }
  });
});

module.exports = router;
