import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import {
  DEFAULT_PREFERENCES,
  Recommendation,
  TravelPreferences
} from './models/travel.model';
import { AiService } from './services/ai.service';
import { RecommendationService } from './services/recommendation.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  view: 'landing' | 'wizard' | 'generating' | 'result' = 'landing';
  generating = false;
  preferences: TravelPreferences = { ...DEFAULT_PREFERENCES, placeTypes: [...DEFAULT_PREFERENCES.placeTypes] };
  recommendation: Recommendation | null = null;

  private regenerate$ = new Subject<TravelPreferences>();
  private destroy$ = new Subject<void>();

  constructor(
    private aiService: AiService,
    private recommendationService: RecommendationService
  ) {
    this.regenerate$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        switchMap((prefs) => {
          this.generating = true;
          return this.aiService.generate(prefs);
        })
      )
      .subscribe({
        next: (rec) => {
          this.recommendation = rec;
          this.generating = false;
          if (this.view === 'generating') {
            this.view = 'result';
          }
        },
        error: () => {
          this.recommendation = this.recommendationService.generate(this.preferences);
          this.generating = false;
          if (this.view === 'generating') {
            this.view = 'result';
          }
        }
      });
  }

  ngOnInit(): void {
    // static premium travel palette, no theme switching
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onStart(): void {
    this.view = 'wizard';
  }

  onHome(): void {
    this.view = 'landing';
  }

  onGenerate(prefs: TravelPreferences): void {
    this.applyPreferences(prefs);
    this.view = 'generating';
    this.regenerate$.next(this.preferences);
  }

  onPreferencesChange(prefs: TravelPreferences): void {
    this.applyPreferences(prefs);
    this.regenerate$.next(this.preferences);
  }

  onRestart(): void {
    this.view = 'wizard';
  }

  private applyPreferences(prefs: TravelPreferences): void {
    this.preferences = { ...prefs, placeTypes: [...prefs.placeTypes] };
  }
}
