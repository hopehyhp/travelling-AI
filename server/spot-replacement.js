/**
 * 单景点替换（/api/replace-spot）相关的提示词与结果归一化。
 * 独立成文件，避免影响既有 /api/generate 的 prompt 与 normalize 行为。
 */

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function uniqueNames(values) {
  const seen = new Set();
  const result = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const name = cleanText(value);
    if (!name || seen.has(name)) {
      return;
    }
    seen.add(name);
    result.push(name);
  });
  return result;
}

/**
 * 生成“单景点替换候选”的提示词。
 * 约束：候选必须与当前目的地相关、不与已安排地点重复、费用只作参考估算。
 */
function buildSpotReplacementPrompt(payload) {
  const prefs = payload && typeof payload === 'object' ? payload : {};
  const destinationName = cleanText(prefs.destinationName) || cleanText(prefs.customDestination) || '目的地';

  const currentSpot = prefs.currentSpot && typeof prefs.currentSpot === 'object' ? prefs.currentSpot : {};
  const currentSpotName = cleanText(currentSpot.name);
  const currentSpotCategory = cleanText(currentSpot.category);
  const currentSpotDescription = cleanText(currentSpot.description);

  const dayIndex = Number(prefs.dayIndex) >= 0 ? Number(prefs.dayIndex) + 1 : 1;
  const dayTitle = cleanText(prefs.dayTitle) || `第 ${dayIndex} 天`;
  const dayFocus = cleanText(prefs.dayFocus) || '自由活动';
  const daySpotNames = uniqueNames(prefs.daySpotNames);
  const plannedSpotNames = uniqueNames(prefs.plannedSpotNames);

  const placeTypeLabels =
    (Array.isArray(prefs.placeTypeLabels) ? prefs.placeTypeLabels : []).filter((t) => cleanText(t)).join('、') || '不限';
  const travelIdea = cleanText(prefs.travelIdea);
  const dateLabel = cleanText(prefs.dateLabel) || '未指定';
  const seasonLabel = cleanText(prefs.seasonLabel);
  const tempLabel = cleanText(prefs.tempLabel);

  const seasonLines = [`- 出发日期：${dateLabel}`];
  if (seasonLabel) {
    seasonLines.push(`- 出行季节：${seasonLabel}`);
  }
  if (tempLabel) {
    seasonLines.push(`- 当地气温：${tempLabel}`);
  }

  const ideaLine = travelIdea ? `- 用户原始旅行想法：${travelIdea}` : '- 用户未提供自由文本想法。';
  const avoidLine = plannedSpotNames.length
    ? `- 当前攻略已安排这些地点，候选不得与其中任何一个重复：${plannedSpotNames.join('、')}`
    : '- 当前攻略暂无其他已安排地点。';

  return `你是一位资深的旅行规划师。用户正在精修一份已经生成的旅行攻略，需要你为「${destinationName}」行程中的单个景点提供可替换的候选方案。

## 当前行程上下文
- 目的地：${destinationName}
- 所在天数：${dayTitle}（第 ${dayIndex} 天，当天主题：${dayFocus}）
- 同一天已安排地点：${daySpotNames.length ? daySpotNames.join('、') : '暂无'}
- 出行天数：${prefs.days || 1} 天
- 出行人数：${prefs.people || 1} 人
- 同行人：${cleanText(prefs.companionLabel) || '朋友'}
- 想去的类型：${placeTypeLabels}
- 旅行目的：${cleanText(prefs.purposeLabel) || '休闲'}
- 总预算：${prefs.budget || 0} 元（人民币）
${seasonLines.join('\n')}
${ideaLine}
${avoidLine}

## 需要被替换的景点
- 名称：${currentSpotName || '未提供'}
- 类型：${currentSpotCategory || '未提供'}
- 介绍：${currentSpotDescription || '未提供'}

## 生成要求
1. 只针对「${destinationName}」生成 3 个可替换上面景点的候选，必须是真实存在、位于该目的地或周边合理可达范围内的地点。
2. 候选必须与当前目的地强相关，禁止出现其他城市或无法确认所属城市的地点，禁止使用"当地博物馆""城市地标""网红打卡点"这类泛指名称。
3. 候选要与"想去的类型""旅行目的"以及同行人特点匹配，并尽量与被替换景点的体验类型接近。
4. 每个候选写一句 15~30 字的生动介绍，突出亮点。
5. 每个候选给出建议停留时长（stay 字段），格式形如"1.5–2 小时"，结合景点规模与行程节奏合理估算。
6. 每个候选给出 2~3 条「为什么推荐它」的理由（reasons 数组），每条 12~24 字，具体不空泛。
7. cost 为单人参考花费估算（单位：元），无法确认时填 0；必须提供 priceNote 说明这是参考估算，绝对不要声称是官方票价或已确认价格。
8. 每个候选提供 locationNote，说明位置信息可能不精确，地图入口基于 OpenStreetMap 搜索。
9. 如果确实无法给出与当前目的地相关的候选，请返回空数组 candidates: []，并在 message 中说明原因，不要编造地点。

## 输出格式（极其重要）
只输出一个 JSON 对象，不要输出任何解释文字，不要使用 Markdown 代码块。结构必须严格如下：

{
  "message": "一句话说明这组候选的挑选思路",
  "candidates": [
    {
      "name": "候选景点名",
      "category": "分类名",
      "description": "15~30 字介绍",
      "cost": 80,
      "stay": "1.5–2 小时",
      "reasons": ["推荐理由1", "推荐理由2", "推荐理由3"],
      "priceNote": "参考预算估算，非官方票价。",
      "locationNote": "位置仅供参考，地图入口基于 OpenStreetMap 搜索。"
    }
  ]
}

请直接输出 JSON。`;
}

