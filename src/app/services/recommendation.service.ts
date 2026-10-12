import { Injectable } from '@angular/core';
import {
  Attraction,
  BudgetLevel,
  CompanionId,
  DayPlan,
  Destination,
  PlaceTypeId,
  PLACE_TYPE_LABELS,
  PURPOSE_LABELS,
  PurposeId,
  Recommendation,
  SpotPlan,
  TravelPreferences,
  COMPANION_LABELS
} from '../models/travel.model';
import { DESTINATIONS } from '../data/travel-data';
import { SeasonService } from './season.service';

interface GenericSpot {
  name: string;
  description: string;
  cost: number;
}

const GENERIC_SPOTS: Record<PlaceTypeId, GenericSpot[]> = {
  nature: [
    { name: '城市周边自然景区', description: '徒步观景，呼吸清新空气。', cost: 80 },
    { name: '山顶观景台', description: '俯瞰城市与山野，适合看日出日落。', cost: 30 }
  ],
  history: [
    { name: '当地博物馆', description: '了解这座城市的历史与人文。', cost: 0 },
    { name: '历史街区/古城', description: '漫步老街，感受岁月痕迹。', cost: 0 }
  ],
  culture: [
    { name: '当地文化地标', description: '感受这座城市的独特文化气质。', cost: 0 },
    { name: '民俗/艺术场馆', description: '欣赏本地民俗与艺术。', cost: 40 }
  ],
  food: [
    { name: '本地特色餐厅', description: '品尝当地招牌菜。', cost: 100 },
    { name: '夜市小吃街', description: '边逛边吃，体验市井烟火气。', cost: 60 }
  ],
  shopping: [
    { name: '核心商圈', description: '品牌购物与买手店。', cost: 0 },
    { name: '特色市集/文创店', description: '淘本地手作与纪念品。', cost: 0 }
  ],
  beach: [
    { name: '海滨沙滩', description: '戏水踏浪，享受阳光。', cost: 0 },
    { name: '海岛/游船', description: '出海观景，亲近大海。', cost: 150 }
  ],
  city: [
    { name: '城市地标', description: '打卡城市天际线与地标建筑。', cost: 50 },
    { name: '网红街区漫步', description: '咖啡馆与街景，慢逛慢拍。', cost: 0 }
  ],
  amusement: [
    { name: '主题乐园', description: '游乐设施与亲子互动。', cost: 300 },
    { name: '室内亲子乐园', description: '适合低龄儿童的趣味体验。', cost: 120 }
  ],
  adventure: [
    { name: '户外徒步/漂流', description: '亲近自然的户外运动体验。', cost: 180 },
    { name: '极限运动体验', description: '攀岩/滑翔等刺激项目。', cost: 260 }
  ],
  photo: [
    { name: '网红打卡点', description: '出片率极高的拍照机位。', cost: 0 },
    { name: '老街/建筑摄影', description: '人文与建筑美学的拍摄地。', cost: 0 }
  ],
  relax: [
    { name: '温泉/SPA', description: '舒缓身心，洗去旅途疲惫。', cost: 180 },
    { name: '咖啡馆/民宿慢时光', description: '发呆、看书、享受慢节奏。', cost: 50 }
  ]
};

const SLOT_TIMES = ['09:00', '13:00', '18:00', '20:00'];

