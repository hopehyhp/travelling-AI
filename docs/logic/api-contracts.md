# API 合约设计

## 1. 目标

为前端提供天气数据、地图定位和推荐增强上下文，统一封装为稳定的 JSON 接口。

## 2. 接口：GET /api/travel-intelligence

### 请求参数

- destination: 目的地名称（必填）
- startDate: 日期，格式为 YYYY-MM-DD，可选

### 响应结构

```json
{
  "destination": "成都",
  "geo": {
    "lat": 30.5728,
    "lng": 104.0668,
    "displayName": "Chengdu, Sichuan, China"
  },
  "weather": {
    "today": {
      "date": "2026-10-09",
      "temperatureMax": 25,
      "temperatureMin": 18,
      "precipitationProbability": 30,
      "summary": "晴朗，适合户外活动"
    },
    "forecast": [
      {
        "date": "2026-10-09",
        "max": 25,
        "min": 18,
        "rainChance": 30,
        "summary": "晴"
      }
    ]
  },
  "highlights": [
    { "name": "锦里古街", "lat": 30.6603, "lng": 104.0515 },
    { "name": "宽窄巷子", "lat": 30.6627, "lng": 104.0595 }
  ]
}
```

## 3. 接口：GET /api/health

### 响应

```json
{
  "ok": true,
  "model": "deepseek-chat",
  "hasKey": true
}
```

## 4. 失败场景

- 地理搜索失败：返回 404 并携带 error 字段
- 天气请求失败：返回 502 并保留前端本地季节逻辑
- 无法获取地理坐标：继续展示旅行建议，不阻塞用户

## 5. 设计原则

- 如果数据可服务端组合，则优先服务端聚合
- 所有返回均可直接被前端渲染
- 前端可被独立调试，不依赖特殊状态管理

