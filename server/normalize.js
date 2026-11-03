const BUDGET_LEVEL_LABELS = { economy: '经济型', comfort: '舒适型', luxury: '豪华型' };

/**
 * 从 AI 返回的数据里反推目的地名称（当 destinationName 为空或占位 "目的地" 时）。
 * 推理链：
 *   summary 里取 "·" 分隔的第一段（如 "北京 · 7天..." → "北京"）
 *   tags 里取第一个非通用 tag（排除"独自一人""美食"等）
 *   spots 名称里匹配已知目的地关键字
 */
function inferDestination(data, prefs) {
  const GENERIC_TAGS = new Set(['独自一人', '情侣出游', '亲子家庭', '朋友组队', '放松休闲', '深度文化', '文化探索', '舒适型', '经济型', '豪华型', '美食', '历史文化', '自然风光', '主题乐园', '购物', '徒步']);

  // 1. 从 summary 里切 " · " 之前的部分
  if (typeof data.summary === 'string' && data.summary.trim()) {
    const m = data.summary.match(/^(.+?)\s*[·\u00b7]\s*\d+\s*天/);
    if (m && m[1]) return m[1].trim();
    const m2 = data.summary.match(/^(.+?)\s*[·\u00b7]/);
    if (m2 && m2[1]) return m2[1].trim();
  }

  // 2. 从 tags 里找第一个非通用 tag
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      if (typeof t !== 'string') continue;
      const clean = t.trim();
      if (!clean) continue;
      // 去掉 " · 中国" 后缀
      const base = clean.split('·')[0].trim();
      if (GENERIC_TAGS.has(base)) continue;
      if (base.length >= 2 && base.length <= 10) return base;
    }
  }

  // 3. 从 spots 名称里收集，找出现频次最高的城市关键字
  if (Array.isArray(data.days)) {
    const spotNames = [];
    for (const d of data.days) {
      if (Array.isArray(d.spots)) for (const s of d.spots) {
        if (typeof s?.name === 'string') spotNames.push(s.name);
      }
    }
    // 常见城市-景点映射（反向查）
    const CITY_KEYWORDS = {
      '北京': ['天坛', '故宫', '颐和园', '八达岭', '长城', '什刹海', '南锣鼓巷', '景山', '798', '圆明园', '鸟巢', '水立方', '天安门', '北海公园'],
      '上海': ['外滩', '东方明珠', '南京路', '迪士尼', '豫园', '城隍庙', '陆家嘴', '田子坊', '朱家角'],
      '成都': ['宽窄巷子', '大熊猫', '锦里', '武侯祠', '杜甫草堂', '都江堰', '春熙路', '太古里'],
      '西安': ['兵马俑', '华清池', '大雁塔', '回民街', '古城墙', '大唐不夜城', '秦始皇陵'],
      '杭州': ['西湖', '灵隐寺', '千岛湖', '宋城', '西溪湿地', '雷峰塔'],
      '丽江': ['古城', '玉龙雪山', '束河', '泸沽湖', '黑龙潭'],
      '大理': ['洱海', '大理古城', '苍山', '喜洲', '双廊'],
      '重庆': ['洪崖洞', '解放碑', '磁器口', '武隆', '长江索道', '李子坝'],
      '厦门': ['鼓浪屿', '曾厝垵', '环岛路', '南普陀', '集美学村'],
      '三亚': ['亚龙湾', '天涯海角', '蜈支洲岛', '大东海', '南山']
    };
    const counts = {};
    for (const spot of spotNames) {
      for (const [city, kws] of Object.entries(CITY_KEYWORDS)) {
        if (kws.some((k) => spot.includes(k))) {
          counts[city] = (counts[city] || 0) + 1;
        }
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted[0] && sorted[0][1] >= 1) return sorted[0][0];
  }

  return '';
}

/**
 * 修复 plan 对象里的 destinationName（原地修改 recommendation 字段）。
 * 用于分享 API / 导入 API 返回历史数据前的兜底修复，
 * 以及 normalize 阶段新生成数据的完善。
 */
function fixDestinationName(plan) {
  if (!plan || !plan.recommendation) return plan;
  const rec = plan.recommendation;
  const current = typeof rec.destinationName === 'string' ? rec.destinationName.trim() : '';
  if (current && current !== '目的地') return plan; // 已经是正确的

  // 从 preferences / recommendation 里反推
  const prefs = plan.preferences || {};
  const prefDest = prefs.customDestination || prefs.destinationName || '';
  if (prefDest) {
    rec.destinationName = prefDest.trim();
    return plan;
  }

  const inferred = inferDestination(rec, prefs);
  if (inferred) {
    rec.destinationName = inferred;
    return plan;
  }

  return plan;
}

/** 安全取数字：非法/缺省都返 defaultVal */
function toNum(val, defaultVal = 0) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : defaultVal;
}

