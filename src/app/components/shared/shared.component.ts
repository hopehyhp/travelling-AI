import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { catchError, takeUntil, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { PlanService, SharedPlan } from '../../services/plan.service';
import { TravelStateService } from '../../services/travel-state.service';
import { Recommendation, TravelPreferences } from '../../models/travel.model';

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
        const prefs = this.plan!.preferences;
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
    const prefs: TravelPreferences = this.plan.preferences || {
      destinationId: 'custom',
      customDestination: this.plan.recommendation?.destinationName || '',
      days: 3, people: 2, companion: 'couple',
      placeTypes: ['food', 'nature'], purpose: 'relax',
      budget: 5000, startDate: '', travelIdea: ''
    };
    const rec: Recommendation = this.plan.recommendation;
    this.state.setPreferences(prefs);
    this.state.setRecommendation(rec);
    this.router.navigate(['/result']);
  }
}
