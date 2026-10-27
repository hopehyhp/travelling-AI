import { Component, EventEmitter, OnDestroy, AfterViewInit, Input, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { SpotPlan } from '../../models/travel.model';

interface GeoCandidate {
  name: string;
  display_name: string;
  lat: number;
  lng: number;
  admin1?: string;
}

/**
 * 景点详情 Modal —— 独立的 Leaflet 小地图 + 异步 geocode + 三套导航链接。
 * 完全自包含：自己调 HTTP /api/geocode、自己创建销毁地图、emit close 给父组件。
 */
@Component({
  selector: 'app-spot-detail-modal',
  template: `
    <div class="spot-modal-backdrop" (click)="close.emit()">
      <div class="spot-modal" (click)="$event.stopPropagation()">
        <div class="spot-modal-header">
          <span class="spot-modal-time">{{ spot.time }}</span>
          <span class="spot-modal-tag">{{ spot.category }}</span>
        </div>
        <h3>{{ spot.name }}</h3>
        <p class="spot-modal-desc">{{ spot.description }}</p>

        <div class="spot-modal-grid">
          <div class="spot-modal-stat">
            <span class="label">参考预算</span>
            <strong>{{ priceLabel }}</strong>
          </div>
          <div class="spot-modal-stat">
            <span class="label">推荐停留</span>
            <strong>{{ spot.stay || '1.5–2 小时' }}</strong>
          </div>
        </div>

        <div class="spot-modal-detail" *ngIf="spot.locationNote || spot.priceNote">
          <p *ngIf="spot.priceNote">{{ spot.priceNote }}</p>
          <p *ngIf="spot.locationNote">{{ spot.locationNote }}</p>
        </div>

        <!-- 景点小地图 -->
        <div class="spot-map-section">
          <div id="spot-detail-map" class="spot-detail-map"></div>

          <div class="spot-map-status" *ngIf="geoLoading">
            <span class="spot-geo-spinner"></span> 正在定位景点坐标…
          </div>
          <div class="spot-map-status error" *ngIf="geoError">
            ⚠️ 未找到精确坐标，可直接使用下方导航按钮
          </div>

          <!-- 候选坐标：地理编码返回多个结果时让用户选 -->
          <div class="spot-geo-candidates" *ngIf="geoCandidates.length > 1">
            <span class="spot-geo-candidates-label">多个匹配结果：</span>
            <button
              *ngFor="let c of geoCandidates; let i = index"
              type="button"
              class="spot-geo-chip"
              [class.active]="selectedCoords && c.lat === selectedCoords.lat && c.lng === selectedCoords.lng"
              (click)="selectGeoCandidate(i)"
            >
              {{ c.name }}<span *ngIf="c.admin1"> · {{ c.admin1 }}</span>
            </button>
          </div>

          <!-- 导航按钮组 -->
          <div class="spot-nav-row">
            <a class="spot-nav-btn amap" [href]="amapNavUrl" target="_blank" rel="noreferrer">🧭 高德导航</a>
            <a class="spot-nav-btn baidu" [href]="baiduNavUrl" target="_blank" rel="noreferrer">🚕 百度导航</a>
            <a class="spot-nav-btn google" [href]="googleNavUrl" target="_blank" rel="noreferrer">🗺️ Google 地图</a>
          </div>
        </div>

        <div class="spot-modal-insight">
          <div class="insight-title">为什么推荐它</div>
          <ul *ngIf="spot.reasons?.length; else noReasonsTpl">
            <li *ngFor="let reason of spot.reasons">{{ reason }}</li>
          </ul>
          <ng-template #noReasonsTpl>
            <p class="spot-modal-desc">这个地点与你的行程偏好匹配，值得安排到路线中。</p>
          </ng-template>
        </div>

        <button type="button" class="spot-modal-btn" (click)="close.emit()">了解了</button>
      </div>
    </div>
  `
})
export class SpotDetailModalComponent implements AfterViewInit, OnDestroy {
  @Input() spot!: SpotPlan;
  @Input() destinationName = '';
  /** 目的地中心坐标（用于小地图初始定位 + geocode fallback） */
  @Input() geoFallback!: { lat: number; lng: number };

  @Output() close = new EventEmitter<void>();

  private map: L.Map | null = null;

  geoLoading = true;
  geoError = false;
  geoCandidates: GeoCandidate[] = [];
  selectedCoords: { lat: number; lng: number } | null = null;

  constructor(private http: HttpClient) {}

  get priceLabel(): string {
    if (!this.spot) return '参考估算';
    return this.spot.cost > 0 ? `¥ ${this.spot.cost}` : '参考估算';
  }

  get amapNavUrl(): string {
    if (!this.spot) return '#';
    const dest = this.selectedCoords
      ? `${this.selectedCoords.lng},${this.selectedCoords.lat},${encodeURIComponent(this.spot.name)}`
      : encodeURIComponent(this.spot.name);
    return `https://uri.amap.com/navigation?to=${dest}&mode=car&policy=1&src=travelling-ai&coordinate=gaode&callnative=1`;
  }

  get baiduNavUrl(): string {
    if (!this.spot) return '#';
    const query = encodeURIComponent(`${this.spot.name} ${this.destinationName}`);
    const coordPart = this.selectedCoords
      ? `&location=${this.selectedCoords.lng},${this.selectedCoords.lat}`
      : '';
    return `https://api.map.baidu.com/direction?destination=${query}${coordPart}&mode=driving&region=${encodeURIComponent(this.destinationName)}&output=html&src=travelling-ai`;
  }

  get googleNavUrl(): string {
    if (!this.spot) return '#';
    const query = this.selectedCoords
      ? `${this.selectedCoords.lat},${this.selectedCoords.lng}`
      : encodeURIComponent(`${this.spot.name} ${this.destinationName}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
  }

  async ngAfterViewInit(): Promise<void> {
    // AfterViewInit 保证模板 DOM 已渲染，可以直接初始化地图
    await this.initMapAndGeocode();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  selectGeoCandidate(index: number): void {
    const c = this.geoCandidates[index];
    if (!c || !this.map) return;
    this.selectedCoords = { lat: c.lat, lng: c.lng };
    this.renderMarker(c.lat, c.lng, c.name);
  }

  private async initMapAndGeocode(): Promise<void> {
    const container = document.getElementById('spot-detail-map');
    if (!container) {
      this.geoLoading = false;
      this.geoError = true;
      return;
    }

    // 1. 先初始化空地图（目的地中心）
    const fallback = this.geoFallback ?? { lat: 30.5728, lng: 104.0668 };
    this.map = L.map(container, { zoomControl: true, scrollWheelZoom: false })
      .setView([fallback.lat, fallback.lng], 13);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图'
    }).addTo(this.map);
    container.classList.add('spot-map-ready');

    // 2. 异步 geocode
    const query = this.buildGeocodeQuery();
    if (!query) {
      this.geoLoading = false;
      this.geoError = true;
      return;
    }

    try {
      const res = await firstValueFrom(
        this.http.get<{ results: GeoCandidate[] }>(
          `/api/geocode?q=${encodeURIComponent(query)}&city=${encodeURIComponent(this.destinationName)}&lat=${fallback.lat}&lng=${fallback.lng}`
        )
      );
      this.geoLoading = false;
      if (res?.results?.length) {
        this.geoCandidates = res.results;
        const top = res.results[0];
        this.selectedCoords = { lat: top.lat, lng: top.lng };
        this.renderMarker(top.lat, top.lng, top.name);
      } else {
        this.geoError = true;
      }
    } catch {
      this.geoLoading = false;
      this.geoError = true;
    }
  }

  /** 安全构造 geocode 查询字符串，剥离可能重复的城市名后缀 */
  private buildGeocodeQuery(): string {
    const raw = (this.spot.locationQuery || this.spot.name || '').trim();
    let q = raw;
    if (this.destinationName && raw.includes(this.destinationName)) {
      q = raw
        .replace(new RegExp(`[\\s,，、·\\-]+${this.destinationName}$`), '')
        .replace(new RegExp(`^${this.destinationName}[\\s,，、·\\-]+`), '')
        .trim();
    }
    return q || this.spot.name || raw;
  }

  private renderMarker(lat: number, lng: number, label: string): void {
    if (!this.map) return;
    this.map.eachLayer((layer) => {
      if ((layer as any)._isSpotMarker) {
        this.map!.removeLayer(layer);
      }
    });
    const marker = L.marker([lat, lng]).addTo(this.map);
    (marker as any)._isSpotMarker = true;
    marker.bindPopup(`<strong>${label}</strong>`).openPopup();
    this.map.setView([lat, lng], 15);
    setTimeout(() => this.map?.invalidateSize(), 100);
  }
}
