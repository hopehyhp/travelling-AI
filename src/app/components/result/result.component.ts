import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import {
  AddSpotResult,
  COMPANION_LABELS,
  COMPANION_OPTIONS,
  CompanionId,
  DayPlan,
  Destination,
  PLACE_TYPE_LABELS,
  PLACE_TYPE_OPTIONS,
  PlaceTypeId,
  PURPOSE_LABELS,
  PURPOSE_OPTIONS,
  PurposeId,
  Recommendation,
  SpotReplacementOption,
  SpotReplacementResult,
  SeasonContext,
  SpotPlan,
  TravelContext,
  TravelPreferences,
  TripDayWeather,
  WeatherDay
} from '../../models/travel.model';
import { DESTINATIONS } from '../../data/travel-data';
import { SeasonService } from '../../services/season.service';
import { AiService } from '../../services/ai.service';
import { TravelStateService } from '../../services/travel-state.service';
import { AuthService, AuthUser } from '../../services/auth.service';
import { PlanService, ShareResult } from '../../services/plan.service';
import { ModalLockService } from '../../services/modal-lock.service';
import { TrackingService } from '../../services/tracking.service';
import * as L from 'leaflet';

type FieldKey = 'destination' | 'companion' | 'placeTypes' | 'purpose' | 'days' | 'people' | 'startDate' | 'budget';

interface SaveDialogState {
  open: boolean;
  name: string;
  loading: boolean;
  error: string | null;
}

interface ShareDialogState {
  open: boolean;
  loading: boolean;
  result: ShareResult | null;
  error: string | null;
}

/** 日程计划内的景点在地图概览上的标注点 */
interface ItineraryMapPoint {
  name: string;
  lat: number;
  lng: number;
  /** 第几天（1 起） */
  day: number;
  /** 当天游览顺序（1 起） */
  order: number;
  time: string;
}

/** 按天循环的标注颜色，刻意避开高亮橙 #f97316 */
const ITINERARY_DAY_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16'];

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.scss']
})
export class ResultComponent implements OnInit, OnDestroy {
  recommendation: Recommendation | null = null;
  isLoading = false;

  form!: TravelPreferences;
  editing: FieldKey | null = null;
  travelContext: TravelContext | null = null;
  map: L.Map | null = null;
  mapReady = false;
  weatherLoading = false;
  selectedSpot: SpotPlan | null = null;
  selectedMapPointName: string | null = null;
  replacementContext: { dayIndex: number; spotIndex: number; spot: SpotPlan } | null = null;
  replacementOptions: SpotReplacementOption[] = [];
  replacementNotice: string | null = null;
  replacementLoading = false;
  /** 补景点面板状态 */
  addContext: { dayIndex: number } | null = null;
  addOptions: SpotReplacementOption[] = [];
  addNotice: string | null = null;
  addLoading = false;
  /** 手动输入地点：查询中 / 待确认信息与位置 */
  manualLookupLoading = false;
  pendingManualSpot: SpotPlan | null = null;
  pendingManualLocationText = '';
  pendingManualLocationOk = false;
  shareNotice: string | null = null;
  saveNotice: string | null = null;
  /** 行程被就地调整（换景点/调顺序）但尚未保存到账户 */
  hasUnsavedChanges = false;
  /** 刚被删除的景点，用于提供「撤销」 */
  undoRemove: { name: string; day: number; snapshot: Recommendation } | null = null;
  private undoRemoveTimer: ReturnType<typeof setTimeout> | null = null;
  /** 地图按天筛选：null 表示全部天数 */
  activeMapDay: number | null = null;
  /** 时间编辑中的景点（`dayIndex:spotIndex`） */
  editingTimeKey: string | null = null;
  /** 拖拽源与当前悬停的落点 */
  private dragSource: { dayIndex: number; spotIndex: number } | null = null;
  dragOverKey: string | null = null;
  user: AuthUser | null = null;

  /** 定时刷新分享统计的定时器（owner 已分享时） */
  private shareStatsTimer: ReturnType<typeof setInterval> | null = null;

  saveDialog: SaveDialogState = { open: false, name: '', loading: false, error: null };
  shareDialog: ShareDialogState = { open: false, loading: false, result: null, error: null };
  savedPlanId: number | null = null;
  private mapMarkers: L.Marker[] = [];
  /** 仅行程景点的标注，便于增量追加与单独清除 */
  private itineraryMarkers: L.Marker[] = [];

  /** 行程景点标注：按天着色 + 当天序号 */
  itineraryPoints: ItineraryMapPoint[] = [];
  itineraryGeoLoading = false;
  /** 定位失败的景点（带天数，便于定位到「第几天没标上」） */
  geoFailedSpots: { day: number; name: string }[] = [];
  /** 景点坐标缓存（按 目的地::景点名），避免移动/换景点后重复地理编码 */
  private geoCache = new Map<string, { lat: number; lng: number } | null>();
  private itineraryGeoRunId = 0;
  /** 已请求过的目的地+日期组合，避免重复拉取 travel-intelligence */
  private travelContextKey: string | null = null;
  private travelContextRunId = 0;
  /** 当前 travelContext 对应的目的地，切换目的地时避免用旧坐标做地理编码兜底 */
  private travelContextDestination: string | null = null;

  private destroy$ = new Subject<void>();

  destinations = DESTINATIONS;
  companionOptions = COMPANION_OPTIONS;
  placeTypeOptions = PLACE_TYPE_OPTIONS;
  purposeOptions = PURPOSE_OPTIONS;