/** 预算分项解析 + 默认值兜底（兼容旧 AI 输出没有 budgetBreakdown 的情况） */
function normalizeBudgetBreakdown(data) {
  const b = (data && typeof data.budgetBreakdown === 'object' && data.budgetBreakdown) || {};

  // 住宿三档
  const tiers = Array.isArray(b.accommodation?.tiers) ? b.accommodation.tiers.slice(0, 3) : [];
  const accommodationTiers = tiers.map((t) => ({
    level: ['economy', 'comfort', 'luxury'].includes(t.level) ? t.level : 'comfort',
    name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : '',
    perNightLow: toNum(t.perNightLow),
    perNightHigh: toNum(t.perNightHigh),
    note: typeof t.note === 'string' ? t.note.trim() : ''
  }));
  // 兜底：无论如何补齐 3 档，保证前端渲染不出错
  const tierDefaults = [
    { level: 'economy', name: '经济型', perNightLow: 200, perNightHigh: 400, note: '交通便利，干净整洁' },
    { level: 'comfort', name: '舒适型', perNightLow: 400, perNightHigh: 700, note: '商圈附近，含早' },
    { level: 'luxury', name: '豪华型', perNightLow: 700, perNightHigh: 1200, note: '度假体验，江景/主题酒店' }
  ];
  tierDefaults.forEach((d, i) => {
    if (!accommodationTiers[i]) accommodationTiers.push(d);
  });

  const food = {
    perPersonPerDayLow: toNum(b.food?.perPersonPerDayLow, 120),
    perPersonPerDayHigh: toNum(b.food?.perPersonPerDayHigh, 280),
    note: typeof b.food?.note === 'string' ? b.food.note.trim() : ''
  };

  const tickets = {
    totalLow: toNum(b.tickets?.totalLow, 300),
    totalHigh: toNum(b.tickets?.totalHigh, 600),
    note: typeof b.tickets?.note === 'string' ? b.tickets.note.trim() : ''
  };

  const transportLocal = {
    perPersonPerDayLow: toNum(b.transportLocal?.perPersonPerDayLow, 20),
    perPersonPerDayHigh: toNum(b.transportLocal?.perPersonPerDayHigh, 50),
    note: typeof b.transportLocal?.note === 'string' ? b.transportLocal.note.trim() : ''
  };

  const outbound = b.transportOutbound || {};
  const transportOutbound = {
    airLow: toNum(outbound.airLow),
    airHigh: toNum(outbound.airHigh),
    railLow: toNum(outbound.railLow),
    railHigh: toNum(outbound.railHigh),
    note: typeof outbound.note === 'string' ? outbound.note.trim() : ''
  };

  return {
    accommodation: { tiers: accommodationTiers },
    food,
    tickets,
    transportLocal,
    transportOutbound
  };
}

/** 执行计划解析 + 默认值兜底 */
function normalizeExecutionPlan(data) {
  const ex = (data && typeof data.executionPlan === 'object' && data.executionPlan) || {};

  // 交通方式
  const rawSuggestions = Array.isArray(ex.transportSuggestions) ? ex.transportSuggestions.slice(0, 3) : [];
  const transportSuggestions = rawSuggestions.map((s) => ({
    mode: ['air', 'rail', 'drive', 'bus', 'train'].includes(s.mode) ? s.mode : 'rail',
    label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : '',
    priceLow: toNum(s.priceLow),
    priceHigh: toNum(s.priceHigh),
    duration: typeof s.duration === 'string' ? s.duration.trim() : '',
    note: typeof s.note === 'string' ? s.note.trim() : ''
  }));
  // 兜底：至少 3 档
  const transportDefaults = [
    { mode: 'air', label: '飞机', priceLow: 600, priceHigh: 1500, duration: '约 2 小时', note: '远程首选，提前订有特价' },
    { mode: 'rail', label: '高铁', priceLow: 400, priceHigh: 800, duration: '约 3-4 小时', note: '准点舒适，市区到市区' },
    { mode: 'drive', label: '自驾', priceLow: 300, priceHigh: 500, duration: '约 8 小时+', note: '灵活自由，适合多人分摊' }
  ];
  transportDefaults.forEach((d, i) => {
    if (!transportSuggestions[i]) transportSuggestions.push(d);
  });

  // 酒店建议
  const rawHotels = Array.isArray(ex.hotelTiers) ? ex.hotelTiers.slice(0, 3) : [];
  const hotelTiers = rawHotels.map((h) => ({
    level: ['economy', 'comfort', 'luxury'].includes(h.level) ? h.level : 'comfort',
    name: typeof h.name === 'string' && h.name.trim() ? h.name.trim() : '',
    perNightLow: toNum(h.perNightLow),
    perNightHigh: toNum(h.perNightHigh),
    note: typeof h.note === 'string' ? h.note.trim() : ''
  }));
  const hotelDefaults = [
    { level: 'economy', name: '经济酒店', perNightLow: 200, perNightHigh: 400, note: '干净实惠，交通便利' },
    { level: 'comfort', name: '舒适酒店', perNightLow: 400, perNightHigh: 700, note: '商圈附近，含早' },
    { level: 'luxury', name: '度假酒店', perNightLow: 700, perNightHigh: 1200, note: '主题/江景/度假体验' }
  ];
  hotelDefaults.forEach((d, i) => {
    if (!hotelTiers[i]) hotelTiers.push(d);
  });

  // Checklist
  const checklist = Array.isArray(ex.checklist)
    ? ex.checklist.filter((c) => typeof c === 'string' && c.trim()).slice(0, 20).map((c) => c.trim())
    : [
        '确认出发前机票/高铁票价格是否更低',
        '下载目的地离线地图',
        '充电宝 + 数据线',
        '身份证 + 学生证/老人证（有门票优惠）',
        '洗漱用品 + 毛巾',
        '防晒霜 + 墨镜',
        '舒适的步行鞋'
      ];

  return { transportSuggestions, hotelTiers, checklist };
}

