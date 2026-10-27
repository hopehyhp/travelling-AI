const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { buildPrompt } = require('./prompt');
const { normalize } = require('./normalize');
const { buildSpotReplacementPrompt, normalizeReplacement } = require('./spot-replacement');
const { authMiddleware } = require('./auth');
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(DEEPSEEK_API_KEY) });
});

app.get('/api/travel-intelligence', async (req, res) => {
  const destination = String(req.query.destination || '').trim() || '目的地';
  const startDate = String(req.query.startDate || '').trim();
  const fallbackGeo = { lat: 30.5728, lng: 104.0668, displayName: destination };

  try {
    const geo = await fetchGeo(destination, fallbackGeo);
    const weather = await fetchWeather(destination, startDate, geo);
    const highlights = await fetchHighlights(destination, geo);
    const smartAdvice = buildSmartAdvice({ weather, destination, startDate });

    res.json({
      destination,
      geo,
      weather,
      highlights,
      smartAdvice
    });
  } catch (error) {
    console.error('[travel-intelligence] error:', error && error.message ? error.message : error);
    res.status(200).json({
      destination,
      geo: fallbackGeo,
      weather: { today: null, forecast: [] },
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

// ——— 用户认证 & 方案 & 分享路由 ———
app.use('/api/auth', authRoutes);
app.use('/api/shared', shareRoutes);
app.use('/api/plans', authMiddleware, planRoutes);

// ——— 地点地理编码（限流保护）———
const AMAP_KEY = process.env.AMAP_API_KEY || '';

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

    // --- 1. 高德 Web 服务 API ---
    if (AMAP_KEY && !isOversea) {
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
                name: g.address_component?.street || g.formatted_address?.split(/[省市]/)[1] || q,
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

    // --- 2. Open-Meteo ---
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

async function fetchGeo(destination, fallbackGeo) {
  const query = encodeURIComponent(destination);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=zh&format=json`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return fallbackGeo;
    }

    const data = await resp.json();
    const match = Array.isArray(data.results) && data.results[0] ? data.results[0] : null;
    if (!match) {
      return fallbackGeo;
    }

    return {
      lat: Number(match.latitude) || fallbackGeo.lat,
      lng: Number(match.longitude) || fallbackGeo.lng,
      displayName: match.name || match.display_name || destination
    };
  } catch (error) {
    console.error('[fetchGeo] geocoding failed:', error && error.message ? error.message : error);
    return fallbackGeo;
  }
}

async function fetchWeather(destination, startDate, geo) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(geo.lat));
  url.searchParams.set('longitude', String(geo.lng));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');

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

async function fetchHighlights(destination, geo) {
  const query = encodeURIComponent(destination);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=zh&format=json`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return [];
    }

    const data = await resp.json();
    const items = Array.isArray(data.results) ? data.results.slice(0, 5) : [];
    return items.map((item, index) => ({
      name: item.name || `${destination}${index + 1}`,
      lat: Number(item.latitude) || geo.lat,
      lng: Number(item.longitude) || geo.lng,
      note: item.country || item.admin1 || '热门地点'
    }));
  } catch (error) {
    console.error('[fetchHighlights] geocoding failed:', error && error.message ? error.message : error);
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

function buildSmartAdvice({ weather, destination, startDate }) {
  const advice = [];
  if (weather && weather.forecast && weather.forecast.length > 0) {
    const first = weather.forecast[0];
    if (first && first.rainChance !== null && first.rainChance >= 60) {
      advice.push('当前天气有明显降雨风险，建议把户外景点安排在白天晴朗时段，午后多安排室内活动。');
    }
    if (first && first.max !== null && first.max >= 30) {
      advice.push('预计高温天气，建议早起和傍晚出行，避免中午时段长时间暴晒。');
    }
    if (first && first.max !== null && first.max <= 10) {
      advice.push('天气偏凉，建议携带外套和保暖层，室内博物馆和慢游路线更适合。');
    }
  }

  if (startDate) {
    advice.push(`出发日期为 ${startDate}，建议结合当地天气做调整，避免把雨天/高温时段安排给关键景点。`);
  }

  advice.push(`针对 ${destination} 的行程，建议将重点景点按"早上景点 + 午餐休息 + 晚间夜景"的节奏来排。`);
  return advice.slice(0, 4);
}

async function callDeepSeek(prefs) {
  const prompt = buildPrompt(prefs);
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
const clientDir = path.join(__dirname, '..', 'dist', 'travelling-ai');
if (fs.existsSync(path.join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  console.log(`[server] serving Angular build from ${clientDir}`);
} else {
  console.warn(`[server] Angular build not found at ${clientDir}; running in API-only mode. Run "npm run build" first.`);
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (model: ${MODEL})`);
});
