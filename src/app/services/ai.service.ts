import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  COMPANION_LABELS,
  Destination,
  PLACE_TYPE_LABELS,
  PURPOSE_LABELS,
  Recommendation,
  SeasonContext,
  SpotPlan,
  SpotReplacementResult,
  TravelContext,
  TravelPreferences
} from '../models/travel.model';
import { DESTINATIONS } from '../data/travel-data';
import { RecommendationService } from './recommendation.service';
import { SeasonService } from './season.service';

/** 服务端只负责行程内容，季节与天气信息由前端统一补齐 */
type ServerRecommendation = Omit<Recommendation, 'season'>;

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(
    private http: HttpClient,
    private fallback: RecommendationService,
    private seasonService: SeasonService
  ) {}

  generate(prefs: TravelPreferences): Observable<Recommendation> {
    const destination = this.resolveDestination(prefs);
    const season = this.seasonService.buildContext(destination, prefs);

    return this.http.post<ServerRecommendation>('/api/generate', this.buildBody(prefs, season, destination)).pipe(
      map((res) => ({ ...res, season })),
      catchError(() => of(this.fallback.generate(prefs)))
    );
  }

  getTravelContext(prefs: TravelPreferences): Observable<TravelContext> {
    const destinationName = this.resolveDestinationName(prefs);
    return this.http.get<TravelContext>('/api/travel-intelligence', {
      params: {
        destination: destinationName,
        startDate: prefs.startDate || ''
      }
    }).pipe(
      catchError(() => of(this.buildFallbackContext(destinationName)))
    );
  }

  replaceSpot(
    prefs: TravelPreferences,
    spot: SpotPlan,
    dayIndex: number,
    recommendation: Recommendation | null
  ): Observable<SpotReplacementResult> {
    const destination = this.resolveDestination(prefs);
    const season = this.seasonService.buildContext(destination, prefs);

    const day = recommendation?.days?.[dayIndex];
    const daySpotNames = day?.spots.map((s) => s.name) ?? [];
    const plannedSpotNames = (recommendation?.days ?? [])
      .flatMap((d) => d.spots.map((s) => s.name));

    const body = {
      destinationId: prefs.destinationId,
      destinationName: this.resolveDestinationName(prefs),
      customDestination: prefs.customDestination,
      travelIdea: (prefs.travelIdea ?? '').trim(),
      days: prefs.days,
      people: prefs.people,
      companionLabel: COMPANION_LABELS[prefs.companion],
      placeTypeLabels: prefs.placeTypes.map((t) => PLACE_TYPE_LABELS[t]),
      purposeLabel: PURPOSE_LABELS[prefs.purpose],
      budget: prefs.budget,
      dateLabel: season.dateLabel,
      seasonLabel: season.seasonLabel,
      tempLabel: season.tempLabel,
      climateNote: destination?.climate?.note ?? '',
      dayIndex,
      dayTitle: day?.title ?? '',
      dayFocus: day?.focus ?? '',
      daySpotNames,
      plannedSpotNames,
      currentSpot: {
        name: spot.name,
        category: spot.category,
        description: spot.description
      }
    };

    return this.http.post<SpotReplacementResult>('/api/replace-spot', body).pipe(
      catchError(() => of({
        currentSpotName: spot.name,
        destinationName: this.resolveDestinationName(prefs),
        message: 'AI 暂时不可用，已保留原景点。',
        candidates: []
      }))
    );
  }

  private resolveDestination(prefs: TravelPreferences): Destination | null {
    if (prefs.destinationId === 'custom') {
      return null;
    }
    return DESTINATIONS.find((d) => d.id === prefs.destinationId) ?? null;
  }

  private resolveDestinationName(prefs: TravelPreferences): string {
    if (prefs.destinationId === 'custom') {
      return prefs.customDestination.trim() || '自定义目的地';
    }
    return DESTINATIONS.find((d) => d.id === prefs.destinationId)?.name ?? '目的地';
  }

  private buildFallbackContext(destination: string): TravelContext {
    return {
      destination,
      geo: { lat: 30.5728, lng: 104.0668, displayName: destination },
      weather: {
        today: null,
        forecast: []
      },
      highlights: [],
      smartAdvice: ['当前天气信息暂不可用，仍可根据本地季节建议安排行程。']
    };
  }

  private buildBody(prefs: TravelPreferences, season: SeasonContext, destination: Destination | null) {
    const destinationName =
      prefs.destinationId === 'custom'
        ? prefs.customDestination.trim() || '自定义目的地'
        : destination?.name ?? '目的地';

    return {
      destinationId: prefs.destinationId,
      destinationName,
      customDestination: prefs.customDestination,
      travelIdea: (prefs.travelIdea ?? '').trim(),
      days: prefs.days,
      people: prefs.people,
      companion: prefs.companion,
      companionLabel: COMPANION_LABELS[prefs.companion],
      placeTypes: prefs.placeTypes,
      placeTypeLabels: prefs.placeTypes.map((t) => PLACE_TYPE_LABELS[t]),
      purpose: prefs.purpose,
      purposeLabel: PURPOSE_LABELS[prefs.purpose],
      budget: prefs.budget,
      startDate: season.startDate,
      dateLabel: season.dateLabel,
      seasonLabel: season.seasonLabel,
      tempLabel: season.tempLabel,
      climateNote: destination?.climate?.note ?? ''
    };
  }
}
