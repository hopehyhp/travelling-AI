const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { buildPrompt } = require('./prompt');
const { normalize } = require('./normalize');
const { buildSpotReplacementPrompt, normalizeReplacement } = require('./spot-replacement');
const { buildAddSpotPrompt, normalizeAddition } = require('./spot-addition');
const { buildSpotInfoPrompt, normalizeSpotInfo } = require('./spot-info');
const { authMiddleware, optionalAuthMiddleware } = require('./auth');
const db = require('./db');
const authRoutes = require('./auth-routes');
const planRoutes = require('./plan-routes');
const shareRoutes = require('./share-routes');

const app = express();

// P1-2 改进：CORS 收敛，生产环境限制来源
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true, // 无配置时允许所有（开发模式）
    credentials: true,
    maxAge: 86400
  })
);

app.use(express.json({ limit: '1mb' }));

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';

// ——— P0-2 改进：API 限流 ———
// AI 生成（花钱）：每小时 60 次（免费用户）或 120 次（登录用户）
const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req) => {
    // 登录用户额度翻倍
    const hasAuth = req.headers.authorization?.startsWith('Bearer ');
    return hasAuth ? 120 : 60;
  },
  message: { error: 'RATE_LIMITED', message: 'AI 生成调用过于频繁，请稍后再试（每小时上限）' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/auth') // auth 路由不受限
});

// 地理编码：每分钟 120 次（前端刷新频繁）
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'RATE_LIMITED', message: '定位请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false
});

// 价格区间查询：每分钟 30 次（生成行程时查询，相对低频）
const priceRangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'RATE_LIMITED', message: '价格查询过于频繁' },
  standardHeaders: true,
  legacyHeaders: false
});

// 目的地实时信息短缓存：同一目的地+日期 10 分钟内复用，避免每次改偏好都打满外网
const travelIntelCache = new Map();
const TRAVEL_INTEL_CACHE_TTL = 10 * 60 * 1000;
const TRAVEL_INTEL_CACHE_LIMIT = 100;

// 埋点上报：前端批量发送，匿名也能用
const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'RATE_LIMITED', message: '事件上报过于频繁' },
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(DEEPSEEK_API_KEY) });
});

// POST /api/events —— 批量记录产品埋点（最多 50 条/次）
app.post('/api/events', eventsLimiter, optionalAuthMiddleware, async (req, res) => {
  const rawEvents = Array.isArray(req.body && req.body.events) ? req.body.events : [];
  const sessionId = String((req.body && req.body.sessionId) || '').slice(0, 64);
  const list = [];

  for (const item of rawEvents.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || '').trim();
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(name)) continue;
    const props = item.props && typeof item.props === 'object' && !Array.isArray(item.props) ? item.props : {};
    let propsJson;
    try {
      propsJson = JSON.stringify(props);
    } catch (e) {
      continue;
    }
    if (propsJson.length > 1500) continue; // 限制单条属性大小，防止恶意上报撑爆存储
    list.push({ name, props: JSON.parse(propsJson), sessionId });
  }

  if (!list.length) {
    return res.status(400).json({ error: 'NO_VALID_EVENTS', message: '没有可用的事件' });
  }

  try {
    const accepted = await db.insertEvents(list, req.userId || null);
    res.json({ ok: true, accepted });
  } catch (err) {
    console.error('[events] error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'EVENTS_FAILED', message: '事件写入失败' });
  }
});

