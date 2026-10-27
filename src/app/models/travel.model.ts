export type CompanionId = 'solo' | 'couple' | 'family' | 'friends' | 'parents';
export type PlaceTypeId =
  | 'nature' | 'history' | 'culture' | 'food' | 'shopping' | 'beach'
  | 'city' | 'amusement' | 'adventure' | 'photo' | 'relax';
export type PurposeId =
  | 'relax' | 'adventure' | 'culture' | 'foodie'
  | 'photo' | 'family' | 'shopping' | 'romance';
export type BudgetLevel = 'economy' | 'comfort' | 'luxury';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

/** 目的地常年气候参考值（非实时天气），索引 0 表示 1 月 */
export interface ClimateProfile {
  avgHigh: number[];
  avgLow: number[];
  rainyMonths: number[];
  bestMonths: number[];
  note: string;
}

export interface CompanionOption {
  id: CompanionId;
  label: string;
  icon: string;
}

export interface PlaceTypeOption {
  id: PlaceTypeId;
  label: string;
  icon: string;
}

export interface PurposeOption {
  id: PurposeId;
  label: string;
  icon: string;
}

export const COMPANION_OPTIONS: CompanionOption[] = [
  { id: 'solo', label: '独自一人', icon: '🧍' },
  { id: 'couple', label: '情侣/伴侣', icon: '💑' },
  { id: 'family', label: '家庭带娃', icon: '👨‍👩‍👧' },
  { id: 'friends', label: '朋友结伴', icon: '👯' },
  { id: 'parents', label: '父母长辈', icon: '👴👵' }
];

export const PLACE_TYPE_OPTIONS: PlaceTypeOption[] = [
  { id: 'nature', label: '自然风光', icon: '🏞️' },
  { id: 'history', label: '历史文化', icon: '🏛️' },
  { id: 'culture', label: '文化体验', icon: '🎭' },
  { id: 'food', label: '美食', icon: '🍜' },
  { id: 'shopping', label: '购物', icon: '🛍️' },
  { id: 'beach', label: '海滩海岛', icon: '🏖️' },
  { id: 'city', label: '都市休闲', icon: '🏙️' },
  { id: 'amusement', label: '亲子乐园', icon: '🎡' },
  { id: 'adventure', label: '户外探险', icon: '🧗' },
  { id: 'photo', label: '摄影打卡', icon: '📸' },
  { id: 'relax', label: '休闲度假', icon: '♨️' }
];

export const PURPOSE_OPTIONS: PurposeOption[] = [
  { id: 'relax', label: '放松休闲', icon: '😌' },
  { id: 'adventure', label: '探索冒险', icon: '⛰️' },
  { id: 'culture', label: '文化体验', icon: '📜' },
  { id: 'foodie', label: '美食之旅', icon: '🍽️' },
  { id: 'photo', label: '摄影打卡', icon: '📷' },
  { id: 'family', label: '亲子同乐', icon: '🧸' },
  { id: 'shopping', label: '购物血拼', icon: '🛒' },
  { id: 'romance', label: '浪漫蜜月', icon: '💖' }
];

// 从 OPTIONS 派生 LABELS，避免 label 重复定义
export const COMPANION_LABELS = Object.fromEntries(
  COMPANION_OPTIONS.map((o) => [o.id, o.label])
) as Record<CompanionId, string>;

export const PLACE_TYPE_LABELS = Object.fromEntries(
  PLACE_TYPE_OPTIONS.map((o) => [o.id, o.label])
) as Record<PlaceTypeId, string>;

export const SEASON_LABELS: Record<SeasonId, string> = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季'
};

export const SEASON_ICONS: Record<SeasonId, string> = {
  spring: '🌸',
  summer: '☀️',
  autumn: '🍁',
  winter: '❄️'
};

export const PURPOSE_LABELS: Record<PurposeId, string> = {
  relax: '放松休闲',
  adventure: '探索冒险',
  culture: '文化体验',
  foodie: '美食之旅',
  photo: '摄影打卡',
  family: '亲子同乐',
  shopping: '购物血拼',
  romance: '浪漫蜜月'
};

