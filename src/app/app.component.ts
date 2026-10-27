import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { AiService } from './services/ai.service';
import { RecommendationService } from './services/recommendation.service';
import { TravelStateService } from './services/travel-state.service';
import { AuthService, AuthUser } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  isGenerating = false;

  private regenerate$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    public router: Router,
    public auth: AuthService,
    private aiService: AiService,
    private recommendationService: RecommendationService,
    private state: TravelStateService
  ) {
    // 从 state 订阅 regenerate$ 的 preferences
    this.state.regenerate$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        switchMap((prefs) => {
          this.isGenerating = true;
          return this.aiService.generate(prefs);
        })
      )
      .subscribe({
        next: (rec) => {
          this.state.setRecommendation(rec);
          this.isGenerating = false;
          if (this.router.url !== '/result') {
            this.router.navigate(['/result']);
          }
        },
        error: () => {
          const fallback = this.recommendationService.generate(this.state.preferences);
          this.state.setRecommendation(fallback);
          this.isGenerating = false;
          if (this.router.url !== '/result') {
            this.router.navigate(['/result']);
          }
        }
      });
  }

  ngOnInit(): void {
    // 页面启动时校验登录态（读取 localStorage + /api/auth/me 验证）
    this.auth.init();

    const restored = this.state.restore();
    if (restored && this.state.recommendation) {
      const currentUrl = this.router.url;
      if (currentUrl === '/' || currentUrl === '') {
        this.router.navigate(['/result']);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