app.get('/api/travel-intelligence', async (req, res) => {
  const destination = String(req.query.destination || '').trim() || '目的地';
  const startDate = String(req.query.startDate || '').trim();
  const days = Math.max(0, Math.min(15, Number(req.query.days) || 0));
  const cacheKey = `${destination}::${startDate}::${days}`;
  const cached = travelIntelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TRAVEL_INTEL_CACHE_TTL) {
    return res.json(cached.data);
  }

  const fallbackGeo = { lat: 30.5728, lng: 104.0668, displayName: destination };

  try {
    // 一次地理编码同时得到城市中心与周边地点，省掉原来第三次串行外网请求
    const places = await fetchPlaces(destination, fallbackGeo);
    // 天气依赖城市坐标，必须在其后；两者之间已无多余串行等待
    const weather = await fetchWeather(destination, startDate, places.geo);
    // 超出预报窗口的行程日期：用气候接口补一份参考，避免自定义目的地全部显示「暂无」
    const climateForecast = await fetchClimateFallback(places.geo, startDate, days, weather.forecast);
    const data = {
      destination,
      geo: places.geo,
      weather,
      climateForecast,
      highlights: places.highlights,
      smartAdvice: buildSmartAdvice({ weather, destination, startDate })
    };

    if (travelIntelCache.size >= TRAVEL_INTEL_CACHE_LIMIT) {
      travelIntelCache.delete(travelIntelCache.keys().next().value);
    }
    travelIntelCache.set(cacheKey, { at: Date.now(), data });

    res.json(data);
  } catch (error) {
    console.error('[travel-intelligence] error:', error && error.message ? error.message : error);
    res.status(200).json({
      destination,
      geo: fallbackGeo,
      weather: { today: null, forecast: [] },
      climateForecast: [],
      highlights: [],
      smartAdvice: ['当前实时信息暂不可用，系统已回退到本地季节建议。']
    });
  }
});

app.post('/api/generate', generateLimiter, async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'NO_API_KEY', message: '服务端未配置 DeepSeek API Key' });
  }

  const prefs = req.body || {};
  try {
    const content = await callDeepSeek(prefs);
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('AI 返回内容无法解析为 JSON');
      }
      data = JSON.parse(match[0]);
    }
    res.json(normalize(data, prefs));
  } catch (err) {
    console.error('[generate] error:', err && err.message ? err.message : err);
    res.status(502).json({ error: 'GENERATE_FAILED', message: err && err.message ? err.message : '生成失败' });
  }
});

app.post('/api/replace-spot', generateLimiter, async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({
      currentSpotName: '',
      destinationName: '',
      message: '服务端未配置 API Key，暂时无法替换景点。',
      candidates: []
    });
  }

  const prefs = req.body || {};
  try {
    const content = await callDeepSeek(buildSpotReplacementPrompt(prefs));
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('AI 返回内容无法解析为 JSON');
      }
      data = JSON.parse(match[0]);
    }
    res.json(normalizeReplacement(data, prefs));
  } catch (err) {
    console.error('[replace-spot] error:', err && err.message ? err.message : err);
    res.status(200).json({
      currentSpotName: prefs.currentSpot && prefs.currentSpot.name ? prefs.currentSpot.name : '',
      destinationName: prefs.destinationName || prefs.customDestination || '目的地',
      message: 'AI 替换失败，已保留原景点。',
      candidates: []
    });
  }
});

// 为某一天补充单个景点：与 replace-spot 同构，但候选面向"补足当天节奏"
app.post('/api/add-spot', generateLimiter, async (req, res) => {
  const prefs = req.body || {};
  const dayIndex = Number(prefs.dayIndex) >= 0 ? Number(prefs.dayIndex) : 0;
  const destinationName = prefs.destinationName || prefs.customDestination || '目的地';

  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({
      destinationName,
      dayIndex,
      message: `服务端未配置 API Key，暂时无法为第 ${dayIndex + 1} 天补充景点，你可以手动添加。`,
      candidates: []
    });
  }

  try {
    const content = await callDeepSeek(buildAddSpotPrompt(prefs));
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('AI 返回内容无法解析为 JSON');
      }
      data = JSON.parse(match[0]);
    }
    res.json(normalizeAddition(data, prefs));
  } catch (err) {
    console.error('[add-spot] error:', err && err.message ? err.message : err);
    res.status(200).json({
      destinationName,
      dayIndex,
      message: `第 ${dayIndex + 1} 天的补充暂不可用，你可以手动添加一个地点。`,
      candidates: []
    });
  }
});

