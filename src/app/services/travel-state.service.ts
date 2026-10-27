import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import {
  DEFAULT_PREFERENCES,
  Recommendation,
  SavedTravelPlan,
  TravelPreferences
} from '../models/travel.model';

@Injectable({ providedIn: 'root' })
export class TravelStateService {
  private readonly savedPlanKey = 'travelling-ai.saved-plan';
  private readonly currentPlanKey = 'travelling-ai.current-plan';

  private currentPlan: { id: number; name: string } | null = this.loadCurrentPlan();

  private preferences$ = new BehaviorSubject<TravelPreferences>({
    ...DEFAULT_PREFERENCES,
    placeTypes: [...DEFAULT_PREFERENCES.placeTypes]
  });

  private recommendation$ = new BehaviorSubject<Recommendation | null>(null);
  private ideaDraft$ = new BehaviorSubject<string>('');
  private ideaError$ = new BehaviorSubject<string>('');

  /** 触发重新生成：值为新的 preferences */
  regenerate$ = new Subject<TravelPreferences>();

  preferences: TravelPreferences = this.preferences$.getValue();
  recommendation: Recommendation | null = null;
  ideaDraft = '';
  ideaError = '';

  preferencesChanges(): Observable<TravelPreferences> {
    return this.preferences$.asObservable();
  }

  recommendationChanges(): Observable<Recommendation | null> {
    return this.recommendation$.asObservable();
  }

  /** 设置 preferences 并通知订阅者（不触发 AI 重新生成） */
  setPreferences(prefs: TravelPreferences): void {
    this.preferences = { ...prefs, placeTypes: [...prefs.placeTypes] };
    this.preferences$.next(this.preferences);
  }

  /** 更新 preferences 后触发 regenerate$，让 AppComponent 的订阅触发 AI 重新生成 */
  updateAndRegenerate(prefs: TravelPreferences): void {
    this.setPreferences(prefs);
    this.regenerate$.next(this.preferences);
  }

  setRecommendation(rec: Recommendation | null): void {
    this.recommendation = rec;
    this.recommendation$.next(rec);
    if (rec) {
      this.persistPlan();
    }
  }

  get currentPlanId(): number | null {
    return this.currentPlan?.id ?? null;
  }

  get currentPlanName(): string | null {
    return this.currentPlan?.name || null;
  }

  /** 记录当前编辑的是哪个已保存方案（再次保存时走更新） */
  setCurrentPlan(id: number, name: string): void {
    this.currentPlan = { id, name: name || '' };
    try {
      localStorage.setItem(this.currentPlanKey, JSON.stringify(this.currentPlan));
    } catch {}
  }

  clearCurrentPlan(): void {
    this.currentPlan = null;
    try {
      localStorage.removeItem(this.currentPlanKey);
    } catch {}
  }

  /** 从方案历史中载入一个已保存方案 */
  loadPlan(preferences: TravelPreferences, recommendation: Recommendation, id: number, name: string): void {
    this.setPreferences(preferences);
    this.setRecommendation(recommendation);
    this.setCurrentPlan(id, name);
  }

  setIdeaDraft(value: string): void {
    this.ideaDraft = value;
    this.ideaDraft$.next(value);
  }

  setIdeaError(value: string): void {
    this.ideaError = value;
    this.ideaError$.next(value);
  }

  clearIdea(): void {
    this.setIdeaDraft('');
    this.setIdeaError('');
  }

  /** 持久化当前攻略 */
  persistPlan(): void {
    if (!this.recommendation) {
      return;
    }
    const payload: SavedTravelPlan = {
      preferences: {
        ...this.preferences,
        placeTypes: [...this.preferences.placeTypes]
      },
      recommendation: {
        ...this.recommendation,
        days: this.recommendation.days.map((day) => ({
          ...day,
          spots: day.spots.map((spot) => ({ ...spot }))
        })),
        tags: [...this.recommendation.tags],
        tips: [...this.recommendation.tips]
      },
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(this.savedPlanKey, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage errors
    }
  }

  /** 从 localStorage 恢复，成功返回 true */
  restore(): boolean {
    try {
      const raw = localStorage.getItem(this.savedPlanKey);
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw) as SavedTravelPlan;
      if (!parsed || !parsed.preferences || !parsed.recommendation) {
        return false;
      }
      this.setPreferences(parsed.preferences);
      this.setRecommendation(parsed.recommendation);
      return true;
    } catch (error) {
      return false;
    }
  }

  /** 自由想法模式的初始化：清空 preferences 并设置 travelIdea */
  prepareIdea(idea: string): TravelPreferences {
    const prefs: TravelPreferences = {
      ...DEFAULT_PREFERENCES,
      destinationId: 'custom',
      customDestination: '',
      travelIdea: idea,
      placeTypes: [...DEFAULT_PREFERENCES.placeTypes]
    };
    this.setPreferences(prefs);
    return prefs;
  }

  private loadCurrentPlan(): { id: number; name: string } | null {
    try {
      const raw = localStorage.getItem(this.currentPlanKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.id !== 'number') return null;
      return { id: parsed.id, name: String(parsed.name || '') };
    } catch {
      return null;
    }
  }
}