const DEFAULT_PRICE_NOTE_WITH_COST = '参考预算估算（非官方票价），实际价格请以现场为准。';
const DEFAULT_PRICE_NOTE_WITHOUT_COST = '未确认官方票价，仅作参考估算。';
const DEFAULT_LOCATION_NOTE = '位置仅供参考，未使用官方精确坐标；地图入口基于 OpenStreetMap 地点搜索。';

/**
 * 归一化 AI 返回的替换候选：
 * - 过滤与当前景点或整份攻略重复的地点
 * - 补齐费用 / 位置说明，避免把估算票价伪称官方信息
 * - 结果无效时返回空候选并给出明确 message
 */
function normalizeReplacement(data, payload) {
  const prefs = payload && typeof payload === 'object' ? payload : {};
  const destinationName = cleanText(prefs.destinationName) || cleanText(prefs.customDestination) || '目的地';
  const currentSpotName = cleanText(prefs.currentSpot && prefs.currentSpot.name);

  const excluded = new Set(uniqueNames([...(prefs.plannedSpotNames || []), ...(prefs.daySpotNames || []), currentSpotName]));
  const rawCandidates = Array.isArray(data && data.candidates) ? data.candidates : [];

  const seen = new Set();
  const candidates = [];
  rawCandidates.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }

    const name = cleanText(raw.name);
    if (!name || excluded.has(name) || seen.has(name)) {
      return;
    }
    seen.add(name);

    const cost = Number(raw.cost) > 0 ? Math.round(Number(raw.cost)) : 0;
    const reasons = (Array.isArray(raw.reasons) ? raw.reasons : [])
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 3);

    candidates.push({
      id: `${index + 1}-${name}`,
      name,
      category: cleanText(raw.category) || '景点',
      description: cleanText(raw.description),
      cost,
      stay: cleanText(raw.stay) || '1.5–2 小时',
      reasons,
      priceNote: cleanText(raw.priceNote) || (cost > 0 ? DEFAULT_PRICE_NOTE_WITH_COST : DEFAULT_PRICE_NOTE_WITHOUT_COST),
      locationNote: cleanText(raw.locationNote) || DEFAULT_LOCATION_NOTE
    });
  });

  const limited = candidates.slice(0, 4);
  const aiMessage = cleanText(data && data.message);
  const message = aiMessage || (limited.length
    ? `已为「${currentSpotName || '该景点'}」准备 ${limited.length} 个与${destinationName}相关的替换候选。`
    : `AI 未能给出与${destinationName}相关的替换候选，已保留原行程。`);

  return {
    currentSpotName,
    destinationName,
    message,
    candidates: limited
  };
}

module.exports = { buildSpotReplacementPrompt, normalizeReplacement };