// 用户手动输入地名后，确认景点信息（坐标由前端 /api/geocode 校验）
app.post('/api/spot-info', generateLimiter, async (req, res) => {
  const prefs = req.body || {};
  const spotName = (prefs.spotName || '').trim();
  const destinationName = prefs.destinationName || prefs.customDestination || '目的地';

  if (!spotName) {
    return res.status(400).json({
      found: false,
      name: '',
      message: '请先输入景点名称。'
    });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({
      found: false,
      name: spotName,
      message: '服务端未配置 API Key，暂时无法确认该地点信息。'
    });
  }

  try {
    const content = await callDeepSeek(buildSpotInfoPrompt(prefs));
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('AI 返回内容无法解析为 JSON');
      }
      data = JSON.parse(match[0]);
    }
    res.json(normalizeSpotInfo(data, prefs));
  } catch (err) {
    console.error('[spot-info] error:', err && err.message ? err.message : err);
    res.status(200).json({
      found: false,
      name: spotName,
      message: `暂时无法确认「${spotName}」的信息，请稍后重试。`
    });
  }
});

// ——— 用户认证 & 方案 & 分享路由 ———
app.use('/api/auth', authRoutes);
app.use('/api/shared', shareRoutes);
app.use('/api/plans', authMiddleware, planRoutes);

// ——— 地点地理编码（限流保护）———
const AMAP_KEY = process.env.AMAP_API_KEY || '';

/** Haversine 公式：两点间距离（km），用于过滤偏远结果 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 从候选列表中选出距离 fallback 城市中心 ≤ maxKm 的结果 */
function filterByDistance(candidates, fallback, maxKm = 300) {
  if (!fallback) return candidates;
  return candidates.filter((c) => {
    const d = haversineKm(c.lat, c.lng, fallback.lat, fallback.lng);
    return d <= maxKm;
  });
}

