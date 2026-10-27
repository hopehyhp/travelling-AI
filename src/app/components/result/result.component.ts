import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import {
  COMPANION_LABELS,
  COMPANION_OPTIONS,
  CompanionId,
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
  WeatherDay
} from '../../models/travel.model';
import { DESTINATIONS } from '../../data/travel-data';
import { SeasonService } from '../../services/season.service';
import { AiService } from '../../services/ai.service';
import { TravelStateService } from '../../services/travel-state.service';
import { AuthService, AuthUser } from '../../services/auth.service';
import { PlanService, ShareResult } from '../../services/plan.service';
import { ModalLockService } from '../../services/modal-lock.service';
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
  weatherLoading = true;
  selectedSpot: SpotPlan | null = null;
  selectedMapPointName: string | null = null;
  replacementContext: { dayIndex: number; spotIndex: number; spot: SpotPlan } | null = null;
  replacementOptions: SpotReplacementOption[] = [];
  replacementNotice: string | null = null;
  shareNotice: string | null = null;
  saveNotice: string | null = null;
  user: AuthUser | null = null;

  /** 定时刷新分享统计的定时器（owner 已分享时） */
  private shareStatsTimer: ReturnType<typeof setInterval> | null = null;

  saveDialog: SaveDialogState = { open: false, name: '', loading: false, error: null };
  shareDialog: ShareDialogState = { open: false, loading: false, result: null, error: null };
  savedPlanId: number | null = null;
  private mapMarkers: L.Marker[] = [];

  /** 行程景点标注：按天着色 + 当天序号 */
  itineraryPoints: ItineraryMapPoint[] = [];
  itineraryGeoLoading = false;
  geoFailedSpots: string[] = [];
  /** 景点坐标缓存（按 目的地::景点名），避免移动/换景点后重复地理编码 */
  private geoCache = new Map<string, { lat: number; lng: number } | null>();
  private itineraryGeoRunId = 0;

  private destroy$ = new Subject<void>();

  destinations = DESTINATIONS;
  companionOptions = COMPANION_OPTIONS;
  placeTypeOptions = PLACE_TYPE_OPTIONS;
  purposeOptions = PURPOSE_OPTIONS;

  budgetMin = 500;
  budgetMax = 100000;
  budgetStep = 500;

  constructor(
    private http: HttpClient,
    private seasonService: SeasonService,
    private aiService: AiService,
    private state: TravelStateService,
    private auth: AuthService,
    private planService: PlanService,
    private modalLock: ModalLockService,
    private router: Router
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

    // 订阅 recommendation 变化：AI 生成完成后会自动更新
    this.state.recommendationChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe((rec) => {
        this.recommendation = rec;
        this.isLoading = false;
        if (rec) {
          this.form = {
            ...this.state.preferences,
            placeTypes: [...this.state.preferences.placeTypes]
          };
          this.loadTravelContext();
          this.loadItineraryPoints();
        }
      });

    // 如果 state 已经有 recommendation（从 localStorage 恢复），直接渲染
    if (this.state.recommendation) {
      this.recommendation = this.state.recommendation;
      this.loadTravelContext();
      this.loadItineraryPoints();
    } else {
      // 还没有 recommendation，等调用方触发 regenerate$ 后自动响应
      this.isLoading = true;
    }
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // 组件销毁时兜底解锁所有 body 滚动（覆盖可能遗留的多 modal 叠加）
    this.modalLock.reset();
    this.clearShareStatsTimer();
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

  get quickDateOptions(): { label: string; value: string }[] {
    return this.seasonService.quickDateOptions();
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

  get weatherForecast(): WeatherDay[] {
    return this.travelContext?.weather?.forecast?.slice(0, 5) ?? [];
  }

  get mapPoints() {
    return this.travelContext?.highlights ?? [];
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

    const weather = this.travelContext?.weather?.today;
    if (weather) {
      if (weather.rainChance !== null && weather.rainChance >= 60) {
        items.push({
          title: '雨天适配',
          text: '当前降雨概率较高，优先放置博物馆、茶馆、室内美食和购物类安排，户外景点切换到白天晴朗时段或改成短时逛景。',
          tag: '天气调整'
        });
      } else if (weather.max !== null && weather.max >= 30) {
        items.push({
          title: '高温适配',
          text: '当前高温明显，建议将户外项目调整为早晨和傍晚，午间改为休息、室内展览或美食体验，降低体力消耗。',
          tag: '高温避暑'
        });
      } else {
        items.push({
          title: '适宜出行',
          text: '当前天气较适合外出，适合安排远足、城市观光和摄影打卡类活动，白天和傍晚都可充分利用。',
          tag: '最佳时段'
        });
      }
    }

    return items.slice(0, 3);
  }

  get dailyAdjustments(): { day: number; title: string; slots: { label: string; text: string }[]; note: string }[] {
    const baseDays = this.recommendation?.days ?? [];
    const forecast = this.travelContext?.weather?.forecast ?? [];

    return baseDays.map((day, index) => {
      const weather = forecast[index] ?? forecast[0] ?? null;
      const rainy = weather && weather.rainChance !== null && weather.rainChance >= 60;
      const hot = weather && weather.max !== null && weather.max >= 30;
      const cool = weather && weather.max !== null && weather.max <= 15;

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
        note: rainy
          ? '天气提醒：降雨概率较高，建议把户外打卡压缩在晴朗窗口内。'
          : hot
            ? '天气提醒：高温明显，建议把户外活动前移至早晚时段。'
            : cool
              ? '天气提醒：气温较低，建议外套、保暖层和长时间驻足少一些。'
              : '天气提醒：适合全天外出，白天和傍晚都可安排重点活动。'
      };
    });
  }

  openEdit(key: FieldKey): void {
    this.editing = this.editing === key ? null : key;
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

  moveSpot(dayIndex: number, spotIndex: number, direction: -1 | 1): void {
    if (!this.recommendation || !this.recommendation.days?.[dayIndex]) {
      return;
    }

    const day = this.recommendation.days[dayIndex];
    const nextIndex = spotIndex + direction;
    if (nextIndex < 0 || nextIndex >= day.spots.length) {
      return;
    }

    const days = this.recommendation.days.map((entry, idx) => {
      if (idx !== dayIndex) {
        return { ...entry, spots: [...entry.spots] };
      }

      const spots = [...entry.spots];
      const [moved] = spots.splice(spotIndex, 1);
      spots.splice(nextIndex, 0, moved);
      return { ...entry, spots };
    });

    this.publishRecommendation({ ...this.recommendation, days, attractionCount: days.reduce((count, dayEntry) => count + dayEntry.spots.length, 0) });
  }

  requestReplacement(dayIndex: number, spotIndex: number, spot: SpotPlan): void {
    this.replacementContext = { dayIndex, spotIndex, spot };
    this.replacementOptions = [];
    this.replacementNotice = null;
    this.aiService.replaceSpot(this.form, spot, dayIndex, this.recommendation).subscribe((result: SpotReplacementResult) => {
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
    const save$ = this.savedPlanId
      ? this.planService.update(this.savedPlanId, name, prefs, rec)
      : this.planService.create(name, prefs, rec);

    save$.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if ((res as any).plan?.id) {
            this.savedPlanId = (res as any).plan.id;
          }
          if (this.savedPlanId) {
            this.state.setCurrentPlan(this.savedPlanId, name);
          }
          this.saveNotice = '✅ 方案已保存到你的账户';
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
    this.recommendation = updated;
    this.state.setRecommendation(this.cloneRecommendation(updated));
    // 移动/换景点后重排地图上的行程标注（已有坐标的景点走缓存，不会重复请求）
    this.loadItineraryPoints();
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

  private emitChange(): void {
    const prefs = {
      ...this.form,
      placeTypes: [...this.form.placeTypes]
    };
    this.state.updateAndRegenerate(prefs);
    this.loadTravelContext();
  }

  private loadTravelContext(): void {
    this.weatherLoading = true;
    this.aiService.getTravelContext(this.form).subscribe((context) => {
      this.travelContext = context;
      this.weatherLoading = false;
      setTimeout(() => {
        this.initMap();
        this.refreshMapMarkers();
      }, 0);
    });
  }

  /** 把日程计划内的所有景点标注到地图概览（按天着色、数字表示当天游览顺序） */
  private loadItineraryPoints(): void {
    const rec = this.recommendation;
    if (!rec?.days?.length) {
      this.itineraryPoints = [];
      this.geoFailedSpots = [];
      this.itineraryGeoLoading = false;
      return;
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
    this.itineraryGeoLoading = true;
    this.geoFailedSpots = [];

    // 小并发批量地理编码，完成后统一刷新地图标注
    const results: (ItineraryMapPoint | null)[] = new Array(list.length).fill(null);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, list.length) }, async () => {
      while (cursor < list.length) {
        const index = cursor++;
        const item = list[index];
        const coords = await this.geocodeSpot(item.name);
        if (coords) {
          results[index] = { ...item, ...coords };
        }
      }
    });

    void Promise.all(workers).then(() => {
      if (runId !== this.itineraryGeoRunId) {
        return; // 已有更新的行程标注任务，丢弃过期结果
      }
      this.itineraryGeoLoading = false;
      this.itineraryPoints = results.filter((p): p is ItineraryMapPoint => !!p);
      this.geoFailedSpots = list.filter((_, i) => !results[i]).map((item) => item.name);
      this.refreshMapMarkers();
    });
  }

  /** 景点名 → 坐标（走 /api/geocode 高德链路，按 目的地::景点名 缓存，含失败结果） */
  private async geocodeSpot(name: string): Promise<{ lat: number; lng: number } | null> {
    const key = `${this.destinationName}::${name}`;
    if (this.geoCache.has(key)) {
      return this.geoCache.get(key) ?? null;
    }

    const fallback = this.travelContext?.geo ?? { lat: 0, lng: 0 };
    const params = new URLSearchParams({
      q: name,
      lat: String(fallback.lat),
      lng: String(fallback.lng),
      city: this.destinationName
    });

    let coords: { lat: number; lng: number } | null = null;
    try {
      const res = await firstValueFrom(
        this.http.get<{ results: { lat: number; lng: number }[] }>(`/api/geocode?${params.toString()}`)
      );
      const top = res?.results?.[0];
      if (top?.lat && top?.lng) {
        coords = { lat: top.lat, lng: top.lng };
      }
    } catch { /* 定位失败按未标注处理 */ }

    this.geoCache.set(key, coords);
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
    this.refreshMapMarkers();
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
    this.itineraryPoints.forEach((point) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: this.createItineraryMarkerIcon(point),
        zIndexOffset: 500
      }).addTo(this.map!);
      (marker as any).travelPointName = point.name;
      (marker as any).itineraryPoint = point;
      marker.bindPopup(`<div style="font-size:12px;line-height:1.5;max-width:170px;">
        <strong>${point.name}</strong><br>
        第${point.day}天 · ${point.time} · 当天第${point.order}站
      </div>`);
      marker.on('click', () => this.openMapPoint(point.name));
      this.mapMarkers.push(marker);
    });

    const boundsPoints: [number, number][] = [
      ...(this.travelContext?.highlights ?? []).map((p) => [p.lat, p.lng] as [number, number]),
      ...this.itineraryPoints.map((p) => [p.lat, p.lng] as [number, number])
    ];
    if (boundsPoints.length > 0) {
      this.map!.fitBounds(L.latLngBounds(boundsPoints).pad(0.35));
    } else {
      this.map!.setView([center.lat, center.lng], 11);
    }

    this.syncMapHighlight();
  }
}
