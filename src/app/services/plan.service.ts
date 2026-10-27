import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recommendation, TravelPreferences } from '../models/travel.model';

export interface PlanSummary {
  id: number;
  name: string;
  destination: string;
  days: number;
  budget: number;
  people?: number;
  shared?: boolean;
  share_token?: string | null;
  updated_at: string;
  created_at: string;
}

export interface PlanDetail {
  id: number;
  name: string;
  user_id: number;
  preferences: TravelPreferences;
  recommendation: Recommendation;
  created_at: string;
  updated_at: string;
}

export interface ShareResult {
  share_token: string;
  share_url: string;
  plan_name: string;
  view_count: number;
  import_count: number;
}

export interface SharedPlan {
  token: string;
  owner: string;
  plan_name: string;
  preferences: TravelPreferences;
  recommendation: Recommendation;
  view_count?: number;
  import_count?: number;
}

export interface ShareStats {
  share_token: string;
  view_count: number;
  import_count: number;
  created_at: string;
}

export interface ImportResult {
  plan: PlanSummary;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private http: HttpClient) {}

  list(): Observable<{ plans: PlanSummary[] }> {
    return this.http.get<{ plans: PlanSummary[] }>('/api/plans');
  }

  get(id: number): Observable<{ plan: PlanDetail }> {
    return this.http.get<{ plan: PlanDetail }>(`/api/plans/${id}`);
  }

  create(
    name: string,
    preferences: TravelPreferences,
    recommendation: Recommendation
  ): Observable<{ plan: PlanSummary }> {
    return this.http.post<{ plan: PlanSummary }>('/api/plans', {
      name,
      preferences,
      recommendation
    });
  }

  update(
    id: number,
    name?: string,
    preferences?: TravelPreferences,
    recommendation?: Recommendation
  ): Observable<{ plan: PlanSummary }> {
    return this.http.put<{ plan: PlanSummary }>(`/api/plans/${id}`, {
      name,
      preferences,
      recommendation
    });
  }

  delete(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/plans/${id}`);
  }

  duplicate(id: number): Observable<{ plan: PlanSummary }> {
    return this.http.post<{ plan: PlanSummary }>(`/api/plans/${id}/duplicate`, {});
  }

  share(id: number): Observable<ShareResult> {
    return this.http.post<ShareResult>(`/api/plans/${id}/share`, {});
  }

  /** 获取分享统计（owner） */
  getShareStats(id: number): Observable<{ share: ShareStats }> {
    return this.http.get<{ share: ShareStats }>(`/api/plans/${id}/share`);
  }

  removeShare(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/plans/${id}/share`);
  }

  import(shareToken: string): Observable<ImportResult> {
    return this.http.post<ImportResult>('/api/plans/import', { share_token: shareToken });
  }

  /** 无需登录：公开读取分享方案 */
  getShared(token: string): Observable<SharedPlan> {
    return this.http.get<SharedPlan>(`/api/shared/${token}`);
  }
}