app.get('/api/geocode', geocodeLimiter, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'MISSING_QUERY' });
  const city = String(req.query.city || '').trim();
  const fallbackLat = Number(req.query.lat || 0);
  const fallbackLng = Number(req.query.lng || 0);
  const fallback = fallbackLat && fallbackLng ? { lat: fallbackLat, lng: fallbackLng } : null;

  const isOversea = (() => {
    if (fallbackLat && (fallbackLat < 18 || fallbackLat > 54)) return true;
    if (fallbackLng && (fallbackLng < 73 || fallbackLng > 136)) return true;
    const chinese = /[\u4e00-\u9fa5]/;
    if (city && !chinese.test(city)) return true;
    return false;
  })();

  try {
    let results = [];

    // --- 1. 高德 POI 搜索 API（主链路，最精准） ---
    if (AMAP_KEY && !isOversea) {
      try {
        let url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(q)}&output=JSON&offset=10`;
        if (city) {
          // citylimit=true 强制只在指定城市内搜索，避免搜到其他省市同名 POI
          url += `&city=${encodeURIComponent(city)}&citylimit=true`;
        }
        const amapResp = await fetch(url);
        if (amapResp.ok) {
          const amap = await amapResp.json();
          if (amap.status === '1' && Array.isArray(amap.pois) && amap.pois.length) {
            results = amap.pois.slice(0, 5).map((p) => {
              const [lng, lat] = String(p.location || '').split(',').map(Number);
              return {
                name: p.name || q,
                display_name: [p.pname, p.cityname, p.adname, p.address].filter(Boolean).join(' '),
                lat,
                lng,
                country: '',
                admin1: p.pname || '',
                _type: 'poi',
                _typecode: p.typecode || '',
                _bizType: p.biz_type || ''
              };
            }).filter((r) => r.lat && r.lng);
          }
        }
      } catch { /* 降级 */ }
    }

    // --- 1b. 高德 geocode/geo（POI 搜不到时的兜底） ---
    if (results.length === 0 && AMAP_KEY && !isOversea) {
      try {
        let url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(q)}&output=JSON`;
        if (city) url += `&city=${encodeURIComponent(city)}`;
        const amapResp = await fetch(url);
        if (amapResp.ok) {
          const amap = await amapResp.json();
          if (amap.status === '1' && Array.isArray(amap.geocodes) && amap.geocodes.length) {
            results = amap.geocodes.slice(0, 3).map((g) => {
              const [lng, lat] = String(g.location).split(',').map(Number);
              return {
                name: g.address_component?.street || q,
                display_name: g.formatted_address,
                lat,
                lng,
                country: '',
                admin1: g.address_component?.province || ''
              };
            }).filter((r) => r.lat && r.lng);
          }
        }
      } catch { /* 降级 */ }
    }

    // --- 距离过滤：丢弃距离城市中心过远的结果（>300km 几乎肯定是错的） ---
    // 对国内 POI，城市中心 300km 半径足以覆盖整个城市及近郊
    const beforeFilter = results.length;
    results = filterByDistance(results, fallback, 300);
    if (beforeFilter > 0 && results.length === 0) {
      console.warn(`[geocode] all ${beforeFilter} candidates filtered out by distance for "${q}" near "${city}"`);
    }

    // --- 2. Open-Meteo（海外或高德完全不可用时的降级） ---
    if (results.length === 0) {
      try {
        const searchName = (city && !isOversea && !q.includes(city)) ? `${q} ${city}` : q;
        const omResp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchName)}&count=5&language=zh&format=json`
        );
        if (omResp.ok) {
          const om = await omResp.json();
          if (Array.isArray(om.results)) {
            results = om.results.map((r) => ({
              name: r.name,
              display_name: r.display_name || [r.admin1, r.country].filter(Boolean).join(', '),
              lat: Number(r.latitude),
              lng: Number(r.longitude),
              country: r.country || '',
              admin1: r.admin1 || ''
            })).filter((r) => r.lat && r.lng);
            // Open-Meteo 返回的结果也必须过距离校验
            results = filterByDistance(results, fallback, 500);
          }
        }
      } catch { /* 降级 */ }
    }

    // --- 3. 兜底：目的地中心 ---
    if (results.length === 0 && fallback) {
      results = [{
        name: q,
        display_name: '（未匹配到精确位置，使用城市中心）',
        lat: fallback.lat,
        lng: fallback.lng,
        country: '',
        admin1: ''
      }];
    }

    res.json({ results });
  } catch (error) {
    console.error('[geocode] failed:', error?.message);
    if (fallback) {
      res.json({
        results: [{ name: q, display_name: '', lat: fallback.lat, lng: fallback.lng, country: '', admin1: '' }]
      });
    } else {
      res.status(500).json({ error: 'INTERNAL' });
    }
  }
});

// ——— 价格区间查询：高德 POI ext 字段拿景点"人均消费" / 酒店参考价 ———
/** 解析高德 POI ext 字段里的价格信息（ext 是 JSON 字符串） */
function parseAmapPriceExt(extStr, poiType) {
  const result = { avgPrice: null, priceRange: null, rating: null };
  if (!extStr) return result;
  try {
    const ext = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
    // industry_suggestion 里通常有人均消费
    if (ext.industry_suggestion && typeof ext.industry_suggestion === 'object') {
      const sug = ext.industry_suggestion;
      if (sug.avgprice) result.avgPrice = Number(sug.avgprice) || null;
      if (sug.rating) result.rating = Number(sug.rating) || null;
    }
    // biz_ext 里也可能有价格
    if (ext.biz_ext && typeof ext.biz_ext === 'object') {
      const biz = ext.biz_ext;
      if (biz.cost && !result.avgPrice) result.avgPrice = Number(biz.cost) || null;
      if (biz.min_cost || biz.max_cost) {
        const lo = Number(biz.min_cost) || null;
        const hi = Number(biz.max_cost) || null;
        if (lo && hi) result.priceRange = { low: lo, high: hi };
      }
    }
  } catch { /* ext 解析失败没关系，字段不全是常态 */ }
  return result;
}

app.get('/api/price-range', priceRangeLimiter, async (req, res) => {
  const spotsRaw = String(req.query.spots || '').trim();
  const city = String(req.query.city || '').trim();
  if (!spotsRaw) return res.status(400).json({ error: 'MISSING_SPOTS' });

  const spotNames = spotsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15);
  const isOversea = city && !/[\u4e00-\u9fa5]/.test(city);

  // 没有高德 Key 或海外：直接返回空数组（让 AI 自己给参考价）
  if (!AMAP_KEY || isOversea) {
    return res.json({ source: 'ai', prices: spotNames.map((n) => ({ name: n })) });
  }

  try {
    const results = [];
    // 并发查询每个景点的价格信息（高德单次 text 搜索只返回一个 POI，需要逐个查）
    await Promise.all(spotNames.map(async (name) => {
      try {
        const keyword = city ? `${name} ${city}` : name;
        const url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(keyword)}&output=JSON&offset=1&extensions=all`;
        const amapResp = await fetch(url);
        if (!amapResp.ok) return;
        const amap = await amapResp.json();
        if (amap.status !== '1' || !Array.isArray(amap.pois) || !amap.pois.length) return;
        const poi = amap.pois[0];
        const priceInfo = parseAmapPriceExt(poi.ext, poi.type);
        results.push({
          name,
          matchedName: poi.name,
          category: poi.type,
          ...priceInfo
        });
      } catch { /* 单个查询失败不影响整体 */ }
    }));

    // 兜底：没匹配到的景点也返回条目（name only），便于 prompt 里引用
    const matchedNames = new Set(results.map((r) => r.name));
    spotNames.forEach((n) => { if (!matchedNames.has(n)) results.push({ name: n }); });

    res.json({ source: 'amap', prices: results });
  } catch (error) {
    console.error('[price-range] failed:', error?.message);
    res.json({ source: 'fallback', prices: spotNames.map((n) => ({ name: n })) });
  }
});

