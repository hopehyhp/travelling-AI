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
  view: 'landing' | 'wizard' | 'idea' | 'generating' | 'result' = 'landing';
  generating = false;
  preferences: TravelPreferences = { ...DEFAULT_PREFERENCES, placeTypes: [...DEFAULT_PREFERENCES.placeTypes] };
  recommendation: Recommendation | null = null;
  ideaDraft = '';
  ideaError = '';

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

  onIdeaStart(): void {
    this.ideaDraft = '';
    this.ideaError = '';
    this.view = 'idea';
  }

  onIdeaBack(): void {
    this.ideaDraft = '';
    this.ideaError = '';
    this.view = 'landing';
  }

  onIdeaSubmit(): void {
    const idea = this.ideaDraft.trim();

    if (!idea) {
      this.ideaError = '请填写你的旅行想法，告诉我们想去哪里、想怎么玩。';
      return;
    }

    if (idea.length > 500) {
      this.ideaError = '旅行想法最多 500 字，请精简后再提交。';
      return;
    }

    this.ideaError = '';
    this.applyPreferences({
      ...DEFAULT_PREFERENCES,
      destinationId: 'custom',
      customDestination: '',
      travelIdea: idea,
      placeTypes: [...DEFAULT_PREFERENCES.placeTypes]
    });
    this.view = 'generating';
    this.regenerate$.next(this.preferences);
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
