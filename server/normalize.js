const BUDGET_LEVEL_LABELS = { economy: '经济型', comfort: '舒适型', luxury: '豪华型' };

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
  const requestDestination = prefs.destinationName || prefs.customDestination || '目的地';
  const hasTravelIdea = typeof prefs.travelIdea === 'string' && prefs.travelIdea.trim();
  const destinationName = hasTravelIdea && typeof data.destinationName === 'string' && data.destinationName.trim()
    ? data.destinationName.trim()
    : requestDestination;

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

module.exports = { normalize };