/** 一次地理编码同时产出城市中心与周边地点，替代原先两次重复请求 */
async function fetchPlaces(destination, fallbackGeo) {
  const query = encodeURIComponent(destination);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=zh&format=json`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return { geo: fallbackGeo, highlights: [] };
    }

    const data = await resp.json();
    const items = Array.isArray(data.results) ? data.results.slice(0, 5) : [];
    const match = items[0] ?? null;
    if (!match) {
      return { geo: fallbackGeo, highlights: [] };
    }

    const geo = {
      lat: Number(match.latitude) || fallbackGeo.lat,
      lng: Number(match.longitude) || fallbackGeo.lng,
      displayName: match.name || match.display_name || destination
    };
    const highlights = items.map((item, index) => ({
      name: item.name || `${destination}${index + 1}`,
      lat: Number(item.latitude) || geo.lat,
      lng: Number(item.longitude) || geo.lng,
      note: item.country || item.admin1 || '热门地点'
    }));

    return { geo, highlights };
  } catch (error) {
    console.error('[fetchPlaces] geocoding failed:', error && error.message ? error.message : error);
    return { geo: fallbackGeo, highlights: [] };
  }
}

async function fetchWeather(destination, startDate, geo) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(geo.lat));
  url.searchParams.set('longitude', String(geo.lng));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '16');

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error('weather lookup failed');
  }

  const json = await resp.json();
  const daily = json && json.daily && Array.isArray(json.daily.time) ? json.daily : null;
  if (!daily) {
    return { today: null, forecast: [] };
  }

  const forecast = daily.time.map((dateStr, index) => ({
    date: dateStr,
    max: Number(daily.temperature_2m_max?.[index]),
    min: Number(daily.temperature_2m_min?.[index]),
    rainChance: Number(daily.precipitation_probability_max?.[index]),
    summary: inferSummary(Number(daily.temperature_2m_max?.[index]), Number(daily.precipitation_probability_max?.[index]))
  }));

  const today = forecast[0] || null;
  return { today, forecast };
}

/** 出发日起 days 天的日期序列（YYYY-MM-DD），日期非法或未提供时返回空数组 */
function tripDateRange(startDate, days) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startDate || '').trim());
  if (!matched || days <= 0) return [];
  const start = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  if (Number.isNaN(start.getTime())) return [];
  const list = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    list.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`);
  }
  return list;
}

/**
 * 预报窗口（16 天）之外的行程日期，调用 Open-Meteo Climate API 生成气候参考。
 * 仅补齐缺失日期，接口失败时返回空数组，由前端回退到本地季节建议。
 */
