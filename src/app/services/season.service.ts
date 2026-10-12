import { Injectable } from '@angular/core';
import {
  ClimateProfile,
  CompanionId,
  Destination,
  SeasonContext,
  SeasonId,
  SEASON_ICONS,
  SEASON_LABELS,
  TravelPreferences
} from '../models/travel.model';

const SEASON_GENERIC_TIPS: Record<SeasonId, string> = {
  spring: '春季天气多变、昼夜温差大，建议洋葱式穿搭并随身带把伞。',
  summer: '夏季高温强晒，注意补水防暑，户外活动尽量安排在早晚。',
  autumn: '秋季天高气爽，但早晚转凉，记得带一件薄外套。',
  winter: '冬季寒冷，注意保暖防滑，室内外温差大需方便穿脱的外套。'
};

@Injectable({ providedIn: 'root' })
export class SeasonService {
  /** 当前本地日期，格式 YYYY-MM-DD */
  todayIso(): string {
    return this.toIso(new Date());
  }

  /** 把日期格式化为 YYYY-MM-DD */
  toIso(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  /** 从 from 起偏移 days 天，返回 YYYY-MM-DD */
  shiftIso(days: number, from: Date = new Date()): string {
    return this.toIso(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
  }

  /** 最近的周六（若今天就是周六则返回今天） */
  nextWeekendIso(): string {
    const now = new Date();
    return this.shiftIso((6 - now.getDay() + 7) % 7, now);
  }

  /** 下个月 1 号 */
  nextMonthIso(): string {
    const now = new Date();
    return this.toIso(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  }

  /** 出发日期快捷选项（空 value 表示「还没定」） */
  quickDateOptions(): { label: string; value: string }[] {
    return [
      { label: '本周末', value: this.nextWeekendIso() },
      { label: '下周', value: this.shiftIso(7) },
      { label: '下个月', value: this.nextMonthIso() },
      { label: '还没定', value: '' }
    ];
  }

  /** 解析 YYYY-MM-DD 为本地日期，非法日期返回 null */
  parseIso(iso: string): Date | null {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? '').trim());
    if (!matched) {
      return null;
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const date = new Date(year, month - 1, day);
    // 过滤 2026-02-30 这类被 Date 自动进位的非法日期
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  seasonOf(month: number): SeasonId {
    if (month >= 3 && month <= 5) {
      return 'spring';
    }
    if (month >= 6 && month <= 8) {
      return 'summer';
    }
    if (month >= 9 && month <= 11) {
      return 'autumn';
    }
    return 'winter';
  }

  /** 把月份数组格式化为「3-5月、9-11月」 */
  formatMonths(months: number[]): string {
    const sorted = [...new Set(months)].sort((a, b) => a - b);
    if (!sorted.length) {
      return '';
    }
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const current = sorted[i];
      if (current !== undefined && current === prev + 1) {
        prev = current;
        continue;
      }
      ranges.push(start === prev ? `${start}月` : `${start}-${prev}月`);
      start = current as number;
      prev = current as number;
    }
    return ranges.join('、');
  }

  buildContext(destination: Destination | null, prefs: TravelPreferences): SeasonContext {
    const start = this.parseIso(prefs.startDate);
    if (!start) {
      return this.emptyContext();
    }

    const days = Math.max(1, Number(prefs.days) || 1);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days - 1);
    const months = this.monthsCovered(start, end);
    const seasonId = this.seasonOf(start.getMonth() + 1);
    const climate = destination?.climate;

    const temp = climate ? this.tempRange(climate, months) : null;
    const rainy = climate ? months.some(m => climate.rainyMonths.includes(m)) : false;
    const isBestSeason = climate ? months.every(m => climate.bestMonths.includes(m)) : false;

    return {
      startDate: prefs.startDate.trim(),
      dateLabel: this.dateLabel(start, end),
      seasonId,
      seasonLabel: SEASON_LABELS[seasonId],
      seasonIcon: SEASON_ICONS[seasonId],
      daysUntil: this.daysBetween(new Date(), start),
      isBestSeason,
      tempLabel: temp ? `${temp.minLow}~${temp.maxHigh}℃` : '',
      weatherTips: this.buildWeatherTips(destination, climate, seasonId, months, temp, rainy, isBestSeason),
      packingList: this.buildPackingList(destination, prefs, climate, seasonId, temp, rainy)
    };
  }

  private emptyContext(): SeasonContext {
    return {
      startDate: '',
      dateLabel: '',
      seasonId: null,
      seasonLabel: '',
      seasonIcon: '',
      daysUntil: null,
      isBestSeason: false,
      tempLabel: '',
      weatherTips: [],
      packingList: []
    };
  }

  private buildWeatherTips(
    destination: Destination | null,
    climate: ClimateProfile | undefined,
    seasonId: SeasonId,
    months: number[],
    temp: { minLow: number; maxHigh: number } | null,
    rainy: boolean,
    isBestSeason: boolean
  ): string[] {
    const name = destination?.name ?? '目的地';
    const tips: string[] = [];

    if (!climate || !temp) {
      tips.push(`${SEASON_LABELS[seasonId]}出行：${SEASON_GENERIC_TIPS[seasonId]}`);
      tips.push('该目的地暂无气候参考数据，出发前 3 天请再确认当地实时天气与预警信息。');
      return tips;
    }

    tips.push(`${name}${SEASON_LABELS[seasonId]}出行参考：${climate.note}`);
    tips.push(`当地常年气温约 ${temp.minLow}~${temp.maxHigh}℃，${this.tempAdvice(temp.minLow, temp.maxHigh)}`);

    if (rainy) {
      tips.push('出行时段正值当地多雨期，随身带伞或轻便雨衣，每天预留一个室内备选方案。');
    }
    if (isBestSeason) {
      tips.push('这段时间正是当地最佳出行季节，风景与体感都不错，热门景点建议提前预约。');
    } else {
      tips.push(
        `${this.formatMonths(months)}并非当地最佳季节（更推荐 ${this.formatMonths(climate.bestMonths)}），` +
          '请按上面的气温准备衣物，并为天气变化留出机动时间。'
      );
    }
    return tips;
  }

  private tempAdvice(minLow: number, maxHigh: number): string {
    const parts: string[] = [];
    if (maxHigh >= 33) {
      parts.push('白天酷热，防晒补水优先，尽量避开正午的户外活动');
    } else if (maxHigh >= 28) {
      parts.push('白天偏热，以轻薄透气的衣物为主');
    } else if (maxHigh <= 5) {
      parts.push('白天严寒，需要厚外套或羽绒服');
    } else if (maxHigh <= 15) {
      parts.push('白天偏凉，建议外套加毛衣叠穿');
    } else {
      parts.push('体感温和，长袖或薄外套即可');
    }

    if (minLow <= 0) {
      parts.push('夜间可能降至冰点以下，务必带足保暖层');
    } else if (minLow <= 8) {
      parts.push('早晚偏冷，记得带一件保暖外套');
    }
    if (maxHigh - minLow >= 10) {
      parts.push('昼夜温差较大，洋葱式穿搭最实用');
    }
    return `${parts.join('；')}。`;
  }

  private buildPackingList(
    destination: Destination | null,
    prefs: TravelPreferences,
    climate: ClimateProfile | undefined,
    seasonId: SeasonId,
    temp: { minLow: number; maxHigh: number } | null,
    rainy: boolean
  ): string[] {
    const items = ['身份证 / 证件', '手机充电器与充电宝', '常用药品（感冒、肠胃、创可贴）'];

    if (temp) {
      if (temp.maxHigh >= 30) {
        items.push('防晒霜（SPF50+）', '遮阳帽 / 墨镜', '速干透气衣物');
      } else if (temp.maxHigh <= 10) {
        items.push('厚外套 / 羽绒服', '保暖内衣', '围巾与手套');
      } else {
        items.push('薄外套 / 长袖');
      }
      if (temp.minLow <= 5) {
        items.push('保暖层 / 暖宝宝');
      }
      if (temp.minLow <= 12 || seasonId === 'winter') {
        items.push('润唇膏 / 护手霜');
      }
    } else {
      items.push('按季节准备的换洗衣物');
    }

    if (rainy) {
      items.push('折叠伞 / 轻便雨衣', '防水鞋或备用鞋');
    }

    if (prefs.placeTypes.includes('beach')) {
      items.push('泳衣 / 沙滩鞋 / 防水手机袋');
    }
    if (prefs.placeTypes.includes('photo')) {
      items.push('相机 / 备用电池与存储卡');
    }
    if (prefs.placeTypes.includes('adventure')) {
      items.push('运动鞋 / 轻便背包 / 户外水壶');
    }

    const companionItems: Partial<Record<CompanionId, string[]>> = {
      family: ['儿童常用药 / 湿巾 / 小零食'],
      parents: ['慢性病常备药 / 保温杯'],
      solo: ['行程分享给家人，保持通讯畅通']
    };
    items.push(...(companionItems[prefs.companion] ?? []));

    if (destination?.region.includes('海外')) {
      items.push('护照 / 签证与复印件', '电源转换插头', '境外流量卡或漫游包', '少量当地货币');
    }

    return [...new Set(items)].slice(0, 12);
  }

  private monthsCovered(start: Date, end: Date): number[] {
    const months = new Set<number>();
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor.getTime() <= end.getTime()) {
      months.add(cursor.getMonth() + 1);
      cursor.setDate(cursor.getDate() + 1);
    }
    return [...months].sort((a, b) => a - b);
  }

  private tempRange(climate: ClimateProfile, months: number[]): { minLow: number; maxHigh: number } {
    const highs = months.map(m => climate.avgHigh[m - 1]);
    const lows = months.map(m => climate.avgLow[m - 1]);
    return { minLow: Math.min(...lows), maxHigh: Math.max(...highs) };
  }

  private dateLabel(start: Date, end: Date): string {
    const yearPrefix = start.getFullYear() === new Date().getFullYear() ? '' : `${start.getFullYear()}年`;
    const head = `${yearPrefix}${start.getMonth() + 1}月${start.getDate()}日`;
    if (start.getMonth() === end.getMonth()) {
      return `${head} - ${end.getDate()}日`;
    }
    return `${head} - ${end.getMonth() + 1}月${end.getDate()}日`;
  }

  private daysBetween(from: Date, to: Date): number {
    const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return Math.round((b - a) / 86400000);
  }

  private pad(value: number): string {
    return value < 10 ? `0${value}` : String(value);
  }
}
