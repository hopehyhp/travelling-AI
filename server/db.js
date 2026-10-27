// SQLite 数据库 —— 基于 sql.js (SQLite WebAssembly)
// 零原生依赖，跨平台可用，自动从旧 data.json 迁移数据
// 所有导出函数都是 async（sql.js 初始化 + 文件读写都是异步安全的）

const fs = require('fs');
const path = require('path');

const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'data.sqlite');
const LEGACY_JSON = path.join(__dirname, 'data.json');

let db = null;

/** 初始化 SQLite：建表 + 从旧 data.json 迁移（仅首次） */
async function init() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE);
    db = new SQL.Database(new Uint8Array(buf));
  } else {
    db = new SQL.Database();
    createTables(db);

    // 自动迁移旧 data.json
    if (fs.existsSync(LEGACY_JSON)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf-8'));
        migrateFromJson(db, legacy);
        console.log('[db] migrated data.json → data.sqlite');
      } catch (e) {
        console.warn('[db] failed to migrate data.json:', e.message);
      }
    }

    save();
  }

  return db;
}

function createTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      email TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT DEFAULT '未命名方案',
      preferences TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      owner_user_id INTEGER NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      view_count INTEGER DEFAULT 0,
      import_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES plans(id),
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_shares_plan ON shares(plan_id);
    CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);
  `);
}

function migrateFromJson(db, legacy) {
  // 迁移 users
  for (const u of legacy.users || []) {
    db.run(
      'INSERT OR IGNORE INTO users (id, username, password_hash, nickname, email, bio, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [u.id, u.username, u.password_hash, u.nickname || '', u.email || '', u.bio || '', u.created_at, u.updated_at || u.created_at]
    );
  }

  // 迁移 plans
  for (const p of legacy.plans || []) {
    db.run(
      'INSERT OR IGNORE INTO plans (id, user_id, name, preferences, recommendation, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      [p.id, p.user_id, p.name || '', JSON.stringify(p.preferences || {}), JSON.stringify(p.recommendation || {}), p.created_at, p.updated_at || p.created_at]
    );
  }

  // 迁移 shares
  for (const s of legacy.shares || []) {
    db.run(
      'INSERT OR IGNORE INTO shares (id, plan_id, owner_user_id, share_token, view_count, import_count, created_at) VALUES (?,?,?,?,?,?,?)',
      [s.id, s.plan_id, s.owner_user_id, s.share_token, s.view_count || 0, s.import_count || 0, s.created_at]
    );
    // 把 snapshot 存到 plan 表里的 preferences/recommendation 中（迁移完成后 share 直接从 plan 读）
    const snap = s.snapshot || {};
    if (snap.preferences && snap.recommendation) {
      db.run(
        'UPDATE plans SET preferences = ?, recommendation = ? WHERE id = ?',
        [JSON.stringify(snap.preferences), JSON.stringify(snap.recommendation), s.plan_id]
      );
    }
  }
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

// ——— 查询辅助 ———

function queryAll(sql, params = []) {
  if (!db) throw new Error('db not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  if (!db) throw new Error('db not initialized');
  db.run(sql, params);
  save();
}

// ——— 行转对象：JSON 字段解析 ———

function hydratePlan(row) {
  if (!row) return null;
  return {
    ...row,
    preferences: JSON.parse(row.preferences || '{}'),
    recommendation: JSON.parse(row.recommendation || '{}')
  };
}

function hydrateShare(row) {
  if (!row) return null;
  // P1-3 改进：share 不再存 snapshot，直接引用 plan 当前内容
  // 这样分享链接始终展示原方案的最新版本
  const plan = queryOne('SELECT name, preferences, recommendation FROM plans WHERE id = ?', [row.plan_id]);
  const owner = queryOne('SELECT username FROM users WHERE id = ?', [row.owner_user_id]);
  return {
    id: row.id,
    plan_id: row.plan_id,
    owner_user_id: row.owner_user_id,
    share_token: row.share_token,
    view_count: row.view_count || 0,
    import_count: row.import_count || 0,
    created_at: row.created_at,
    snapshot: plan ? {
      name: plan.name,
      preferences: JSON.parse(plan.preferences || '{}'),
      recommendation: JSON.parse(plan.recommendation || '{}'),
      owner: owner?.username || '旅友'
    } : null
  };
}

// ——— Users ———

async function findUserByUsername(username) {
  await init();
  return queryOne('SELECT * FROM users WHERE username = ?', [username]);
}

async function findUserById(id) {
  await init();
  return queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

async function createUser(username, passwordHash) {
  await init();
  const now = new Date().toISOString();
  run(
    'INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?,?,?,?)',
    [username, passwordHash, now, now]
  );
  return queryOne('SELECT * FROM users WHERE id = last_insert_rowid()');
}

async function updateUserProfile(userId, patch) {
  await init();
  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return null;

  const updates = [];
  const params = [];
  if (patch.nickname !== undefined) {
    updates.push('nickname = ?');
    params.push(String(patch.nickname || '').trim().slice(0, 20));
  }
  if (patch.email !== undefined) {
    updates.push('email = ?');
    params.push(String(patch.email || '').trim().slice(0, 80));
  }
  if (patch.bio !== undefined) {
    updates.push('bio = ?');
    params.push(String(patch.bio || '').trim().slice(0, 120));
  }
  if (updates.length === 0) return user;

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(userId);

  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  return queryOne('SELECT * FROM users WHERE id = ?', [userId]);
}

async function setPasswordHash(userId, passwordHash) {
  await init();
  const user = queryOne('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) return false;
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, new Date().toISOString(), userId]);
  return true;
}

async function getUserStats(userId) {
  await init();
  const plan_count = queryOne('SELECT COUNT(*) as c FROM plans WHERE user_id = ?', [userId]).c;
  const share_count = queryOne('SELECT COUNT(*) as c FROM shares WHERE owner_user_id = ?', [userId]).c;
  return { plan_count, share_count };
}

/** 对外暴露的用户信息（不含密码） */
async function getPublicUser(userId) {
  await init();
  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return null;
  const stats = await getUserStats(userId);
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname || '',
    email: user.email || '',
    bio: user.bio || '',
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
    plan_count: stats.plan_count,
    share_count: stats.share_count
  };
}

// ——— Plans ———

async function listPlansByUser(userId) {
  await init();
  const rows = queryAll('SELECT * FROM plans WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  return rows.map(hydratePlan);
}

async function findPlanById(id, userId) {
  await init();
  const row = queryOne('SELECT * FROM plans WHERE id = ? AND user_id = ?', [id, userId]);
  return hydratePlan(row);
}

async function createPlan(userId, name, preferences, recommendation) {
  await init();
  const now = new Date().toISOString();
  run(
    'INSERT INTO plans (user_id, name, preferences, recommendation, created_at, updated_at) VALUES (?,?,?,?,?,?)',
    [userId, (name || '').trim() || '未命名方案', JSON.stringify(preferences), JSON.stringify(recommendation), now, now]
  );
  const row = queryOne('SELECT * FROM plans WHERE id = last_insert_rowid()');
  return hydratePlan(row);
}

async function updatePlan(id, userId, name, preferences, recommendation) {
  await init();
  const plan = queryOne('SELECT * FROM plans WHERE id = ? AND user_id = ?', [id, userId]);
  if (!plan) return null;

  const updates = [];
  const params = [];
  if (name !== undefined) {
    updates.push('name = ?');
    params.push((name || '').trim() || plan.name);
  }
  if (preferences) {
    updates.push('preferences = ?');
    params.push(JSON.stringify(preferences));
  }
  if (recommendation) {
    updates.push('recommendation = ?');
    params.push(JSON.stringify(recommendation));
  }
  if (updates.length === 0) return hydratePlan(plan);

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  run(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`, params);
  return hydratePlan(queryOne('SELECT * FROM plans WHERE id = ?', [id]));
}

