import { SeasonService } from './season.service';
import { Destination, TravelPreferences, DEFAULT_PREFERENCES } from '../models/travel.model';
import { DESTINATIONS } from '../data/travel-data';

function prefs(overrides: Partial<TravelPreferences>): TravelPreferences {
  return { ...DEFAULT_PREFERENCES, placeTypes: [...DEFAULT_PREFERENCES.placeTypes], ...overrides };
}

function destination(id: string): Destination {
  const found = DESTINATIONS.find(d => d.id === id);
  if (!found) {
    throw new Error(`未找到目的地 ${id}`);
  }
  return found;
}

describe('SeasonService', () => {
  let service: SeasonService;

  beforeEach(() => {
    service = new SeasonService();
  });

  describe('parseIso', () => {
    it('解析合法的 ISO 日期', () => {
      const date = service.parseIso('2026-02-14');
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(1);
      expect(date!.getDate()).toBe(14);
    });

    it('拒绝被 Date 自动进位的非法日期', () => {
      expect(service.parseIso('2026-02-30')).toBeNull();
      expect(service.parseIso('2026-13-01')).toBeNull();
    });

    it('拒绝格式不正确的输入', () => {
      expect(service.parseIso('')).toBeNull();
      expect(service.parseIso('2026-2-3')).toBeNull();
      expect(service.parseIso('明天')).toBeNull();
    });
  });

  describe('seasonOf', () => {
    it('按月份划分四季', () => {
      expect(service.seasonOf(3)).toBe('spring');
      expect(service.seasonOf(5)).toBe('spring');
      expect(service.seasonOf(6)).toBe('summer');
      expect(service.seasonOf(8)).toBe('summer');
      expect(service.seasonOf(9)).toBe('autumn');
      expect(service.seasonOf(11)).toBe('autumn');
      expect(service.seasonOf(12)).toBe('winter');
      expect(service.seasonOf(1)).toBe('winter');
      expect(service.seasonOf(2)).toBe('winter');
    });
  });

  describe('formatMonths', () => {
    it('合并连续月份为区间', () => {
      expect(service.formatMonths([3, 4, 5, 9, 10, 11])).toBe('3-5月、9-11月');
    });

    it('单个月份不加区间符号', () => {
      expect(service.formatMonths([6])).toBe('6月');
    });

    it('跨年月份按数值排序展示', () => {
      expect(service.formatMonths([11, 12, 1, 2])).toBe('1-2月、11-12月');
    });

    it('空数组返回空字符串', () => {
      expect(service.formatMonths([])).toBe('');
    });
  });

  describe('日期工具', () => {
    it('nextWeekendIso 返回周六', () => {
      const date = service.parseIso(service.nextWeekendIso());
      expect(date).not.toBeNull();
      expect(date!.getDay()).toBe(6);
    });

    it('nextMonthIso 返回下个月 1 号', () => {
      const date = service.parseIso(service.nextMonthIso());
      expect(date).not.toBeNull();
      expect(date!.getDate()).toBe(1);
      const now = new Date();
      expect(date!.getMonth()).toBe((now.getMonth() + 1) % 12);
    });

    it('shiftIso 按天偏移', () => {
      const today = service.parseIso(service.todayIso())!;
      const nextWeek = service.parseIso(service.shiftIso(7))!;
      expect(nextWeek.getTime() - today.getTime()).toBe(7 * 86400000);
    });

    it('quickDateOptions 最后一项为「还没定」', () => {
      const options = service.quickDateOptions();
      expect(options.length).toBe(4);
      expect(options[3].value).toBe('');
    });
  });

  describe('buildContext', () => {
    it('未指定日期时返回空上下文', () => {
      const context = service.buildContext(destination('sanya'), prefs({ startDate: '' }));
      expect(context.startDate).toBe('');
      expect(context.seasonId).toBeNull();
      expect(context.daysUntil).toBeNull();
      expect(context.weatherTips).toEqual([]);
      expect(context.packingList).toEqual([]);
    });

    it('非法日期同样按未指定处理', () => {
      const context = service.buildContext(destination('sanya'), prefs({ startDate: '2026-02-30' }));
      expect(context.startDate).toBe('');
      expect(context.seasonId).toBeNull();
    });

    it('三亚冬季属于最佳季节', () => {
      const context = service.buildContext(
        destination('sanya'),
        prefs({ startDate: '2026-02-14', days: 3, placeTypes: ['beach'] })
      );

      expect(context.seasonId).toBe('winter');
      expect(context.seasonLabel).toBe('冬季');
      expect(context.seasonIcon).toBe('❄️');
      expect(context.dateLabel).toContain('2月14日');
      expect(context.dateLabel).toContain('16日');
      expect(context.tempLabel).toBe('19~27℃');
      expect(context.isBestSeason).toBeTrue();
      expect(context.daysUntil).not.toBeNull();
      expect(context.weatherTips.join('')).toContain('最佳出行季节');
      expect(context.packingList).toContain('泳衣 / 沙滩鞋 / 防水手机袋');
    });

    it('三亚台风季给出多雨与错峰提示', () => {
      const context = service.buildContext(
        destination('sanya'),
        prefs({ startDate: '2026-08-10', days: 3 })
      );

      expect(context.seasonId).toBe('summer');
      expect(context.isBestSeason).toBeFalse();
      expect(context.weatherTips.join('')).toContain('多雨期');
      expect(context.weatherTips.join('')).toContain('并非当地最佳季节');
      expect(context.packingList).toContain('折叠伞 / 轻便雨衣');
      expect(context.packingList).toContain('防晒霜（SPF50+）');
    });

    it('跨月行程取覆盖月份的气温区间', () => {
      const context = service.buildContext(
        destination('sanya'),
        prefs({ startDate: '2026-01-30', days: 4 })
      );

      // 1 月最低 18℃、2 月最高 27℃
      expect(context.tempLabel).toBe('18~27℃');
    });

    it('自定义目的地回退到通用季节建议', () => {
      const context = service.buildContext(
        null,
        prefs({ startDate: '2026-10-01', days: 3, destinationId: 'custom' })
      );

      expect(context.seasonId).toBe('autumn');
      expect(context.tempLabel).toBe('');
      expect(context.isBestSeason).toBeFalse();
      expect(context.weatherTips.length).toBe(2);
      expect(context.weatherTips[1]).toContain('暂无气候参考数据');
      expect(context.packingList).toContain('按季节准备的换洗衣物');
    });

    it('海外目的地追加证件与插头类物品', () => {
      const context = service.buildContext(
        destination('tokyo'),
        prefs({ startDate: '2026-04-02', days: 5, placeTypes: ['city'], companion: 'friends' })
      );

      expect(context.packingList).toContain('护照 / 签证与复印件');
      expect(context.packingList).toContain('电源转换插头');
      expect(context.packingList.length).toBeLessThanOrEqual(12);
    });
  });
});
