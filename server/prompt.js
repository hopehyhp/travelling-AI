function buildPrompt(prefs) {
  const destinationName = prefs.destinationName || prefs.customDestination || '目的地';
  const placeTypeLabels = (Array.isArray(prefs.placeTypeLabels) ? prefs.placeTypeLabels : []).join('、') || '不限';
  const days = prefs.days || 1;
  const people = prefs.people || 1;
  const budget = prefs.budget || 0;
  const dateLabel = prefs.dateLabel || '未指定';
  const seasonLabel = prefs.seasonLabel || '';
  const tempLabel = prefs.tempLabel || '';
  const climateNote = prefs.climateNote || '';
  const travelIdea = typeof prefs.travelIdea === 'string' ? prefs.travelIdea.trim() : '';

  const seasonLines = [`- 出发日期：${dateLabel}`];
  if (seasonLabel) {
    seasonLines.push(`- 出行季节：${seasonLabel}`);
  }
  if (tempLabel) {
    seasonLines.push(`- 当地气温：${tempLabel}`);
  }
  if (climateNote) {
    seasonLines.push(`- 气候特点：${climateNote}`);
  }

  const seasonRequirement = prefs.startDate
    ? `9. 行程必须贴合「${dateLabel}」的${seasonLabel}气候：优先安排当季最合适的项目，主动避开反季节活动（例如严寒时避免长时间户外徒步、雨季避免涉水项目），并在 tips 中给出针对该季节的穿衣、防晒或防雨提醒。`
    : `9. 用户尚未确定出发日期，请安排四季皆宜的行程，并在 tips 中提醒不同季节的注意事项。`;

  const ideaInstruction = travelIdea
    ? `- 用户原始旅行想法：${travelIdea}\n- 若其中明确提到目的地、城市、景点、活动或路线名称，优先保留并安排这些地点，输出中不要泛化为“当地景点”“城市打卡点”等模糊表述。\n- 如果想法里没有给出全部旅行条件，未填写的条件默认按 3 天、2 人、情侣同行、¥5000 规划。\n- 生成时优先使用用户提到的具体景点、主目的地和路线关键词，确保攻略主题和景点安排与描述一致。`
    : '- 用户未提供自由文本想法，按常规偏好生成标准旅行攻略。';

  return `你是一位资深的旅行规划师，请根据用户提供的旅行偏好，生成一份详细、专业、个性化的旅行攻略。

## 用户偏好
- 目的地：${destinationName}
- 旅行想法：${travelIdea || '未提供'}
- 出行天数：${days} 天
- 出行人数：${people} 人
- 同行人：${prefs.companionLabel || '朋友'}
- 想去的类型：${placeTypeLabels}
- 旅行目的：${prefs.purposeLabel || '休闲'}
- 总预算：${budget} 元（人民币）
${seasonLines.join('\n')}

${ideaInstruction}

## 生成要求
1. 每天安排 2~4 个景点，必须是真实存在、知名度高的具体地点（不要用"当地博物馆""城市地标""网红打卡点"这类泛指名称）。
2. 景点要贴合"想去的类型"和"旅行目的"，并考虑"同行人"的特点（如带娃要有亲子项目、带父母要节奏舒缓）。
3. 合理安排上午、下午、晚上的活动，景点动线顺畅，不要来回折返。
4. 每个景点写一句 15~30 字的生动介绍，突出亮点。
5. 每个景点给出建议停留时长（stay 字段），格式形如"1.5–2 小时"，需结合景点规模与行程节奏合理估算。
6. 每个景点额外给出 2~3 条「为什么推荐它」的理由（reasons 数组），结合用户偏好、同行人、季节与行程动线，说明该景点的推荐价值，每条 12~24 字，具体不空泛。
7. 结合预算水平，estimatedTotal 为 ${people} 人总花费的合理估算（单位：元）。
8. budgetLevel 取 economy(经济型)、comfort(舒适型)、luxury(豪华型) 之一，根据总预算、天数、人数综合判断。
${seasonRequirement}
10. 给出 4~6 条具体实用的旅行贴士，避免空话套话。

## 输出格式（极其重要）
只输出一个 JSON 对象，不要输出任何解释文字，不要使用 Markdown 代码块。结构必须严格如下：

{
  "summary": "一句话概括这段旅程",
  "tags": ["标签1", "标签2", "标签3", "标签4"],
  "budgetLevel": "economy",
  "estimatedTotal": 5000,
  "days": [
    {
      "day": 1,
      "title": "当天的标题",
      "focus": "当天的主题",
      "spots": [
        { "time": "09:00", "name": "景点名", "category": "分类名", "description": "介绍", "cost": 100, "stay": "1.5–2 小时", "reasons": ["推荐理由1", "推荐理由2", "推荐理由3"] }
      ]
    }
  ],
  "tips": ["贴士1", "贴士2"]
}

请直接输出 JSON。`;
}

module.exports = { buildPrompt };