  /**
   * 预算档位（非线性）：低预算区间步长细、高预算区间步长粗。
   * 避免旧方案「全区间 ¥500 步长 + 上限 ¥100,000」导致滑块既难精确控制又脱离实际。
   */
  budgetStops: number[] = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 30000, 50000, 80000, 120000];
  /** 滑块当前停在的档位下标 */
  budgetSliderIndex = 4;
  /** 常用预算快捷档 */
  budgetQuickStops = [3000, 5000, 8000, 15000, 30000];

  constructor(
    private http: HttpClient,
    private seasonService: SeasonService,
    private aiService: AiService,
    private state: TravelStateService,
    private auth: AuthService,
    private planService: PlanService,
    private modalLock: ModalLockService,
    private router: Router,
    private tracking: TrackingService
  ) {}

  ngOnInit(): void {
    this.form = {
      ...this.state.preferences,
      placeTypes: [...this.state.preferences.placeTypes]
    };
    // 如果当前正在编辑一个已保存方案，继续沿用其 id（保存时走更新）
    this.savedPlanId = this.state.currentPlanId;

    this.auth.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((u) => { this.user = u; });

    // 订阅 recommendation 变化：BehaviorSubject 订阅时会立即回放当前值，
    // 因此初始化也统一走这条链路，不再额外调用一次，避免首屏重复请求。
    this.state.recommendationChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe((rec) => {
        this.recommendation = rec;
        this.isLoading = !rec;
        // 新推荐到达 = 旧的就地调整已失效，清空未保存标记
        this.hasUnsavedChanges = false;
        this.undoRemove = null;
        this.activeMapDay = null;
        this.addContext = null;
        if (!rec) {
          return;
        }
        this.form = {
          ...this.state.preferences,
          placeTypes: [...this.state.preferences.placeTypes]
        };
        this.loadTravelContext();
        this.loadItineraryPoints();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // 组件销毁时兜底解锁所有 body 滚动（覆盖可能遗留的多 modal 叠加）
    this.modalLock.reset();
    this.clearShareStatsTimer();
    if (this.undoRemoveTimer) {
      clearTimeout(this.undoRemoveTimer);
      this.undoRemoveTimer = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /** 跳转到登录页（带 redirectUrl） */
  goLogin(): void {
    this.router.navigate(['/auth'], { state: { redirectUrl: this.router.url } });
  }

  get destinationName(): string {
    if (this.form.destinationId === 'custom') {
      return this.form.customDestination.trim() || '自定义目的地';
    }
    return DESTINATIONS.find(d => d.id === this.form.destinationId)?.name ?? '目的地';
  }

  get isCustomDestination(): boolean {
    return this.form.destinationId === 'custom';
  }

  get savedPlanName(): string {
    return this.state.currentPlanName || '未命名方案';
  }

  get companionLabel(): string {
    return COMPANION_LABELS[this.form.companion];
  }

  get purposeLabel(): string {
    return PURPOSE_LABELS[this.form.purpose];
  }

  get placeTypeLabel(): string {
    return this.form.placeTypes.map(t => PLACE_TYPE_LABELS[t]).join('、');
  }

  get selectedDestination(): Destination | null {
    if (this.form.destinationId === 'custom') {
      return null;
    }
    return DESTINATIONS.find(d => d.id === this.form.destinationId) ?? null;
  }

  get formSeason(): SeasonContext {
    return this.seasonService.buildContext(this.selectedDestination, this.form);
  }

  get season(): SeasonContext {
    return this.recommendation?.season ?? ({} as SeasonContext);
  }

  get hasSeason(): boolean {
    return !!this.season?.startDate;
  }

  get showSeasonAdvice(): boolean {
    return this.hasSeason && (!this.travelContext || !this.travelContext.weather?.today);
  }

  get startDateSummary(): string {
    const season = this.formSeason;
    if (!season.startDate) {
      return '未指定 · 按四季皆宜安排';
    }
    return `${season.dateLabel} · ${season.seasonIcon}${season.seasonLabel}`;
  }

  get minDate(): string {
    return this.seasonService.todayIso();
  }

  /** p-calendar 需要 Date 对象 */
  get minCalendarDate(): Date {
    return new Date(this.minDate + 'T00:00:00');
  }

  get quickDateOptions(): { label: string; value: string }[] {
    return this.seasonService.quickDateOptions();
  }

  /** 滑块当前档位对应的预算金额 */
  get budgetDisplay(): number {
    return this.budgetStops[this.budgetSliderIndex] ?? this.form.budget;
  }

  get fields(): { key: FieldKey; icon: string; label: string; value: string }[] {
    return [
      { key: 'destination', icon: '📍', label: '目的地', value: this.destinationName },
      { key: 'companion', icon: '👥', label: '和谁去', value: this.companionLabel },
      { key: 'placeTypes', icon: '🎯', label: '想去类型', value: this.placeTypeLabel },
      { key: 'purpose', icon: '💭', label: '旅行目的', value: this.purposeLabel },
      { key: 'days', icon: '📅', label: '出行天数', value: `${this.form.days} 天` },
      { key: 'people', icon: '🧑‍🤝‍🧑', label: '出行人数', value: `${this.form.people} 人` },
      { key: 'startDate', icon: '🌤️', label: '出发日期', value: this.startDateSummary },
      { key: 'budget', icon: '💰', label: '总预算', value: `¥ ${this.form.budget.toLocaleString('zh-CN')}` }
    ];
  }

  get weatherToday(): WeatherDay | null {
    return this.travelContext?.weather?.today ?? null;
  }

  /** 行程天气是否已就绪：用于洞察卡/天气卡的骨架屏占位 */
  get weatherReady(): boolean {
    return !this.weatherLoading && !!this.travelContext;
  }

  /** 与行程逐天对齐的天气：按出发日期匹配 7 日预报，超出窗口用常年气候兜底 */
  get tripWeather(): TripDayWeather[] {
    const forecast = this.travelContext?.weather?.forecast ?? [];
    return this.seasonService.buildTripWeather(this.selectedDestination, this.form, forecast);
  }

  /** 当地实时天气仅在出发日临近（7 天内）或未定日期时作为参考展示 */
  get showTodayWeather(): boolean {
    if (!this.weatherToday) {
      return false;
    }
    const daysUntil = this.formSeason.daysUntil;
    if (daysUntil === null) {
      return true;
    }
    return daysUntil <= 6;
  }

  get mapPoints() {
    return this.travelContext?.highlights ?? [];
  }

  /** 定位失败景点的可读文案，带天数 */
  get geoFailedLabel(): string {
    return this.geoFailedSpots.map((item) => `第${item.day}天·${item.name}`).join('、');
  }

  /** 完全没有可用坐标的天数：这一天在地图上看不到，需要明确提示用户 */
  get daysWithoutMarkers(): number[] {
    const rec = this.recommendation;
    if (!rec || this.itineraryGeoLoading) {
      return [];
    }
    const located = new Set(this.itineraryPoints.map((point) => point.name));
    return rec.days
      .filter((day) => day.spots.length > 0 && !day.spots.some((spot) => located.has(spot.name)))
      .map((day) => day.day);
  }

  get smartAdvice(): string[] {
    return this.travelContext?.smartAdvice ?? [];
  }

  get routeOptimization(): { title: string; text: string; tag: string }[] {
    const items: { title: string; text: string; tag: string }[] = [];
    const days = this.recommendation?.days ?? [];

    if (days.length > 0) {
      const firstDay = days[0];
      const firstSpot = firstDay.spots?.[0]?.name ?? '主景点';
      const secondSpot = firstDay.spots?.[1]?.name ?? '周边景点';
      items.push({
        title: '路线节奏',
        text: `按${this.destinationName}景区分组，建议第 1 天优先围绕“${firstSpot} + ${secondSpot}”安排，后续天数按区域分段，减少往返奔波。`,
        tag: '区域分组'
      });
    }

    const transport = this.form.days > 3 ? '地铁/公交 + 轻度步行' : '步行 + 短程交通';
    items.push({
      title: '交通安排',
      text: `本次 ${this.form.days} 天行程建议以${transport}为主，长距离景点（如自然类和远郊景点）提前预订接驳交通，避免中间打断节奏。`,
      tag: '出行效率'
    });

    // 只有出发日真正落在 7 日预报窗口内，才用天气下结论；否则宁可不展示天气卡
    const firstTripDay = this.weatherLoading ? null : this.tripWeather[0];
    const weather = firstTripDay && firstTripDay.source === 'forecast' ? firstTripDay : null;
    if (weather) {
      if (weather.rainChance !== null && weather.rainChance >= 60) {
        items.push({
          title: '雨天适配',
          text: '出发日降雨概率较高，优先放置博物馆、茶馆、室内美食和购物类安排，户外景点切换到白天晴朗时段或改成短时逛景。',
          tag: '天气调整'
        });
      } else if (weather.max !== null && weather.max >= 30) {
        items.push({
          title: '高温适配',
          text: '出发日高温明显，建议将户外项目调整为早晨和傍晚，午间改为休息、室内展览或美食体验，降低体力消耗。',
          tag: '高温避暑'
        });
      } else {
        items.push({
          title: '适宜出行',
          text: '出发日天气较适合外出，适合安排远足、城市观光和摄影打卡类活动，白天和傍晚都可充分利用。',
          tag: '最佳时段'
        });
      }
    }

    return items.slice(0, 3);
  }

  get dailyAdjustments(): { day: number; title: string; slots: { label: string; text: string }[]; note: string }[] {
    const baseDays = this.recommendation?.days ?? [];
    const trip = this.tripWeather;

    return baseDays.map((day, index) => {
      // 用对齐后的行程天气，而不是 forecast[0]（今天）兜底
      const weather = trip[index] ?? null;
      const hasWeather = !!weather && weather.source !== 'none';
      const rainy = hasWeather && weather!.rainChance !== null && weather!.rainChance >= 60;
      const hot = hasWeather && weather!.max !== null && weather!.max >= 30;
      const cool = hasWeather && weather!.max !== null && weather!.max <= 15;

      const morningText = rainy
        ? `上午优先安排街区漫游、博物馆或咖啡馆，避免雨中长时间户外活动。`
        : hot
          ? `上午是最佳出游窗口，优先打卡${day.spots[0]?.name ?? '主景点'}等外景。`
          : cool
            ? `早晨较凉爽，适合长线步行与摄影打卡，尽量把人流集中在户外景区。`
            : `早晨适合重点打卡，先完成拍照和景观类安排，抓住最佳光线与流量低峰。`;

      const afternoonText = rainy
        ? `下午转入餐饮、商店、展馆等室内安排，适当休息后再进行轻松散步。`
        : hot
          ? `午后建议休息和室内体验，安排美食、馆藏或休闲空间，规避强烈日照。`
          : cool
            ? `午间可安排自由活动和中段休息，留出足够时间缓冲体力。`
            : `下午适合城市散步、景点二次停留和轻松拍摄，节奏保持轻松。`;

      const eveningText = rainy
        ? `晚上以夜游、餐饮和短距离观景为主，尽量选择灯下景点和室内氛围强的体验。`
        : hot
          ? `傍晚是最适合夜景和散步的时段，推荐把重点景观放在日落后执行。`
          : cool
            ? `晚间适合步行夜游、改造街区和美食体验，穿暖一点更舒服。`
            : `晚间适合酒吧、夜景、夜市和慢游区域，适合调低活动强度。`;

      return {
        day: day.day,
        title: day.title,
        slots: [
          { label: '上午', text: morningText },
          { label: '下午', text: afternoonText },
          { label: '晚上', text: eveningText }
        ],
        note: !this.formSeason.startDate
          ? '天气提醒：设定出发日期后，可按天对齐天气。'
          : !hasWeather
          ? '天气提醒：暂无逐日预报，出发前 3 天再确认当地天气。'
          : `${weather!.source === 'climate' ? '常年同期参考' : '天气提醒'}：${
              rainy
                ? '降雨概率较高，建议把户外打卡压缩在晴朗窗口内。'
                : hot
                  ? '高温明显，建议把户外活动前移至早晚时段。'
                  : cool
                    ? '气温较低，建议外套、保暖层和长时间驻足少一些。'
                    : '适合全天外出，白天和傍晚都可安排重点活动。'
            }`
      };
    });
  }

  /** 每日游览时长估算：由各景点「建议停留」累加，用于提示当天是否排得过满 */
  get dayDurations(): { day: number; hours: number; packed: boolean }[] {
    return (this.recommendation?.days ?? []).map((day) => {
      const hours = day.spots.reduce((sum, spot) => sum + this.parseStayHours(spot.stay), 0);
      return { day: day.day, hours: Math.round(hours * 10) / 10, packed: hours > 10 };
    });
  }

  /** 从「1.5–2 小时」这类文案中取最大时长；无法解析时按 2 小时估算 */
  private parseStayHours(stay: string): number {
    const numbers = (stay || '').match(/\d+(\.\d+)?/g);
    if (!numbers?.length) {
      return 2;
    }
    return Math.max(...numbers.map(Number));
  }

  openEdit(key: FieldKey): void {
    this.editing = this.editing === key ? null : key;
    // 打开预算编辑器时，把滑块同步到当前预算最近的档位
    if (this.editing === 'budget') {
      this.budgetSliderIndex = this.nearestBudgetIndex(this.form.budget);
    }
  }

  closeEdit(): void {
    this.editing = null;
  }

  openSpotDetail(spot: SpotPlan): void {
    // 补全 priceNote / locationNote / locationQuery 的默认值（后续都由子组件 SpotDetailModal 处理）
    this.selectedSpot = {
      ...spot,
      priceNote: spot.priceNote ?? (spot.cost > 0 ? '参考预算，仅作估算，不等于官方票价。' : '未确认官方票价，仅作参考估算。'),
      locationNote: spot.locationNote ?? '位置为智能定位估算，可使用下方导航按钮跳转到地图 App。',
      locationQuery: spot.locationQuery ?? `${spot.name} ${this.destinationName}`
    };
    this.selectedMapPointName = spot.name;
    this.lockPageScroll();
    this.syncMapHighlight();
  }

  closeSpotDetail(): void {
    // 子组件 SpotDetailModal 的 (close) 输出会触发这里
    this.selectedSpot = null;
    this.selectedMapPointName = null;
    this.unlockPageScroll();
    this.syncMapHighlight();
  }

  openMapPoint(pointName: string): void {
    if (!this.recommendation) {
      return;
    }
    const matchedSpot = this.recommendation.days
      .flatMap(day => day.spots)
      .find(spot => spot.name === pointName);

    if (matchedSpot) {
      this.selectedSpot = matchedSpot;
      this.selectedMapPointName = pointName;
      this.lockPageScroll();
    }
    this.syncMapHighlight();
  }

  // 手机端“更多操作”展开状态：一次只展开一个景点
  toolsOpenKey: string | null = null;

  isToolsOpen(dayIndex: number, spotIndex: number): boolean {
    return this.toolsOpenKey === `${dayIndex}-${spotIndex}`;
  }

  toggleTools(dayIndex: number, spotIndex: number): void {
    const key = `${dayIndex}-${spotIndex}`;
    this.toolsOpenKey = this.toolsOpenKey === key ? null : key;
  }

  moveSpot(dayIndex: number, spotIndex: number, direction: -1 | 1): void {
    if (!this.recommendation || !this.recommendation.days?.[dayIndex]) {
      return;
    }

    const day = this.recommendation.days[dayIndex];
    const nextIndex = spotIndex + direction;
    if (nextIndex < 0 || nextIndex >= day.spots.length) {
      return;
    }

    // 时间属于「当天的时间槽」：只交换景点位置，时间按槽位重新分配
    const times = day.spots.map((spot) => spot.time);
    const spots = [...day.spots];
    const [moved] = spots.splice(spotIndex, 1);
    spots.splice(nextIndex, 0, moved);
    const reslotted = spots.map((spot, index) => ({ ...spot, time: times[index] }));

    const days = this.recommendation.days.map((entry, idx) => (
      idx === dayIndex ? { ...entry, spots: reslotted } : { ...entry, spots: [...entry.spots] }
    ));

    this.publishRecommendation({ ...this.recommendation, days, attractionCount: days.reduce((count, dayEntry) => count + dayEntry.spots.length, 0) });
  }

  // —— 拖拽排序 / 跨天移动 ——

  onSpotDragStart(dayIndex: number, spotIndex: number, event: DragEvent): void {
    // 当天只剩一个景点时不允许移动：避免出现空白天
    if ((this.recommendation?.days?.[dayIndex]?.spots.length ?? 0) <= 1) {
      event.preventDefault();
      return;
    }
    this.dragSource = { dayIndex, spotIndex };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${dayIndex}:${spotIndex}`);
    }
  }

  onSpotDragOver(dayIndex: number, spotIndex: number, event: DragEvent): void {
    if (!this.dragSource) {
      return;
    }
    // 必须阻止默认行为才允许 drop
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverKey = `${dayIndex}:${spotIndex}:${this.isDropBelow(event) ? 'after' : 'before'}`;
  }

  onSpotDragLeave(): void {
    this.dragOverKey = null;
  }

  onSpotDrop(dayIndex: number, spotIndex: number, event: DragEvent): void {
    event.preventDefault();
    const source = this.dragSource;
    this.dragSource = null;
    this.dragOverKey = null;
    if (!source) {
      return;
    }
    const insertAfter = this.isDropBelow(event);
    this.moveSpotTo(source.dayIndex, source.spotIndex, dayIndex, spotIndex + (insertAfter ? 1 : 0));
  }

  onSpotDragEnd(): void {
    this.dragSource = null;
    this.dragOverKey = null;
  }

  /** 落点是否在行的下半部分（决定插入到前/后） */
  private isDropBelow(event: DragEvent): boolean {
    const element = event.currentTarget as HTMLElement | null;
    if (!element) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2;
  }

  dropPosition(dayIndex: number, spotIndex: number): 'before' | 'after' | null {
    const key = `${dayIndex}:${spotIndex}:`;
    if (!this.dragOverKey || !this.dragOverKey.startsWith(key)) {
      return null;
    }
    return this.dragOverKey.endsWith(':after') ? 'after' : 'before';
  }

  /** 手机端兜底：把景点直接移到指定天（插入到该天末尾） */
  moveSpotToDay(dayIndex: number, spotIndex: number, rawDayIndex: string): void {
    if (!rawDayIndex) {
      return;
    }
    const targetDay = Number(rawDayIndex);
    const targetDayPlan = this.recommendation?.days?.[targetDay];
    if (!Number.isInteger(targetDay) || !targetDayPlan) {
      return;
    }
    this.moveSpotTo(dayIndex, spotIndex, targetDay, targetDayPlan.spots.length);
  }

  /**
   * 移动景点到任意天任意位置（含跨天）。
   * 时间槽按天重新分配，避免"时间跟着景点跑"。
   */
  private moveSpotTo(fromDayIndex: number, fromSpotIndex: number, toDayIndex: number, insertIndex: number): void {
    const rec = this.recommendation;
    const sourceDay = rec?.days?.[fromDayIndex];
    const targetDay = rec?.days?.[toDayIndex];
    const spot = sourceDay?.spots?.[fromSpotIndex];
    if (!rec || !sourceDay || !targetDay || !spot) {
      return;
    }
    // 当天只剩一个景点时禁止移动（含跨天），删除按钮也保持禁用
    if (sourceDay.spots.length <= 1) {
      return;
    }

    const sourceTimes = sourceDay.spots.map((entry) => entry.time);
    let days: DayPlan[];

    if (fromDayIndex === toDayIndex) {
      const remaining = sourceDay.spots.filter((_, index) => index !== fromSpotIndex);
      const target = Math.max(0, Math.min(
        insertIndex > fromSpotIndex ? insertIndex - 1 : insertIndex,
        remaining.length
      ));
      const spots = [...remaining];
      spots.splice(target, 0, spot);
      const reslotted = spots.map((entry, index) => ({ ...entry, time: sourceTimes[index] }));
      // 移动后按当天安排顺延后续时间，避免时间重叠
      const adjusted = this.cascadeTimes(reslotted, target);
      days = rec.days.map((entry, index) => (
        index === toDayIndex ? { ...entry, spots: adjusted } : { ...entry, spots: [...entry.spots] }
      ));
    } else {
      const remainingSource = sourceDay.spots.filter((_, index) => index !== fromSpotIndex);
      const sourceSlots = sourceTimes.filter((_, index) => index !== fromSpotIndex);
      const targetSlots = this.insertTimeSlot(targetDay.spots.map((entry) => entry.time), insertIndex);
      const targetSpots = [...targetDay.spots];
      const safeInsert = Math.max(0, Math.min(insertIndex, targetSpots.length));
      targetSpots.splice(safeInsert, 0, spot);

      days = rec.days.map((entry, index) => {
        if (index === fromDayIndex) {
          return { ...entry, spots: remainingSource.map((item, i) => ({ ...item, time: sourceSlots[i] ?? item.time })) };
        }
        if (index === toDayIndex) {
          const slotted = targetSpots.map((item, i) => ({ ...item, time: targetSlots[i] ?? item.time }));
          // 目标日的时间要跟当天安排走：从插入位置起按停留时长顺延
          return { ...entry, spots: this.cascadeTimes(slotted, safeInsert) };
        }
        return { ...entry, spots: [...entry.spots] };
      });
    }

    this.toolsOpenKey = null;
    this.tracking.track('move_spot', { fromDay: fromDayIndex, toDay: toDayIndex });
    this.publishRecommendation({
      ...rec,
      days,
      attractionCount: days.reduce((count, entry) => count + entry.spots.length, 0)
    });
  }

  /** 为目标天插入一个新的时间槽（取前后时间的中点） */
  private insertTimeSlot(times: string[], index: number): string[] {
    const result = [...times];
    const safeIndex = Math.max(0, Math.min(index, times.length));
    const prev = safeIndex > 0 ? this.timeToMinutes(times[safeIndex - 1]) : null;
    const next = safeIndex < times.length ? this.timeToMinutes(times[safeIndex]) : null;

    let minutes: number;
    if (prev !== null && next !== null) {
      minutes = Math.round((prev + next) / 2);
    } else if (prev !== null) {
      minutes = prev + 90;
    } else if (next !== null) {
      minutes = next - 90;
    } else {
      minutes = 9 * 60 + 30;
    }
    result.splice(safeIndex, 0, this.minutesToTime(minutes));
    return result;
  }

  /**
   * 按当天安排顺延时间：从 fromIndex 起，保证每个景点至少在上一个景点
   * 结束（含 30 分钟衔接）之后开始；fromIndex 之前的自定义时间保持不动。
   */
  private cascadeTimes(spots: SpotPlan[], fromIndex: number): SpotPlan[] {
    let prevEnd: number | null = null;
    return spots.map((spot, index) => {
      const current = this.timeToMinutes(spot.time);
      if (current === null) {
        return spot;
      }

      let start = current;
      if (index >= fromIndex && prevEnd !== null) {
        start = Math.max(current, prevEnd + 30);
      }
      prevEnd = start + this.parseStayMinutes(spot.stay);
      return start === current ? { ...spot } : { ...spot, time: this.minutesToTime(start) };
    });
  }

  // —— 自定义景点时间 ——

  isEditingTime(dayIndex: number, spotIndex: number): boolean {
    return this.editingTimeKey === `${dayIndex}:${spotIndex}`;
  }

  startEditTime(dayIndex: number, spotIndex: number): void {
    this.editingTimeKey = `${dayIndex}:${spotIndex}`;
  }

  cancelTimeEdit(): void {
    this.editingTimeKey = null;
  }

  /** 修改时间后按时间重新排序，保证时间轴单调递增 */
  commitSpotTime(dayIndex: number, spotIndex: number, value: string): void {
    const rec = this.recommendation;
    const day = rec?.days?.[dayIndex];
    const spot = day?.spots?.[spotIndex];
    this.editingTimeKey = null;
    if (!rec || !day || !spot || !/^\d{1,2}:\d{2}$/.test(value) || value === spot.time) {
      return;
    }

    const spots = this.sortSpotsByTime(day.spots.map((entry, index) => (
      index === spotIndex ? { ...entry, time: this.minutesToTime(this.timeToMinutes(value) ?? 0) } : entry
    )));
    const days = rec.days.map((entry, index) => (
      index === dayIndex ? { ...entry, spots } : { ...entry, spots: [...entry.spots] }
    ));

    this.tracking.track('edit_spot_time', { dayIndex });
    this.publishRecommendation({ ...rec, days });
  }

  private sortSpotsByTime(spots: SpotPlan[]): SpotPlan[] {
    return [...spots].sort((left, right) => {
      const leftMinutes = this.timeToMinutes(left.time);
      const rightMinutes = this.timeToMinutes(right.time);
      if (leftMinutes === null && rightMinutes === null) {
        return 0;
      }
      if (leftMinutes === null) {
        return 1;
      }
      if (rightMinutes === null) {
        return -1;
      }
      return leftMinutes - rightMinutes;
    });
  }

  private timeToMinutes(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match) {
      return null;
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private minutesToTime(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
    const hours = String(Math.floor(clamped / 60)).padStart(2, '0');
    const minutes = String(clamped % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /** 删除单个景点（每天至少保留一个，避免出现空白天） */
  removeSpot(dayIndex: number, spotIndex: number): void {
    const rec = this.recommendation;
    const day = rec?.days?.[dayIndex];
    if (!rec || !day || day.spots.length <= 1) {
      return;
    }
    const spot = day.spots[spotIndex];
    if (!spot) {
      return;
    }

    const days = rec.days.map((entry, index) => {
      if (index !== dayIndex) {
        return { ...entry, spots: [...entry.spots] };
      }
      return { ...entry, spots: entry.spots.filter((_, i) => i !== spotIndex) };
    });

    this.undoRemove = { name: spot.name, day: day.day, snapshot: this.cloneRecommendation(rec) };
    if (this.undoRemoveTimer) {
      clearTimeout(this.undoRemoveTimer);
    }
    this.undoRemoveTimer = setTimeout(() => {
      this.undoRemove = null;
      this.undoRemoveTimer = null;
    }, 6000);

    this.toolsOpenKey = null;
    this.tracking.track('remove_spot', { day: day.day });
    this.publishRecommendation({
      ...rec,
      days,
      attractionCount: days.reduce((count, entry) => count + entry.spots.length, 0)
    });
  }

  undoRemoveSpot(): void {
    if (!this.undoRemove) {
      return;
    }
    this.publishRecommendation(this.undoRemove.snapshot);
    this.undoRemove = null;
    if (this.undoRemoveTimer) {
      clearTimeout(this.undoRemoveTimer);
      this.undoRemoveTimer = null;
    }
  }

  /** 地图按天筛选 */
  setMapDay(day: number | null): void {
    this.activeMapDay = day;
    this.applyItineraryDayFilter();
    this.fitMapToItinerary();
  }

  /** 依据 activeMapDay 增删行程标注（全部时全部显示） */
  private applyItineraryDayFilter(): void {
    if (!this.map) {
      return;
    }
    this.itineraryMarkers.forEach((marker) => {
      const point = (marker as any).itineraryPoint as ItineraryMapPoint | undefined;
      const visible = !point || this.activeMapDay === null || point.day === this.activeMapDay;
      const onMap = this.map!.hasLayer(marker);
      if (visible && !onMap) {
        this.map!.addLayer(marker);
      } else if (!visible && onMap) {
        if (this.selectedMapPointName === point?.name) {
          this.selectedMapPointName = null;
        }
        this.map!.removeLayer(marker);
      }
    });
  }

  requestReplacement(dayIndex: number, spotIndex: number, spot: SpotPlan): void {
    this.discardManualSpot();
    this.replacementContext = { dayIndex, spotIndex, spot };
    this.replacementOptions = [];
    this.replacementNotice = null;
    this.replacementLoading = true;
    this.aiService.replaceSpot(this.form, spot, dayIndex, this.recommendation).subscribe((result: SpotReplacementResult) => {
      this.replacementLoading = false;
      this.replacementOptions = result.candidates ?? [];
      this.replacementNotice = result.message ?? (this.replacementOptions.length
        ? '请选择一个更适合当前目的地的替换方案。'
        : '当前目的地暂无可替换候选，已保留原安排。');
    });
  }

  cancelReplacement(): void {
    this.replacementContext = null;
    this.replacementOptions = [];
    this.replacementNotice = null;
    this.replacementLoading = false;
    this.discardManualSpot();
  }

  applyReplacement(option: SpotReplacementOption): void {
    if (!this.replacementContext || !this.recommendation) {
      return;
    }

    const { dayIndex, spotIndex } = this.replacementContext;
    const days = this.recommendation.days.map((entry, index) => {
      if (index !== dayIndex) {
        return { ...entry, spots: [...entry.spots] };
      }

      const spots = [...entry.spots];
      spots[spotIndex] = {
        ...spots[spotIndex],
        name: option.name,
        category: option.category,
        description: option.description,
        cost: option.cost,
        stay: option.stay,
        reasons: option.reasons,
        priceNote: option.priceNote ?? '参考预算，仅作估算，不等于官方票价。',
        locationNote: option.locationNote ?? '地图入口基于 OpenStreetMap 中的地点搜索结果。',
        locationQuery: `${option.name} ${this.destinationName}`
      };
      return { ...entry, spots };
    });

    const updated: Recommendation = {
      ...this.recommendation!,
      days,
      attractionCount: days.reduce((count, dayPlan) => count + dayPlan.spots.length, 0)
    };

    this.publishRecommendation(updated);
    this.cancelReplacement();
  }

  // —— 补景点（AI 候选 + 手动兜底）——

  requestAddition(dayIndex: number): void {
    const rec = this.recommendation;
    if (!rec?.days?.[dayIndex]) {
      return;
    }
    const day = rec.days[dayIndex];
    const hours = this.dayDurations[dayIndex]?.hours ?? 0;

    this.addContext = { dayIndex };
    this.addOptions = [];
    this.addNotice = null;
    this.discardManualSpot();
    this.addLoading = true;
    this.tracking.track('add_spot_request', {
      dayIndex,
      occupiedHours: hours,
      spotCount: day.spots.length
    });

    this.aiService.addSpot(this.form, rec, dayIndex, hours).subscribe((result: AddSpotResult) => {
      this.addLoading = false;
      this.addOptions = result.candidates ?? [];
      this.addNotice = result.message ?? (this.addOptions.length
        ? '请选择一个想补充进这一天的地点。'
        : '暂无可补充候选，可以手动添加一个地点。');
      if (!this.addOptions.length) {
        this.tracking.track('add_spot_empty', { dayIndex });
      }
    });
  }

  cancelAddition(): void {
    this.addContext = null;
    this.addOptions = [];
    this.addNotice = null;
    this.addLoading = false;
    this.discardManualSpot();
  }

  applyAddition(option: SpotReplacementOption): void {
    if (!this.addContext || !this.recommendation) {
      return;
    }
    const { dayIndex } = this.addContext;
    const timeLabel = option.bestTime === '上午' ? '09:30'
      : option.bestTime === '下午' ? '14:30'
      : option.bestTime === '傍晚' ? '18:00'
      : '10:30';
    const spot = this.buildSpotPlan(option, timeLabel);
    const days = this.recommendation.days.map((entry, index) => (
      index === dayIndex
        ? { ...entry, spots: this.insertSpotByTime(entry.spots, spot, option.bestTime) }
        : { ...entry, spots: [...entry.spots] }
    ));

    this.tracking.track('add_spot', { dayIndex, source: 'ai', name: option.name, cost: option.cost });
    this.publishRecommendation({
      ...this.recommendation,
      days,
      attractionCount: days.reduce((count, entry) => count + entry.spots.length, 0)
    });
    this.cancelAddition();
  }

  // —— 手动输入地点：先确认信息与位置，再写入行程 ——

  /** 用户输入地名 → AI 补全信息 → 地理编码确认位置 → 展示确认卡片 */
  async lookupManualSpot(name: string): Promise<void> {
    const rec = this.recommendation;
    const normalized = (name || '').trim();
    if (!rec || !normalized) {
      return;
    }

    const existing = new Set(rec.days.flatMap((day) => day.spots.map((spot) => spot.name.trim().toLowerCase())));
    if (existing.has(normalized.toLowerCase())) {
      this.setManualNotice(`「${normalized}」已在行程中，请换一个地点。`);
      return;
    }

    this.pendingManualSpot = null;
    this.manualLookupLoading = true;
    const result = await firstValueFrom(this.aiService.lookupSpot(this.form, normalized));
    if (!result.found) {
      this.manualLookupLoading = false;
      this.setManualNotice(result.message ?? `未能确认「${normalized}」，请检查名称后重试。`);
      return;
    }

    const coords = await this.geocodeSpot(result.name);
    const dayIndex = this.addContext?.dayIndex;
    const time = dayIndex !== undefined && rec.days[dayIndex]
      ? this.nextTimeForDay(rec.days[dayIndex])
      : '10:30';

    this.pendingManualSpot = {
      time,
      name: result.name,
      category: result.category || '景点',
      description: result.description || `${this.destinationName}的自定义景点。`,
      cost: result.cost ?? 0,
      priceNote: result.priceNote,
      locationNote: result.locationNote,
      locationQuery: `${result.name} ${this.destinationName}`,
      stay: result.stay || '1–1.5 小时',
      reasons: []
    };
    this.pendingManualLocationOk = !!coords;
    this.pendingManualLocationText = coords
      ? `已定位：${result.addressHint || result.name}（${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}）`
      : `未能定位到精确坐标（${result.addressHint || result.name}），地图可能不显示该点，仍可先加入行程。`;
    this.manualLookupLoading = false;
  }

  /** 确认卡片里的「确认添加 / 确认替换」 */
  confirmManualSpot(): void {
    const spot = this.pendingManualSpot;
    const rec = this.recommendation;
    if (!spot || !rec) {
      return;
    }

    if (this.replacementContext?.spot) {
      const { dayIndex, spotIndex } = this.replacementContext;
      const original = rec.days[dayIndex]?.spots[spotIndex];
      if (!original) {
        return;
      }
      // 替换时沿用原来的时间槽，避免"时间跟着景点跑"
      const replaced: SpotPlan = { ...spot, time: original.time };
      const days = rec.days.map((entry, index) => (
        index === dayIndex
          ? { ...entry, spots: entry.spots.map((item, i) => (i === spotIndex ? replaced : item)) }
          : { ...entry, spots: [...entry.spots] }
      ));

      this.tracking.track('replace_spot', { dayIndex, source: 'manual', name: replaced.name, cost: replaced.cost });
      this.publishRecommendation({ ...rec, days });
      this.discardManualSpot();
      this.cancelReplacement();
      return;
    }

    if (this.addContext) {
      const { dayIndex } = this.addContext;
      const days = rec.days.map((entry, index) => (
        index === dayIndex
          ? { ...entry, spots: [...entry.spots, spot] }
          : { ...entry, spots: [...entry.spots] }
      ));

      this.tracking.track('add_spot', { dayIndex, source: 'manual', name: spot.name, cost: spot.cost });
      this.publishRecommendation({
        ...rec,
        days,
        attractionCount: days.reduce((count, entry) => count + entry.spots.length, 0)
      });
      this.discardManualSpot();
      this.cancelAddition();
    }
  }

  discardManualSpot(): void {
    this.pendingManualSpot = null;
    this.pendingManualLocationOk = false;
    this.pendingManualLocationText = '';
    this.manualLookupLoading = false;
  }

  /** 手动输入相关的提示走当前面板的 notice，避免两套文案 */
  private setManualNotice(message: string): void {
    if (this.addContext) {
      this.addNotice = message;
    } else if (this.replacementContext) {
      this.replacementNotice = message;
    }
  }

  /** 新景点追加到当天末尾时的开始时间：上一个景点结束 + 30 分钟 */
  private nextTimeForDay(day: DayPlan): string {
    const last = day.spots[day.spots.length - 1];
    const lastStart = last ? this.timeToMinutes(last.time) : null;
    if (lastStart === null) {
      return '10:30';
    }
    return this.minutesToTime(lastStart + this.parseStayMinutes(last?.stay) + 30);
  }

  /** 解析停留时长（如 "1–1.5 小时"）为分钟，解析不到按 90 分钟 */
  private parseStayMinutes(stay?: string): number {
    const match = /(\d+(?:\.\d+)?)/.exec(stay || '');
    if (!match) {
      return 90;
    }
    return Math.round(Number(match[1]) * 60);
  }

  /** 候选 -> 行程景点，补齐费用/位置说明与地图检索关键词 */
  private buildSpotPlan(option: SpotReplacementOption, time: string): SpotPlan {
    return {
      time,
      name: option.name,
      category: option.category || '景点',
      description: option.description,
      cost: option.cost,
      priceNote: option.priceNote ?? '参考预算，仅作估算，不等于官方票价。',
      locationNote: option.locationNote ?? '地图入口基于 OpenStreetMap 中的地点搜索结果。',
      locationQuery: `${option.name} ${this.destinationName}`,
      stay: option.stay || '1–1.5 小时',
      reasons: option.reasons ?? []
    };
  }

  /** 按建议时段决定插入位置：上午→开头，下午→中间，傍晚→结尾 */
  private insertSpotByTime(spots: SpotPlan[], spot: SpotPlan, bestTime?: string): SpotPlan[] {
    const position = bestTime === '上午' ? 0
      : bestTime === '下午' ? Math.ceil(spots.length / 2)
      : spots.length;
    const result = [...spots];
    result.splice(position, 0, spot);
    return result;
  }

  // —— 保存方案（命名 Modal）——

  openSaveDialog(): void {
    if (!this.recommendation) return;
    if (!this.user) {
      // 未登录 → 先去登录，登录完成后回来
      this.router.navigate(['/auth'], { state: { redirectUrl: this.router.url } });
      return;
    }
    const defaultName = this.state.currentPlanName
      || (this.recommendation.destinationName + ' · ' + new Date().toLocaleDateString('zh-CN'));
    this.saveDialog = { open: true, name: defaultName, loading: false, error: null };
    this.modalLock.lock();
  }

  closeSaveDialog(): void {
    if (!this.saveDialog.open) return;
    this.saveDialog.open = false;
    this.modalLock.unlock();
  }

  confirmSave(nameFromChild?: string): void {
    if (!this.recommendation) return;
    if (!this.user) return;
    const name = (nameFromChild ?? this.saveDialog.name ?? '').trim();
    if (!name) {
      this.saveDialog.error = '请输入方案名称';
      return;
    }
    this.saveDialog.loading = true;
    this.saveDialog.error = null;

    const rec = this.cloneRecommendation(this.recommendation);
    const prefs = { ...this.form, placeTypes: [...this.form.placeTypes] };

    // 如果之前已经保存过，走 update；否则走 create
    const isUpdate = !!this.savedPlanId;
    const save$ = this.savedPlanId
      ? this.planService.update(this.savedPlanId, name, prefs, rec)
      : this.planService.create(name, prefs, rec);

    save$.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.tracking.track('save_plan', { mode: isUpdate ? 'update' : 'create' });
          if ((res as any).plan?.id) {
            this.savedPlanId = (res as any).plan.id;
          }
          if (this.savedPlanId) {
            this.state.setCurrentPlan(this.savedPlanId, name);
          }
          this.saveNotice = '✅ 方案已保存到你的账户';
          this.hasUnsavedChanges = false;
          this.undoRemove = null;
          setTimeout(() => { this.saveNotice = null; }, 2400);
          this.closeSaveDialog();
        },
        error: (err) => {
          this.saveDialog.loading = false;
          this.saveDialog.error = err?.error?.message || '保存失败，请稍后重试';
        }
      });
  }

  // —— 分享方案（生成 token + 复制链接）——

  openShareDialog(): void {
    if (!this.recommendation) return;
    if (!this.user) {
      this.router.navigate(['/auth'], { state: { redirectUrl: this.router.url } });
      return;
    }

    this.shareDialog = { open: true, loading: true, result: null, error: null };
    this.modalLock.lock();

    const rec = this.cloneRecommendation(this.recommendation);
    const prefs = { ...this.form, placeTypes: [...this.form.placeTypes] };
    const planName = this.recommendation.destinationName + ' · 分享';

    // 如果已保存过 → 直接 share；否则先 create 再 share
    const share$ = this.savedPlanId
      ? this.planService.share(this.savedPlanId)
      : this.planService.create(planName, prefs, rec).pipe(
          switchMap((created) => {
            this.savedPlanId = created.plan.id;
            this.state.setCurrentPlan(created.plan.id, created.plan.name);
            return this.planService.share(created.plan.id);
          })
        );

    share$.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (share) => {
          this.shareDialog.loading = false;
          this.shareDialog.result = share;
          this.tracking.track('share_create', { ok: true });
          // 生成成功后启动定时刷新统计
          this.startShareStatsRefresh();
        },
        error: (err) => {
          this.shareDialog.loading = false;
          this.shareDialog.error = err?.error?.message || '生成分享链接失败';
        }
      });
  }

  closeShareDialog(): void {
    if (!this.shareDialog.open) return;
    this.shareDialog.open = false;
    this.clearShareStatsTimer();
    this.modalLock.unlock();
  }

  /** 启动分享统计定时刷新（每 15 秒） */
  private startShareStatsRefresh(): void {
    this.clearShareStatsTimer();
    this.refreshShareStats();
    this.shareStatsTimer = setInterval(() => this.refreshShareStats(), 15000);
  }

  private clearShareStatsTimer(): void {
    if (this.shareStatsTimer) {
      clearInterval(this.shareStatsTimer);
      this.shareStatsTimer = null;
    }
  }

  private refreshShareStats(): void {
    if (!this.savedPlanId || !this.shareDialog.open) return;
    this.planService.getShareStats(this.savedPlanId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        if (this.shareDialog.result) {
          this.shareDialog.result.view_count = res.share.view_count;
          this.shareDialog.result.import_count = res.share.import_count;
        }
      },
      error: () => { /* 静默失败：可能 plan 还没分享 */ }
    });
  }

  saveCurrentPlan(): void {
    // 兼容老入口：现在统一走 openSaveDialog
    this.openSaveDialog();
  }

  shareCurrentPlan(): void {
    // 兼容老入口
    this.openShareDialog();
  }

  private publishRecommendation(updated: Recommendation): void {
    const adjusted = this.withRecalculatedBudget(updated);
    this.recommendation = adjusted;
    this.state.setRecommendation(this.cloneRecommendation(adjusted));
    // setRecommendation 会同步回放订阅并把标记清空，因此在它之后置为 true
    this.hasUnsavedChanges = true;
    // 移动/换景点后重排地图上的行程标注（已有坐标的景点走缓存，不会重复请求）
    this.loadItineraryPoints();
  }

  /**
   * 景点被替换后重算预计支出：
   * 门票按人数计入，其余成本（住宿/餐饮/交通）沿用原估算，按差值平移总额，
   * 避免出现「行程已换景点、预算数字仍是旧值」。
   */
  private withRecalculatedBudget(updated: Recommendation): Recommendation {
    const prev = this.recommendation;
    if (!prev) {
      return updated;
    }
    const previousSpotCost = this.spotCostSum(prev.days);
    const nextSpotCost = this.spotCostSum(updated.days);
    const estimatedTotal = previousSpotCost === nextSpotCost
      ? prev.estimatedTotal
      : Math.max(0, Math.round(prev.estimatedTotal + (nextSpotCost - previousSpotCost) * Math.max(1, this.form.people)));
    return {
      ...updated,
      estimatedTotal,
      overBudget: estimatedTotal > this.form.budget * 1.1
    };
  }

  private spotCostSum(days: DayPlan[]): number {
    return days.reduce(
      (sum, day) => sum + day.spots.reduce((daySum, spot) => daySum + (Number(spot.cost) || 0), 0),
      0
    );
  }

  private cloneRecommendation(value: Recommendation): Recommendation {
    return JSON.parse(JSON.stringify(value)) as Recommendation;
  }

  /** 委托给 ModalLockService（引用计数，多 modal 叠开安全） */
  private lockPageScroll(): void {
    this.modalLock.lock();
  }

  private unlockPageScroll(): void {
    this.modalLock.unlock();
  }

  private syncMapHighlight(): void {
    if (!this.map) {
      return;
    }

    this.mapMarkers.forEach((marker) => {
      const markerName = (marker as any).travelPointName as string | undefined;
      const itineraryPoint = (marker as any).itineraryPoint as ItineraryMapPoint | undefined;
      const isHighlighted = !!this.selectedMapPointName && markerName === this.selectedMapPointName;
      // 行程标注要恢复成序号图标，不能用普通圆点覆盖
      marker.setIcon(itineraryPoint ? this.createItineraryMarkerIcon(itineraryPoint, isHighlighted) : this.createMarkerIcon(isHighlighted));
      if (!isHighlighted) {
        marker.closePopup();
      }
    });

    if (!this.selectedMapPointName) {
      return;
    }

    const activeMarker = this.mapMarkers.find((marker) => (marker as any).travelPointName === this.selectedMapPointName);
    if (activeMarker) {
      const itineraryPoint = (activeMarker as any).itineraryPoint as ItineraryMapPoint | undefined;
      activeMarker.setIcon(itineraryPoint ? this.createItineraryMarkerIcon(itineraryPoint, true) : this.createMarkerIcon(true));
      activeMarker.openPopup();
      this.map.panTo(activeMarker.getLatLng());
    }
  }

  private createMarkerIcon(highlighted = false): L.DivIcon {
    const color = highlighted ? '#f97316' : '#14b8a6';
    return L.divIcon({
      className: highlighted ? 'highlighted-map-marker' : 'default-map-marker',
      html: `<span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 3px rgba(255,255,255,0.6);color:#fff;font-size:10px;font-weight:700;">●</span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -12]
    });
  }

  private createPopupContent(point: { name: string; note?: string }): string {
    return `<div style="font-size:12px;line-height:1.5;max-width:170px;">
      <strong>${point.name}</strong><br>
      ${point.note ?? '热门地点'}
    </div>`;
  }

  /** 行程景点的序号圆点图标：颜色区分天数，数字为当天游览顺序 */
  private createItineraryMarkerIcon(point: ItineraryMapPoint, highlighted = false): L.DivIcon {
    const color = highlighted ? '#f97316' : ITINERARY_DAY_COLORS[(point.day - 1) % ITINERARY_DAY_COLORS.length];
    return L.divIcon({
      className: highlighted ? 'highlighted-map-marker' : 'itinerary-map-marker',
      html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);color:#fff;font-size:11px;font-weight:700;">${point.order}</span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -14]
    });
  }

  selectCompanion(id: CompanionId): void {
    this.form.companion = id;
    this.emitChange();
  }

  selectPurpose(id: PurposeId): void {
    this.form.purpose = id;
    this.emitChange();
  }

  togglePlaceType(id: PlaceTypeId): void {
    const index = this.form.placeTypes.indexOf(id);
    if (index >= 0) {
      if (this.form.placeTypes.length > 1) {
        this.form.placeTypes.splice(index, 1);
      }
    } else {
      this.form.placeTypes.push(id);
    }
    this.emitChange();
  }

  selectDestination(id: string): void {
    this.form.destinationId = id;
    this.emitChange();
  }

  onCustomDestinationChange(value: string): void {
    this.form.customDestination = value;
    this.emitChange();
  }

  setStartDate(value: string): void {
    this.form.startDate = value;
    this.emitChange();
  }

  openDatePicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    }
  }

  decrease(field: 'days' | 'people'): void {
    this.form[field] = Math.max(1, this.form[field] - 1);
    this.emitChange();
  }

  increase(field: 'days' | 'people'): void {
    const max = field === 'days' ? 15 : 20;
    this.form[field] = Math.min(max, this.form[field] + 1);
    this.emitChange();
  }

  onRestart(): void {
    this.router.navigate(['/wizard']);
  }

  onBudgetChange(value: number): void {
    this.form.budget = value;
    this.emitChange();
  }

  /** 松开滑块时才写回预算并重新生成，避免拖动过程中反复请求 */
  applyBudgetSlider(): void {
    this.onBudgetChange(this.budgetDisplay);
  }

  /** 快捷档位点击：同步滑块位置并应用 */
  selectBudget(value: number): void {
    this.budgetSliderIndex = this.nearestBudgetIndex(value);
    this.onBudgetChange(this.budgetDisplay);
  }

  private nearestBudgetIndex(value: number): number {
    let best = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    this.budgetStops.forEach((stop, index) => {
      const diff = Math.abs(stop - value);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = index;
      }
    });
    return best;
  }

  private emitChange(): void {
    const prefs = {
      ...this.form,
      placeTypes: [...this.form.placeTypes]
    };
    // 只触发重新生成；travel-intelligence 由新推荐到达后统一拉取，避免一次编辑发两遍
    this.state.updateAndRegenerate(prefs);
  }

  private loadTravelContext(): void {
    const destination = this.destinationName;
    const key = `${destination}::${this.form.startDate}`;
    if (key === this.travelContextKey) {
      return;
    }
    this.travelContextKey = key;

    const runId = ++this.travelContextRunId;
    this.weatherLoading = true;
    this.aiService.getTravelContext(this.form)
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        if (runId !== this.travelContextRunId) {
          return; // 目的地/日期已变化，丢弃过期上下文
        }
        this.travelContext = context;
        this.travelContextDestination = destination;
        this.weatherLoading = false;
        this.trackWeatherMode();
        setTimeout(() => {
          this.initMap();
          this.refreshMapMarkers();
        }, 0);
      });
  }

  /** 记录当前行程天气的数据来源，便于判断「常年参考/无数据」的占比 */
  private trackWeatherMode(): void {
    const list = this.tripWeather;
    const mode = list.length === 0
      ? 'none'
      : list.every(item => item.source === 'forecast')
        ? 'forecast'
        : list.some(item => item.source === 'forecast')
          ? 'mixed'
          : list.every(item => item.source === 'climate')
            ? 'climate'
            : 'none';
    this.tracking.track('weather_mode_view', { mode, days: list.length });
  }

  /** 把日程计划内的所有景点标注到地图概览（按天着色、数字表示当天游览顺序） */
  private loadItineraryPoints(): void {
    const rec = this.recommendation;
    if (!rec?.days?.length) {
      this.clearItineraryMarkers();
      this.itineraryPoints = [];
      this.geoFailedSpots = [];
      this.itineraryGeoLoading = false;
      return;
    }

    // 筛选的天已不存在（例如当天景点被删空）时回到「全部」
    if (this.activeMapDay !== null && !rec.days.some((day) => day.day === this.activeMapDay)) {
      this.activeMapDay = null;
    }

    // 按「天 → 当天顺序」收集景点，同名景点只标注第一次出现的位置
    const seen = new Set<string>();
    const list: Omit<ItineraryMapPoint, 'lat' | 'lng'>[] = [];
    rec.days.forEach((day) => {
      day.spots.forEach((spot, index) => {
        if (seen.has(spot.name)) {
          return;
        }
        seen.add(spot.name);
        list.push({ name: spot.name, day: day.day, order: index + 1, time: spot.time });
      });
    });

    const runId = ++this.itineraryGeoRunId;
    this.clearItineraryMarkers();
    this.itineraryPoints = [];
    this.geoFailedSpots = [];
    this.itineraryGeoLoading = true;

    // 小并发批量地理编码；每成功一个就先落一个标注，不阻塞在最快/最慢的景点上
    const results: (ItineraryMapPoint | null)[] = new Array(list.length).fill(null);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, list.length) }, async () => {
      while (cursor < list.length) {
        const index = cursor++;
        const item = list[index];
        const coords = await this.geocodeSpot(item.name);
        if (runId !== this.itineraryGeoRunId) {
          return;
        }
        if (coords) {
          const point = { ...item, ...coords };
          results[index] = point;
          this.itineraryPoints = [...this.itineraryPoints, point];
          this.addItineraryMarker(point);
        }
      }
    });

    void Promise.all(workers).then(() => {
      if (runId !== this.itineraryGeoRunId) {
        return; // 已有更新的行程标注任务，丢弃过期结果
      }
      this.itineraryGeoLoading = false;
      this.itineraryPoints = results.filter((p): p is ItineraryMapPoint => !!p);
      this.geoFailedSpots = list
        .filter((_, i) => !results[i])
        .map((item) => ({ day: item.day, name: item.name }));
      this.applyItineraryDayFilter();
      this.fitMapToItinerary();
    });
  }

  /** 景点名 → 坐标（走 /api/geocode 高德链路，按 目的地::景点名 缓存；失败不缓存，便于下次重试） */
  private async geocodeSpot(name: string): Promise<{ lat: number; lng: number } | null> {
    const key = `${this.destinationName}::${name}`;
    if (this.geoCache.has(key)) {
      return this.geoCache.get(key) ?? null;
    }

    const params = new URLSearchParams({
      q: name,
      city: this.destinationName
    });
    // 仅在当前上下文就是本目的地时才用城市坐标做兜底，避免切换目的地时串用旧坐标
    const fallback = this.travelContextDestination === this.destinationName ? this.travelContext?.geo : null;
    if (fallback?.lat && fallback?.lng) {
      params.set('lat', String(fallback.lat));
      params.set('lng', String(fallback.lng));
    }

    let coords: { lat: number; lng: number } | null = null;
    try {
      const res = await firstValueFrom(
        this.http.get<{ results: { lat: number; lng: number }[] }>(`/api/geocode?${params.toString()}`)
      );
      const top = res?.results?.[0];
      if (top?.lat && top?.lng) {
        coords = { lat: top.lat, lng: top.lng };
        this.geoCache.set(key, coords);
      }
    } catch { /* 定位失败按未标注处理 */ }

    return coords;
  }

  private initMap(): void {
    const container = document.getElementById('travel-map');
    if (!container) {
      return;
    }
    if (this.map) {
      return;
    }

    const coords = this.travelContext?.geo ?? { lat: 30.5728, lng: 104.0668 };
    this.map = L.map(container, { zoomControl: true, scrollWheelZoom: false }).setView([coords.lat, coords.lng], 11);

    // 高德地图中文瓦片：国内直连、免费、带中文标注
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图'
    }).addTo(this.map);

    this.mapReady = true;
  }

  private refreshMapMarkers(): void {
    if (!this.map) {
      return;
    }

    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        this.map?.removeLayer(layer);
      }
    });
    this.mapMarkers = [];
    this.itineraryMarkers = [];

    const center = this.travelContext?.geo ?? { lat: 30.5728, lng: 104.0668 };
    const centerMarker = L.marker([center.lat, center.lng], { icon: this.createMarkerIcon(false) }).addTo(this.map!);
    centerMarker.bindPopup(this.destinationName || '目的地');

    (this.travelContext?.highlights ?? []).forEach((point) => {
      const marker = L.marker([point.lat, point.lng], { icon: this.createMarkerIcon(false) }).addTo(this.map!);
      (marker as any).travelPointName = point.name;
      marker.bindPopup(this.createPopupContent(point));
      marker.on('click', () => this.openMapPoint(point.name));
      this.mapMarkers.push(marker);
    });

    // 行程景点标注：按天着色的序号圆点，点击复用景点详情弹窗
    this.itineraryPoints.forEach((point) => this.addItineraryMarker(point));

    this.applyItineraryDayFilter();
    this.fitMapToItinerary();
    this.syncMapHighlight();
  }

  /** 追加单个行程景点标注（增量渲染，无需等待所有景点定位完成） */
  private addItineraryMarker(point: ItineraryMapPoint): void {
    if (!this.map) {
      return;
    }
    const marker = L.marker([point.lat, point.lng], {
      icon: this.createItineraryMarkerIcon(point),
      zIndexOffset: 500
    }).addTo(this.map);
    (marker as any).travelPointName = point.name;
    (marker as any).itineraryPoint = point;
    marker.bindPopup(`<div style="font-size:12px;line-height:1.5;max-width:170px;">
      <strong>${point.name}</strong><br>
      第${point.day}天 · ${point.time} · 当天第${point.order}站
    </div>`);
    marker.on('click', () => this.openMapPoint(point.name));
    this.mapMarkers.push(marker);
    this.itineraryMarkers.push(marker);
    // 增量渲染时同步当前按天筛选（若该天被隐藏则立刻移除）
    this.applyItineraryDayFilter();
    if (this.selectedMapPointName) {
      this.syncMapHighlight();
    }
  }

  private clearItineraryMarkers(): void {
    if (this.map) {
      this.itineraryMarkers.forEach((marker) => this.map?.removeLayer(marker));
    }
    const removed = new Set<L.Marker>(this.itineraryMarkers);
    this.mapMarkers = this.mapMarkers.filter((marker) => !removed.has(marker));
    this.itineraryMarkers = [];
  }

  /** 统一调整视野：定位尚未完成时保持城市中心，完成后只做一次 fitBounds，避免地图反复跳动 */
  private fitMapToItinerary(): void {
    if (!this.map) {
      return;
    }
    const center = this.travelContext?.geo ?? { lat: 30.5728, lng: 104.0668 };
    if (this.itineraryGeoLoading) {
      this.map.setView([center.lat, center.lng], 11);
      return;
    }

    const visiblePoints = this.itineraryPoints.filter(
      (p) => this.activeMapDay === null || p.day === this.activeMapDay
    );
    const boundsPoints: [number, number][] = [
      ...(this.travelContext?.highlights ?? []).map((p) => [p.lat, p.lng] as [number, number]),
      ...visiblePoints.map((p) => [p.lat, p.lng] as [number, number])
    ];
    if (boundsPoints.length > 0) {
      this.map.fitBounds(L.latLngBounds(boundsPoints).pad(0.35));
    } else {
      this.map.setView([center.lat, center.lng], 11);
    }
  }
}
