const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPrompt } = require('./prompt');
const { normalize } = require('./normalize');

test('buildPrompt keeps freeform travel idea and destination guidance', () => {
  const prompt = buildPrompt({
    travelIdea: '我想去三亚海岛度假，想看亚龙湾和蜈支洲岛，想吃海鲜和逛夜市。',
    destinationName: '三亚',
    days: 3,
    people: 2,
    companionLabel: '情侣/伴侣',
    purposeLabel: '放松休闲',
    budget: 5000,
    dateLabel: '未指定',
    seasonLabel: '夏季',
    tempLabel: '',
    climateNote: '',
    placeTypeLabels: ['海滩海岛', '美食']
  });

  assert.match(prompt, /三亚/);
  assert.match(prompt, /亚龙湾/);
  assert.match(prompt, /蜈支洲岛/);
  assert.match(prompt, /优先保留/);
});

test('normalize uses the AI destination for freeform requests and preserves legacy request destinations', () => {
  const aiResult = normalize({
    destinationName: '三亚',
    summary: '三亚 3 天 2 人海岛度假路线',
    tags: ['海岛度假'],
    budgetLevel: 'comfort',
    estimatedTotal: 4500,
    days: [{ day: 1, title: '第 1 天', focus: '海岛初体验', spots: [{ time: '09:00', name: '亚龙湾', category: '海滩海岛', description: '沙滩细软适合放松', cost: 0, stay: '2–3 小时', reasons: ['适合海岛度假'] }] }],
    tips: ['注意防晒']
  }, {
    destinationName: '自定义目的地',
    travelIdea: '我想去三亚看亚龙湾。',
    days: 3,
    people: 2,
    budget: 5000
  });

  assert.equal(aiResult.destinationName, '三亚');
  assert.equal(aiResult.summary, '三亚 3 天 2 人海岛度假路线');

  const legacyResult = normalize({
    destinationName: '三亚',
    summary: '海岛度假路线',
    tags: ['海岛度假'],
    budgetLevel: 'comfort',
    estimatedTotal: 3500,
    days: [],
    tips: ['注意防晒']
  }, { destinationName: '成都', days: 3, people: 2, budget: 5000 });

  assert.equal(legacyResult.destinationName, '成都');
});

test('buildPrompt retains legacy defaults when freeform text is absent', () => {
  const prompt = buildPrompt({});

  assert.match(prompt, /出行天数：1 天/);
  assert.match(prompt, /出行人数：1 人/);
  assert.match(prompt, /总预算：0 元/);
  assert.match(prompt, /同行人：朋友/);
  assert.match(prompt, /旅行目的：休闲/);
});