async function deletePlan(id, userId) {
  await init();
  const plan = queryOne('SELECT id FROM plans WHERE id = ? AND user_id = ?', [id, userId]);
  if (!plan) return false;

  run('DELETE FROM plans WHERE id = ?', [id]);
  run('DELETE FROM shares WHERE plan_id = ?', [id]);
  return true;
}

async function duplicatePlan(id, userId) {
  await init();
  const source = queryOne('SELECT * FROM plans WHERE id = ? AND user_id = ?', [id, userId]);
  if (!source) return null;

  const now = new Date().toISOString();
  run(
    'INSERT INTO plans (user_id, name, preferences, recommendation, created_at, updated_at) VALUES (?,?,?,?,?,?)',
    [userId, `${source.name}（副本）`.slice(0, 60), source.preferences, source.recommendation, now, now]
  );
  const row = queryOne('SELECT * FROM plans WHERE id = last_insert_rowid()');
  return hydratePlan(row);
}

// ——— Shares ———

async function findShareByToken(token) {
  await init();
  const row = queryOne('SELECT * FROM shares WHERE share_token = ?', [token]);
  return hydrateShare(row);
}

async function createShare(planId, userId) {
  await init();
  const plan = queryOne('SELECT id FROM plans WHERE id = ? AND user_id = ?', [planId, userId]);
  if (!plan) return null;

  // 如果该 plan 已有 share，直接返回（从 plan 实时读取 snapshot）
  const existing = queryOne('SELECT * FROM shares WHERE plan_id = ?', [planId]);
  if (existing) return hydrateShare(existing);

  const crypto = require('crypto');
  const token = crypto.randomUUID();
  run(
    'INSERT INTO shares (plan_id, owner_user_id, share_token, view_count, import_count, created_at) VALUES (?,?,?,?,?,?)',
    [planId, userId, token, 0, 0, new Date().toISOString()]
  );
  const row = queryOne('SELECT * FROM shares WHERE id = last_insert_rowid()');
  return hydrateShare(row);
}

