import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { AiService } from './services/ai.service';
import { RecommendationService } from './services/recommendation.service';
import { TravelStateService } from './services/travel-state.service';
import { AuthService, AuthUser } from './services/auth.service';
import { TrackingService } from './services/tracking.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  isGenerating = false;
  /** 结果页是否已有可展示内容：用于区分“首次生成”和“已有内容时刷新” */
  hasRecommendation = false;

  private regenerate$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  /** 本次生成的起始时间，用于统计生成耗时 */
  private generateStartedAt = 0;

  constructor(
    public router: Router,
    public auth: AuthService,
    private aiService: AiService,
    private recommendationService: RecommendationService,
    private state: TravelStateService,
    private tracking: TrackingService
  ) {
    // 从 state 订阅 regenerate$ 的 preferences
    this.state.regenerate$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        switchMap((prefs) => {
          this.isGenerating = true;
          this.generateStartedAt = performance.now();
          this.tracking.track('generate_start', {
            days: prefs.days,
            hasStartDate: Boolean(prefs.startDate),
            destination: prefs.destinationId === 'custom' ? 'custom' : 'preset'
          });
          return this.aiService.generate(prefs);
        })
      )
      .subscribe({
        next: (rec) => {
          this.state.setRecommendation(rec);
          this.isGenerating = false;
          this.tracking.track('generate_success', { duration: this.generateDuration(), source: 'ai' });
          if (this.router.url !== '/result') {
            this.router.navigate(['/result']);
          }
        },
        error: () => {
          const fallback = this.recommendationService.generate(this.state.preferences);
          this.state.setRecommendation(fallback);
          this.isGenerating = false;
          this.tracking.track('generate_fallback', { duration: this.generateDuration(), source: 'local' });
          if (this.router.url !== '/result') {
            this.router.navigate(['/result']);
          }
        }
      });

    // 结果页已有内容时才显示顶部“更新中”提示，首次生成只保留页面内的加载态
    this.state.recommendationChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe((rec) => {
        this.hasRecommendation = !!rec;
      });
  }

  ngOnInit(): void {
    // 页面启动时校验登录态（读取 localStorage + /api/auth/me 验证）
    this.auth.init();

    // 仅恢复上次生成的攻略，供 /result 直接刷新时渲染；
    // 访问首页时不再自动跳到结果页，用户回到首页即停留在首页。
    this.state.restore();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** 生成耗时（毫秒），未记录时返回 0 */
  private generateDuration(): number {
    if (!this.generateStartedAt) return 0;
    return Math.round(performance.now() - this.generateStartedAt);
  }

  goAuth(): void {
    this.router.navigate(['/auth'], { state: { redirectUrl: this.router.url } });
  }

  goProfile(): void {
    this.router.navigate(['/profile']);
  }

  userLabel(user: AuthUser): string {
    return user.nickname?.trim() || user.username;
  }

  userInitial(user: AuthUser): string {
    return this.userLabel(user).slice(0, 1).toUpperCase();
  }

  doLogout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