export interface Attraction {
  name: string;
  category: PlaceTypeId;
  categories: PlaceTypeId[];
  purposes: PurposeId[];
  cost: number;
  hours: number;
  description: string;
}

export interface Destination {
  id: string;
  name: string;
  region: string;
  intro: string;
  dailyTransport: number;
  tips: string[];
  climate?: ClimateProfile;
  attractions: Attraction[];
}

export interface TravelPreferences {
  destinationId: string;
  customDestination: string;
  /** 用户输入的自由旅行想法，用作 AI 生成的原始上下文 */
  travelIdea?: string;
  days: number;
  people: number;
  companion: CompanionId;
  placeTypes: PlaceTypeId[];
  purpose: PurposeId;
  budget: number;
  /** 出发日期，ISO 格式 YYYY-MM-DD，空字符串表示未指定 */
  startDate: string;
}

export const DEFAULT_PREFERENCES: TravelPreferences = {
  destinationId: 'chengdu',
  customDestination: '',
  travelIdea: '',
  days: 3,
  people: 2,
  companion: 'couple',
  placeTypes: ['food', 'nature', 'history'],
  purpose: 'relax',
  budget: 5000,
  startDate: ''
};

export interface SpotPlan {
  time: string;
  name: string;
  category: string;
  description: string;
  cost: number;
  /** 费用说明：官方票价/参考价/未确认 */
  priceNote?: string;
  /** 地点说明：用于详情弹层中的 OpenStreetMap 入口和定位提示 */
  locationNote?: string;
  /** 仅用于地图搜索/定位链接，不作为官方精确坐标 */
  locationQuery?: string;
  /** 建议停留时长，如「1.5–2 小时」 */
  stay: string;
  /** AI 生成的推荐理由，用于详情弹框展示 */
  reasons: string[];
}

export interface SpotReplacementOption {
  id: string;
  name: string;
  category: string;
  description: string;
  cost: number;
  stay: string;
  reasons: string[];
  priceNote?: string;
  locationNote?: string;
  similarity?: number;
}

export interface SpotReplacementResult {
  currentSpotName: string;
  destinationName: string;
  message?: string;
  candidates: SpotReplacementOption[];
}

export interface DayPlan {
  day: number;
  title: string;
  focus: string;
  spots: SpotPlan[];
}

export interface Recommendation {
  destinationName: string;
  summary: string;
  tags: string[];
  budgetLevel: BudgetLevel;
  budgetLevelLabel: string;
  estimatedTotal: number;
  overBudget: boolean;
  attractionCount: number;
  days: DayPlan[];
  tips: string[];
  season: SeasonContext;
}

export interface SavedTravelPlan {
  preferences: TravelPreferences;
  recommendation: Recommendation;
  savedAt: string;
}

/** 由出发日期推导出的季节 / 天气 / 打包建议，全部基于常年气候参考值 */
export interface SeasonContext {
  /** 原始出发日期，未指定时为空字符串 */
  startDate: string;
  /** 形如「10月20日 - 22日」，未指定时为空字符串 */
  dateLabel: string;
  seasonId: SeasonId | null;
  seasonLabel: string;
  seasonIcon: string;
  /** 距出发天数，负数表示已出发，null 表示未指定日期 */
  daysUntil: number | null;
  isBestSeason: boolean;
  /** 形如「18~26℃」，无气候数据时为空字符串 */
  tempLabel: string;
  weatherTips: string[];
  packingList: string[];
}

export interface WeatherDay {
  date: string;
  max: number | null;
  min: number | null;
  rainChance: number | null;
  summary: string;
}

export interface TravelMapPoint {
  name: string;
  lat: number;
  lng: number;
  note?: string;
}

export interface TravelContext {
  destination: string;
  geo: {
    lat: number;
    lng: number;
    displayName: string;
  };
  weather: {
    today: WeatherDay | null;
    forecast: WeatherDay[];
  };
  highlights: TravelMapPoint[];
  smartAdvice: string[];
}
