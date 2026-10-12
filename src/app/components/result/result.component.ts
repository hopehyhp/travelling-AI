import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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
  SeasonContext,
  SpotPlan,
  TravelContext,
  TravelPreferences,
  WeatherDay
} from '../../models/travel.model';
import { DESTINATIONS } from '../../data/travel-data';
import { SeasonService } from '../../services/season.service';
import { AiService } from '../../services/ai.service';
import * as L from 'leaflet';

type FieldKey = 'destination' | 'companion' | 'placeTypes' | 'purpose' | 'days' | 'people' | 'startDate' | 'budget';

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.scss']
})
export class ResultComponent implements OnInit {
  @Input() preferences!: TravelPreferences;
  @Input() recommendation!: Recommendation;
  @Output() preferencesChange = new EventEmitter<TravelPreferences>();
  @Output() restart = new EventEmitter<void>();

  form!: TravelPreferences;
  editing: FieldKey | null = null;
  travelContext: TravelContext | null = null;
  map: L.Map | null = null;
  mapReady = false;
  weatherLoading = true;
  selectedSpot: SpotPlan | null = null;
  selectedMapPointName: string | null = null;
  private mapMarkers: L.Marker[] = [];

  destinations = DESTINATIONS;
  companionOptions = COMPANION_OPTIONS;
  placeTypeOptions = PLACE_TYPE_OPTIONS;
  purposeOptions = PURPOSE_OPTIONS;

  budgetMin = 500;
  budgetMax = 100000;
  budgetStep = 500;

  constructor(
    private seasonService: SeasonService,
    private aiService: AiService
  ) {}

  ngOnInit(): void {
    this.form = {
      ...this.preferences,
      placeTypes: [...this.preferences.placeTypes]
    };
    this.loadTravelContext();
  }

  ngAfterViewInit(): void {
    this.initMap();
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
    return this.recommendation.season;
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
    this.selectedSpot = spot;
    this.selectedMapPointName = spot.name;
    this.syncMapHighlight();
  }

  closeSpotDetail(): void {
    this.selectedSpot = null;
    this.selectedMapPointName = null;
    this.syncMapHighlight();
  }

  openMapPoint(pointName: string): void {
    const matchedSpot = this.recommendation.days
      .flatMap(day => day.spots)
      .find(spot => spot.name === pointName);

    if (matchedSpot) {
      this.selectedSpot = matchedSpot;
      this.selectedMapPointName = pointName;
    }
    this.syncMapHighlight();
  }

  private syncMapHighlight(): void {
    if (!this.map) {
      return;
    }

    this.mapMarkers.forEach((marker) => {
      const markerName = (marker as any).travelPointName as string | undefined;
      const isHighlighted = !!this.selectedMapPointName && markerName === this.selectedMapPointName;
      marker.setIcon(this.createMarkerIcon(isHighlighted));
      if (!isHighlighted) {
        marker.closePopup();
      }
    });

    if (!this.selectedMapPointName) {
      return;
    }

    const activeMarker = this.mapMarkers.find((marker) => (marker as any).travelPointName === this.selectedMapPointName);
    if (activeMarker) {
      activeMarker.setIcon(this.createMarkerIcon(true));
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

  decrease(field: 'days' | 'people'): void {
    this.form[field] = Math.max(1, this.form[field] - 1);
    this.emitChange();
  }

  increase(field: 'days' | 'people'): void {
    const max = field === 'days' ? 15 : 20;
    this.form[field] = Math.min(max, this.form[field] + 1);
    this.emitChange();
  }

  onBudgetChange(value: number): void {
    this.form.budget = value;
    this.emitChange();
  }

  private emitChange(): void {
    this.preferencesChange.emit({
      ...this.form,
      placeTypes: [...this.form.placeTypes]
    });
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
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

    if ((this.travelContext?.highlights ?? []).length > 0) {
      const bounds = L.latLngBounds((this.travelContext?.highlights ?? []).map((p) => [p.lat, p.lng]));
      this.map!.fitBounds(bounds.pad(0.35));
    } else {
      this.map!.setView([center.lat, center.lng], 11);
    }

    this.syncMapHighlight();
  }
}
