/**
 * 用户手动输入地点后的「信息与位置确认」（/api/spot-info）。
 * 只负责把地名整理成结构化景点信息，坐标由前端 /api/geocode 链路确认。
 */

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

const DEFAULT_PRICE_NOTE = '参考预算估算（非官方票价），实际价格请以现场为准。';
const DEFAULT_LOCATION_NOTE = '位置仅供参考，地图入口基于 OpenStreetMap 地点搜索。';

function buildSpotInfoPrompt(payload) {
  const prefs = payload && typeof payload === 'object' ? payload : {};
  const destinationName = cleanText(prefs.destinationName) || '目的地';
  const spotName = cleanText(prefs.spotName);
  const travelIdea = cleanText(prefs.travelIdea);
  const seasonLabel = cleanText(prefs.seasonLabel);
  const tempLabel = cleanText(prefs.tempLabel);
  const dateLabel = cleanText(prefs.dateLabel) || '未指定';

  const contextLines = [
    `- 目的地：${destinationName}`,
    `- 用户输入的地点名：${spotName}`,
    `- 出发日期：${dateLabel}`
  ];
  if (seasonLabel) {
    contextLines.push(`- 出行季节：${seasonLabel}`);
  }
  if (tempLabel) {
    contextLines.push(`- 当地气温：${tempLabel}`);
  }
  if (travelIdea) {
    contextLines.push(`- 用户旅行想法：${travelIdea}`);
  }

  return `你是一位熟悉各地景点的旅行规划师。用户手动输入了一个地点，需要你确认它是否真实存在于「${destinationName}」或其合理可达范围内，并补全景点信息。

## 上下文
${contextLines.join('\n')}

## 要求
1. 先判断该地点是否真实存在，并且位于「${destinationName}」或周边合理可达范围内。
2. 如果不存在、不属于该目的地或无法确认，返回 found: false，并给出简短原因，不要编造信息。
3. 如果确认存在：
   - name 使用规范全称（保留常见别名可放在 description 里）。
   - category 归入常见类型，如"自然风光""人文古迹""博物馆""街区""公园""主题乐园""宗教场所""观景台""市集"等。
   - description 用 15~30 字说明亮点。
   - cost 为单人参考花费（元），免费或无法确认填 0；priceNote 必须说明是参考估算，不得声称官方票价。
   - stay 为建议停留时长，格式如"1–1.5 小时"。
   - addressHint 给出便于地图检索的地址线索（如"西湖区龙井路 1 号附近"），不要编造精确门牌号。
4. 只输出一个 JSON 对象，不要输出任何解释文字，不要使用 Markdown 代码块。

## 输出格式
{
  "found": true,
  "message": "一句话说明判断结果",
  "name": "规范名称",
  "category": "类型",
  "description": "15~30 字介绍",
  "cost": 0,
  "stay": "1–1.5 小时",
  "priceNote": "参考预算估算，非官方票价。",
  "addressHint": "便于检索的地址线索"
}

若无法确认，输出：
{ "found": false, "message": "无法确认该地点是否位于目的地范围内", "name": "${spotName}" }

请直接输出 JSON。`;
}

function normalizeSpotInfo(data, payload) {
  const prefs = payload && typeof payload === 'object' ? payload : {};
  const fallbackName = cleanText(prefs.spotName) || '该地点';
  const destinationName = cleanText(prefs.destinationName) || '目的地';

  if (!data || typeof data !== 'object' || !data.found) {
    return {
      found: false,
      name: cleanText(data && data.name) || fallbackName,
      message: cleanText(data && data.message) || `未能确认「${fallbackName}」是否位于${destinationName}范围内，请检查名称或换一个地点。`,
      category: '',
      description: '',
      cost: 0,
      stay: '',
      priceNote: '',
      addressHint: ''
    };
  }

  const cost = Number(data.cost) > 0 ? Math.round(Number(data.cost)) : 0;
  return {
    found: true,
    name: cleanText(data.name) || fallbackName,
    message: cleanText(data.message) || `已确认「${fallbackName}」位于${destinationName}。`,
    category: cleanText(data.category) || '景点',
    description: cleanText(data.description) || `${destinationName}的自定义景点。`,
    cost,
    stay: cleanText(data.stay) || '1–1.5 小时',
    priceNote: cleanText(data.priceNote) || DEFAULT_PRICE_NOTE,
    addressHint: cleanText(data.addressHint),
    locationNote: DEFAULT_LOCATION_NOTE
  };
}

module.exports = { buildSpotInfoPrompt, normalizeSpotInfo };