function normalize(data, prefs) {
  const days = Number(prefs.days) > 0 ? Number(prefs.days) : 1;
  const people = Number(prefs.people) > 0 ? Number(prefs.people) : 1;
  const budget = Number(prefs.budget) > 0 ? Number(prefs.budget) : 0;

  // destinationName 解析链（优先级从高到低）：
  //   1. AI 明确返回的非空、非占位字符串
  //   2. prefs 里的 customDestination / destinationName
  //   3. 从 summary 反推（AI 输出格式通常是 "目的地 · N天..."）
  //   4. 从 tags 里找第一个非通用 tag
  //   5. 从 spots 名称里匹配已知目的地
  //   6. 兜底 "目的地"
  const prefDest = prefs.customDestination || prefs.destinationName || '';
  let destinationName = (typeof data.destinationName === 'string' && data.destinationName.trim() && data.destinationName.trim() !== '目的地')
    ? data.destinationName.trim()
    : (prefDest || '');

  if (!destinationName) {
    destinationName = inferDestination(data, prefs) || '目的地';
  }

  const rawDays = Array.isArray(data.days) ? data.days : [];
  const dayPlans = rawDays.slice(0, days).map((d, i) => normalizeDay(d, i));
  while (dayPlans.length < days) {
    dayPlans.push({
      day: dayPlans.length + 1,
      title: `第 ${dayPlans.length + 1} 天`,
      focus: '自由活动',
      spots: []
    });
  }

  const budgetLevel = ['economy', 'comfort', 'luxury'].includes(data.budgetLevel)
    ? data.budgetLevel
    : 'comfort';
  const estimatedTotal = Number(data.estimatedTotal) > 0 ? Math.round(Number(data.estimatedTotal)) : 0;
  const attractionCount = dayPlans.reduce((n, d) => n + d.spots.length, 0);

  return {
    destinationName,
    summary:
      typeof data.summary === 'string' && data.summary.trim()
        ? data.summary.trim()
        : `${destinationName} · ${days} 天 ${people} 人专属行程`,
    tags: Array.isArray(data.tags)
      ? data.tags.filter((t) => typeof t === 'string' && t.trim()).slice(0, 6)
      : [],
    budgetLevel,
    budgetLevelLabel: BUDGET_LEVEL_LABELS[budgetLevel],
    estimatedTotal,
    overBudget: budget > 0 && estimatedTotal > budget * 1.1,
    attractionCount,
    days: dayPlans,
    tips: Array.isArray(data.tips)
      ? data.tips.filter((t) => typeof t === 'string' && t.trim()).slice(0, 8)
      : [],
    budgetBreakdown: normalizeBudgetBreakdown(data),
    executionPlan: normalizeExecutionPlan(data)
  };
}

function normalizeDay(d, index) {
  const spots = Array.isArray(d && d.spots) ? d.spots : [];
  return {
    day: Number(d && d.day) > 0 ? Math.round(Number(d.day)) : index + 1,
    title: typeof d && d.title === 'string' && d.title.trim() ? d.title.trim() : `第 ${index + 1} 天`,
    focus: typeof d && d.focus === 'string' && d.focus.trim() ? d.focus.trim() : '自由活动',
    spots: spots.map(normalizeSpot).filter((s) => s && s.name)
  };
}

function normalizeSpot(s) {
  if (!s || typeof s !== 'object') {
    return null;
  }
  return {
    time: typeof s.time === 'string' && s.time.trim() ? s.time.trim() : '09:00',
    name: typeof s.name === 'string' ? s.name.trim() : '',
    category: typeof s.category === 'string' && s.category.trim() ? s.category.trim() : '景点',
    description: typeof s.description === 'string' ? s.description.trim() : '',
    cost: Number(s.cost) > 0 ? Math.round(Number(s.cost)) : 0,
    stay: typeof s.stay === 'string' && s.stay.trim() ? s.stay.trim() : '1.5–2 小时',
    reasons: Array.isArray(s.reasons)
      ? s.reasons.filter((r) => typeof r === 'string' && r.trim()).map((r) => r.trim()).slice(0, 5)
      : []
  };
}

module.exports = { normalize, fixDestinationName, inferDestination };