async function fetchClimateFallback(geo, startDate, days, forecast) {
  const dates = tripDateRange(startDate, days);
  if (!dates.length) return [];
  const covered = new Set((forecast || []).map((item) => item.date));
  const missing = dates.filter((date) => !covered.has(date));
  if (!missing.length) return [];

  try {
    const url = new URL('https://climate-api.open-meteo.com/v1/climate');
    url.searchParams.set('latitude', String(geo.lat));
    url.searchParams.set('longitude', String(geo.lng));
    url.searchParams.set('start_date', missing[0]);
    url.searchParams.set('end_date', missing[missing.length - 1]);
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
    url.searchParams.set('models', 'EC_Earth3P_HR');

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error('climate lookup failed');
    }

    const json = await resp.json();
    const daily = json && json.daily;
    if (!daily || !Array.isArray(daily.time)) {
      return [];
    }

    return daily.time.map((dateStr, index) => {
      const max = Number(daily.temperature_2m_max?.[index]);
      const min = Number(daily.temperature_2m_min?.[index]);
      const valid = Number.isFinite(max) && Number.isFinite(min);
      return {
        date: dateStr,
        max: valid ? Math.round(max * 10) / 10 : null,
        min: valid ? Math.round(min * 10) / 10 : null,
        rainChance: null,
        summary: valid ? `气候参考：${inferSummary(max, 0)}` : '气候参考：数据暂缺'
      };
    });
  } catch (error) {
    console.error('[climate] fallback failed:', error && error.message ? error.message : error);
    return [];
  }
}

function inferSummary(maxTemp, rainChance) {
  if (rainChance >= 70) {
    return '降雨概率较高，适合室内安排';
  }
  if (maxTemp >= 30) {
    return '高温天气，适合早晚活动';
  }
  if (maxTemp <= 10) {
    return '较冷天气，注意保暖';
  }
  return '天气较适宜，适合外出游玩';
}

/** 计算出发日距今天的天数（按本地日历日），非法日期返回 null */
function daysUntilDate(startDate) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startDate || '').trim());
  if (!matched) return null;
  const target = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function buildSmartAdvice({ weather, destination, startDate }) {
  const advice = [];
  const forecast = weather && Array.isArray(weather.forecast) ? weather.forecast : [];
  const daysUntil = daysUntilDate(startDate);
  // 预报窗口只有 7 天：仅当出发日落在窗口内时，才用对应那天的天气下结论
  const travelDay = daysUntil !== null && daysUntil >= 0 && daysUntil < forecast.length
    ? forecast[daysUntil]
    : null;

  if (travelDay) {
    if (travelDay.rainChance !== null && travelDay.rainChance >= 60) {
      advice.push('出发日降雨概率较高，建议把户外景点安排在白天晴朗时段，午后多安排室内活动。');
    }
    if (travelDay.max !== null && travelDay.max >= 30) {
      advice.push('出发日预计高温，建议早起和傍晚出行，避免中午时段长时间暴晒。');
    }
    if (travelDay.max !== null && travelDay.max <= 10) {
      advice.push('出发日天气偏凉，建议携带外套和保暖层，室内博物馆和慢游路线更适合。');
    }
  } else if (startDate) {
    advice.push(`出发日（${startDate}）暂无逐日预报，以上为常年气候参考，出发前 3 天请再确认实时天气。`);
  }

  advice.push(`针对 ${destination} 的行程，建议将重点景点按"早上景点 + 午餐休息 + 晚间夜景"的节奏来排。`);
  return advice.slice(0, 4);
}

async function callDeepSeek(input) {
  // 兼容两种用法：传偏好对象（内部生成行程 prompt），或直接传已构建好的 prompt 字符串
  const prompt = typeof input === 'string' ? input : buildPrompt(input);
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一位专业的旅行规划师，只输出严格符合要求的 JSON，不要输出任何多余文字。' },
        { role: 'user', content: prompt }
      ],
      temperature: 1.0,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DeepSeek API ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const content = json && json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : '';
  if (!content) {
    throw new Error('DeepSeek 返回为空');
  }
  return content;
}

const PORT = Number(process.env.PORT) || 3000;

// ---- 生产环境：同一个服务同时托管 Angular 构建产物 ----
// 兼容两种部署结构：dist/travelling-ai（本地构建默认）或 dist 直接存放产物
const clientDirCandidates = [
  path.join(__dirname, '..', 'dist', 'travelling-ai'),
  path.join(__dirname, '..', 'dist'),
];
const clientDir = clientDirCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
if (clientDir) {
  app.use(express.static(clientDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  console.log(`[server] serving Angular build from ${clientDir}`);
} else {
  console.warn(`[server] Angular build not found (checked: ${clientDirCandidates.join(', ')}); running in API-only mode. Run "npm run build" first.`);
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (model: ${MODEL})`);
});
