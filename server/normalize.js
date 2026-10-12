const BUDGET_LEVEL_LABELS = { economy: '经济型', comfort: '舒适型', luxury: '豪华型' };

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
      : []
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