const BUDGET_LEVEL_LABELS: Record<BudgetLevel, string> = {
  economy: '经济型',
  comfort: '舒适型',
  luxury: '豪华型'
};

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  constructor(private seasonService: SeasonService) {}

  generate(prefs: TravelPreferences): Recommendation {
    const destination = this.resolveDestination(prefs);
    const picked = this.pickAttractions(prefs, destination);
    const days = this.buildDays(prefs, picked);
    const budgetLevel = this.budgetLevel(prefs);
    const costs = this.estimateCost(prefs, destination, picked, budgetLevel);
    const season = this.seasonService.buildContext(destination, prefs);
    const summary = `${destination.name} · ${prefs.days}天${prefs.people}人 · ${COMPANION_LABELS[prefs.companion]} · ${PURPOSE_LABELS[prefs.purpose]}主题，为你精选 ${picked.length} 个打卡点。`;

    return {
      destinationName: destination.name,
      summary,
      tags: this.buildTags(prefs, destination, budgetLevel, season.seasonLabel),
      budgetLevel,
      budgetLevelLabel: BUDGET_LEVEL_LABELS[budgetLevel],
      estimatedTotal: costs.total,
      overBudget: costs.total > prefs.budget * 1.1,
      attractionCount: picked.length,
      days,
      tips: this.buildTips(prefs, destination, budgetLevel),
      season
    };
  }

  private resolveDestination(prefs: TravelPreferences): Destination {
    if (prefs.destinationId === 'custom') {
      const name = prefs.customDestination.trim() || '自定义目的地';
      return this.buildCustomDestination(prefs, name);
    }
    return DESTINATIONS.find(d => d.id === prefs.destinationId) ?? DESTINATIONS[0];
  }

  private buildCustomDestination(prefs: TravelPreferences, name: string): Destination {
    const types: PlaceTypeId[] = prefs.placeTypes.length ? prefs.placeTypes : ['city', 'food'];
    const attractions: Attraction[] = [];
    types.forEach(type => {
      (GENERIC_SPOTS[type] ?? []).forEach(spot => {
        attractions.push({
          name: spot.name,
          category: type,
          categories: [type],
          purposes: [prefs.purpose],
          cost: spot.cost,
          hours: 3,
          description: spot.description
        });
      });
    });

    return {
      id: 'custom',
      name,
      region: '自定义目的地',
      intro: '根据你的偏好为你定制行程。',
      dailyTransport: 50,
      tips: ['提前查询当地天气与交通信息。', '热门景点建议提前购票或预约。', '合理安排节奏，预留休息时间。'],
      attractions
    };
  }

  private score(a: Attraction, prefs: TravelPreferences): number {
    let s = 0;
    prefs.placeTypes.forEach(t => {
      if (a.category === t) {
        s += 2;
      }
      if (a.categories.includes(t)) {
        s += 3;
      }
    });
    if (a.purposes.includes(prefs.purpose)) {
      s += 3;
    }

    const companionBonus: Record<CompanionId, PlaceTypeId[]> = {
      family: ['amusement', 'relax', 'nature'],
      couple: ['relax', 'photo', 'beach'],
      parents: ['relax', 'history'],
      friends: ['food', 'adventure', 'city', 'shopping'],
      solo: ['adventure', 'photo', 'city']
    };
    const bonuses = companionBonus[prefs.companion] ?? [];
    if (bonuses.includes(a.category)) {
      s += 2;
    }
    return s;
  }

  private pickAttractions(prefs: TravelPreferences, destination: Destination): Attraction[] {
    const capacity = this.spotsPerDay(prefs.companion) * prefs.days;
    const ranked = destination.attractions
      .map(a => ({ a, score: this.score(a, prefs) }))
      .sort((x, y) => y.score - x.score);

    const top = ranked.filter(r => r.score > 0);
    const pool = top.length ? top : ranked;
    const picked = pool.slice(0, capacity).map(r => r.a);

    if (picked.length === 0 && destination.attractions.length > 0) {
      picked.push(destination.attractions[0]);
    }
    return picked;
  }

  private spotsPerDay(companion: CompanionId): number {
    return companion === 'parents' || companion === 'family' ? 3 : 4;
  }

  private buildDays(prefs: TravelPreferences, picked: Attraction[]): DayPlan[] {
    const total = picked.length;
    const perDay = Math.max(1, Math.ceil(total / prefs.days));
    const days: DayPlan[] = [];
    let idx = 0;

    for (let d = 0; d < prefs.days; d++) {
      let slice = picked.slice(idx, idx + perDay);
      idx += perDay;
      if (slice.length === 0 && total > 0) {
        slice = [picked[d % total]];
      }
      const spots: SpotPlan[] = slice.map((a, j) => this.toSpotPlan(a, j, prefs));
      const focus = this.focusOf(spots);
      const title = d === 0
        ? `抵达 · 初见${prefs.destinationId === 'custom' ? '这座城' : this.shortName(prefs)}`
        : d === prefs.days - 1
          ? `返程 · 从容收尾`
          : `第${d + 1}天 · ${focus}`;
      days.push({ day: d + 1, title, focus, spots });
    }
    return days;
  }

  private shortName(prefs: TravelPreferences): string {
    const dest = DESTINATIONS.find(d => d.id === prefs.destinationId);
    return dest ? dest.name : '目的地';
  }

  private toSpotPlan(a: Attraction, index: number, prefs: TravelPreferences): SpotPlan {
    return {
      time: SLOT_TIMES[index % SLOT_TIMES.length],
      name: a.name,
      category: PLACE_TYPE_LABELS[a.category],
      description: a.description,
      cost: a.cost,
      stay: this.buildStay(a.hours),
      reasons: this.buildSpotReasons(a, prefs)
    };
  }

  private buildStay(hours: number): string {
    const span = Math.max(1, Number(hours) || 2);
    const lower = Math.max(1, Math.round((span - 0.5) * 2) / 2);
    return lower < span ? `${lower}–${span} 小时` : `约 ${span} 小时`;
  }

  private buildSpotReasons(a: Attraction, prefs: TravelPreferences): string[] {
    const reasons: string[] = [];
    const categoryLabel = PLACE_TYPE_LABELS[a.category];

    if (prefs.placeTypes.some(t => a.categories.includes(t))) {
      reasons.push(`贴合你想去的「${categoryLabel}」，与本次偏好高度匹配。`);
    } else {
      reasons.push(`作为「${categoryLabel}」体验补充，让行程安排更丰富。`);
    }

    if (a.purposes.includes(prefs.purpose)) {
      reasons.push(`契合「${PURPOSE_LABELS[prefs.purpose]}」的旅行目的，值得优先安排。`);
    }

    const companionReasons: Record<CompanionId, string> = {
      family: '节奏轻松、适合带娃，亲子体验友好。',
      couple: '氛围感强，适合二人同游打卡。',
      friends: '人气高、互动性强，适合朋友结伴体验。',
      parents: '强度适中、步行量可控，适合长辈同行。',
      solo: '独自前往也自在，安全且方便打卡。'
    };
    reasons.push(companionReasons[prefs.companion]);

    return reasons.slice(0, 3);
  }

  private focusOf(spots: SpotPlan[]): string {
    if (spots.length === 0) {
      return '自由活动';
    }
    const counts = new Map<string, number>();
    spots.forEach(s => counts.set(s.category, (counts.get(s.category) ?? 0) + 1));
    let best = spots[0].category;
    let bestCount = 0;
    counts.forEach((count, category) => {
      if (count > bestCount) {
        best = category;
        bestCount = count;
      }
    });
    return best;
  }

  private budgetLevel(prefs: TravelPreferences): BudgetLevel {
    const daily = prefs.budget / (prefs.people * Math.max(1, prefs.days));
    if (daily < 300) {
      return 'economy';
    }
    if (daily < 800) {
      return 'comfort';
    }
    return 'luxury';
  }

  private estimateCost(
    prefs: TravelPreferences,
    destination: Destination,
    picked: Attraction[],
    level: BudgetLevel
  ): { total: number } {
    const nights = Math.max(0, prefs.days - 1);
    const acc: Record<BudgetLevel, number> = { economy: 150, comfort: 350, luxury: 800 };
    const meal: Record<BudgetLevel, number> = { economy: 80, comfort: 150, luxury: 300 };
    const attractionSum = picked.reduce((sum, a) => sum + a.cost, 0);
    const perPerson = nights * acc[level] + prefs.days * meal[level] + prefs.days * destination.dailyTransport + attractionSum;
    return { total: Math.round(perPerson * prefs.people) };
  }

  private buildTags(
    prefs: TravelPreferences,
    destination: Destination,
    level: BudgetLevel,
    seasonLabel: string
  ): string[] {
    const tags = [destination.region, COMPANION_LABELS[prefs.companion], PURPOSE_LABELS[prefs.purpose], BUDGET_LEVEL_LABELS[level]];
    prefs.placeTypes.slice(0, 2).forEach(t => tags.push(PLACE_TYPE_LABELS[t]));
    if (seasonLabel) {
      tags.push(seasonLabel);
    }
    return tags;
  }

  private buildTips(prefs: TravelPreferences, destination: Destination, level: BudgetLevel): string[] {
    const tips = [...destination.tips];

    const companionTips: Record<CompanionId, string> = {
      family: '带娃出行建议安排午休，景点间预留休息时间。',
      couple: '推荐傍晚安排看日落或夜景，氛围感拉满。',
      friends: '热门餐厅记得提前预约，避免排队。',
      parents: '行程节奏放慢，优先选择打车或包车出行。',
      solo: '注意人身与财物安全，避免深夜单独前往偏僻区域。'
    };
    tips.push(companionTips[prefs.companion]);

    const purposeTips: Record<PurposeId, string> = {
      relax: '行程已尽量松弛，留出充足的自由活动时间。',
      adventure: '户外项目注意天气与安全装备，量力而行。',
      culture: '热门博物馆建议提前预约，避开闭馆日。',
      foodie: '人气餐厅建议错峰用餐，体验更好。',
      photo: '清晨和傍晚光线柔和，是出片的最佳时段。',
      family: '优先选择适合儿童的项目，注意安全。',
      shopping: '留意免税与退税政策，理性消费。',
      romance: '预留二人独处时光，制造浪漫回忆。'
    };
    tips.push(purposeTips[prefs.purpose]);

    if (level === 'economy') {
      tips.push('预算有限，建议优先公共交通并购买联票/早鸟票。');
    } else if (level === 'luxury') {
      tips.push('预算充裕，可升级景观酒店并提前预订热门餐厅。');
    }
    return tips;
  }
}
