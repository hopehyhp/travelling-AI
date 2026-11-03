import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { catchError, takeUntil, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { PlanService, SharedPlan } from '../../services/plan.service';
import { TravelStateService } from '../../services/travel-state.service';
import { DEFAULT_PREFERENCES, Recommendation, TravelPreferences } from '../../models/travel.model';
import { DESTINATIONS } from '../../data/travel-data';

@Component({
  selector: 'app-shared',
  templateUrl: './shared.component.html',
  styleUrls: ['./shared.component.scss']
})
export class SharedComponent implements OnInit, OnDestroy {
  plan: SharedPlan | null = null;
  isLoading = true;
  importing = false;
  error: { title: string; message: string } | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    public auth: AuthService,
    private planService: PlanService,
    private state: TravelStateService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(
      switchMap((params) => {
        const token = String(params['token'] || '').trim();
        if (!token) {
          return of(null);
        }
        return this.planService.getShared(token).pipe(
          catchError(() => of(null))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((result) => {
      this.isLoading = false;
      if (!result) {
        this.error = {
          title: '分享链接无效',
          message: '该链接可能已被取消或网络出现问题。请让分享方重新生成一条链接。'
        };
      } else {
        this.plan = result;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goAuth(): void {
    this.router.navigate(['/auth'], { state: { redirectUrl: this.router.url } });
  }

  /**
   * 把从后端拿到的 preferences 清洗成合法的 TravelPreferences。
   * 已保存的老攻略（db rowid bug 修复前保存）preferences 可能是 {} 或字段类型错乱，
   * 这里统一兜底，避免 `[...prefs.placeTypes]` 等操作炸掉。
   */
  private sanitizePreferences(raw: unknown): TravelPreferences {
    const safe = (raw && typeof raw === 'object') ? (raw as Partial<TravelPreferences>) : {};
    const placeTypes = Array.isArray(safe.placeTypes)
      ? safe.placeTypes.filter((t) => typeof t === 'string' && t.length > 0).slice(0, 8)
      : [...DEFAULT_PREFERENCES.placeTypes];
    return {
      destinationId: typeof safe.destinationId === 'string' && safe.destinationId.trim()
        ? safe.destinationId.trim()
        : DEFAULT_PREFERENCES.destinationId,
      customDestination: typeof safe.customDestination === 'string' ? safe.customDestination : '',
      travelIdea: typeof safe.travelIdea === 'string' ? safe.travelIdea : '',
      days: Number.isFinite(Number(safe.days)) && Number(safe.days) > 0
        ? Math.min(15, Math.max(1, Number(safe.days)))
        : DEFAULT_PREFERENCES.days,
      people: Number.isFinite(Number(safe.people)) && Number(safe.people) > 0
        ? Math.min(20, Math.max(1, Number(safe.people)))
        : DEFAULT_PREFERENCES.people,
      companion: typeof safe.companion === 'string' ? safe.companion : DEFAULT_PREFERENCES.companion,
      placeTypes,
      purpose: typeof safe.purpose === 'string' ? safe.purpose : DEFAULT_PREFERENCES.purpose,
      budget: Number.isFinite(Number(safe.budget)) && Number(safe.budget) >= 0
        ? Number(safe.budget)
        : DEFAULT_PREFERENCES.budget,
      startDate: typeof safe.startDate === 'string' ? safe.startDate : ''
    };
  }

  /**
   * 兜底 destinationName：
   * 已保存的老攻略（normalize 修复前保存）里 recommendation.destinationName 可能是 "目的地"，
   * 这里从 preferences.destinationId / customDestination 重新解析出真实名称。
   */
  get resolvedDestinationName(): string {
    if (!this.plan) return '';
    const recName = this.plan.recommendation?.destinationName?.trim();
    if (recName && recName !== '目的地') return recName;

    const prefs = this.plan.preferences;
    if (prefs?.customDestination?.trim()) return prefs.customDestination.trim();
    if (prefs?.destinationId && prefs.destinationId !== 'custom') {
      const found = DESTINATIONS.find((d) => d.id === prefs.destinationId);
      if (found?.name) return found.name;
    }
    return recName || '目的地';
  }

  /** 导入到当前登录用户的账户 */
  importToAccount(): void {
    if (!this.plan) return;
    if (!this.auth.currentUser) {
      this.goAuth();
      return;
    }

    this.importing = true;
    this.planService.import(this.plan.token).pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null))
    ).subscribe((result) => {
      this.importing = false;
      if (result) {
        // 先写 state 再导航，保证 result 页渲染时有数据
        const prefs = this.sanitizePreferences(this.plan!.preferences);
        const rec = this.plan!.recommendation;
        this.state.setPreferences(prefs);
        this.state.setRecommendation(rec);
        this.router.navigate(['/result']);
      } else {
        alert('导入失败，请稍后重试。');
      }
    });
  }

  /** 不走导入流程，直接把分享方案灌进 state，让用户在 result 页预览 */
  previewInResult(): void {
    if (!this.plan) return;
    const prefs = this.sanitizePreferences(this.plan.preferences);
    const rec: Recommendation = {
      ...this.plan.recommendation,
      destinationName: this.resolvedDestinationName
    };
    this.state.setPreferences(prefs);
    this.state.setRecommendation(rec);
    this.router.navigate(['/result']);
  }
}