/** 自增 share 的统计字段 */
async function incrementShareStat(token, field) {
  if (field !== 'view_count' && field !== 'import_count') return null;
  await init();
  const share = queryOne('SELECT * FROM shares WHERE share_token = ?', [token]);
  if (!share) return null;
  run(`UPDATE shares SET ${field} = ${field} + 1 WHERE share_token = ?`, [token]);
  return hydrateShare(queryOne('SELECT * FROM shares WHERE share_token = ?', [token]));
}

async function getShareStatsByPlanId(planId, userId) {
  await init();
  const row = queryOne('SELECT * FROM shares WHERE plan_id = ? AND owner_user_id = ?', [planId, userId]);
  if (!row) return null;
  return {
    share_token: row.share_token,
    view_count: row.view_count || 0,
    import_count: row.import_count || 0,
    created_at: row.created_at
  };
}

async function removeShare(planId, userId) {
  await init();
  const before = queryOne('SELECT id FROM shares WHERE plan_id = ? AND owner_user_id = ?', [planId, userId]);
  if (!before) return false;
  run('DELETE FROM shares WHERE plan_id = ? AND owner_user_id = ?', [planId, userId]);
  return true;
}

async function listSharesByUser(userId) {
  await init();
  return queryAll('SELECT * FROM shares WHERE owner_user_id = ?', [userId]);
}

// 启动时预初始化（避免第一次请求才建表）
init().then(() => {
  console.log('[db] SQLite ready →', DB_FILE);
}).catch((e) => {
  console.error('[db] failed to init:', e.message);
  process.exit(1);
});

// Graceful shutdown — sql.js 是内存数据库，进程退出前必须 flush 到文件
function shutdown() {
  try {
    if (db) {
      save();
      db.close();
      console.log('[db] SQLite flushed to disk');
    }
  } catch (e) {
    console.error('[db] shutdown error:', e.message);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
  // 导出 init 方便手动调用（已在启动时自动执行）
  init,
  // Users
  findUserByUsername,
  findUserById,
  createUser,
  updateUserProfile,
  setPasswordHash,
  getUserStats,
  getPublicUser,
  // Plans
  listPlansByUser,
  findPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  duplicatePlan,
  // Shares
  findShareByToken,
  createShare,
  removeShare,
  listSharesByUser,
  incrementShareStat,
  getShareStatsByPlanId
};
