import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { AiService } from './services/ai.service';
import { AuthService, AuthUser } from './services/auth.service';
import { RecommendationService } from './services/recommendation.service';
import { TrackingService } from './services/tracking.service';
import { TravelStateService } from './services/travel-state.service';
import { DEFAULT_PREFERENCES, Recommendation, TravelPreferences } from './models/travel.model';

function makeRecommendation(): Recommendation {
  return {
    destinationName: '三亚',
    summary: '三亚 · 3 天 2 人专属行程',
    tags: ['海岛度假'],
    budgetLevel: 'comfort',
    budgetLevelLabel: '舒适型',
    estimatedTotal: 4200,
    overBudget: false,
    attractionCount: 1,
    days: [],
    tips: ['注意防晒']
  } as unknown as Recommendation;
}

function makePrefs(): TravelPreferences {
  return { ...DEFAULT_PREFERENCES, placeTypes: [...DEFAULT_PREFERENCES.placeTypes] };
}

describe('AppComponent', () => {
  let regenerate$: Subject<TravelPreferences>;
  let recommendation$: BehaviorSubject<Recommendation | null>;
  let routerSpy: { url: string; navigate: jasmine.Spy };
  let authSpy: { init: jasmine.Spy; logout: jasmine.Spy; currentUser$: BehaviorSubject<AuthUser | null> };
  let aiSpy: { generate: jasmine.Spy };
  let recommendationSpy: { generate: jasmine.Spy };
  let stateStub: {
    regenerate$: Subject<TravelPreferences>;
    preferences: TravelPreferences;
    recommendationChanges: () => BehaviorSubject<Recommendation | null>;
    setRecommendation: jasmine.Spy;
    restore: jasmine.Spy;
  };
  let trackingSpy: { track: jasmine.Spy };

  beforeEach(() => {
    regenerate$ = new Subject<TravelPreferences>();
    recommendation$ = new BehaviorSubject<Recommendation | null>(null);
    routerSpy = { url: '/', navigate: jasmine.createSpy('navigate') };
    authSpy = {
      init: jasmine.createSpy('init'),
      logout: jasmine.createSpy('logout'),
      currentUser$: new BehaviorSubject<AuthUser | null>(null)
    };
    aiSpy = { generate: jasmine.createSpy('generate').and.returnValue(of(makeRecommendation())) };
    recommendationSpy = { generate: jasmine.createSpy('generate').and.returnValue(makeRecommendation()) };
    stateStub = {
      regenerate$,
      preferences: makePrefs(),
      recommendationChanges: () => recommendation$,
      setRecommendation: jasmine.createSpy('setRecommendation'),
      restore: jasmine.createSpy('restore').and.returnValue(false)
    };
    trackingSpy = { track: jasmine.createSpy('track') };

    TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: AiService, useValue: aiSpy },
        { provide: RecommendationService, useValue: recommendationSpy },
        { provide: TravelStateService, useValue: stateStub },
        { provide: TrackingService, useValue: trackingSpy }
      ]
    });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should init auth and restore saved plan on init', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(authSpy.init).toHaveBeenCalled();
    expect(stateStub.restore).toHaveBeenCalled();
  });

  it('should generate via AI on regenerate and navigate to /result', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    regenerate$.next(makePrefs());
    expect(aiSpy.generate).not.toHaveBeenCalled();

    tick(500);
    expect(aiSpy.generate).toHaveBeenCalled();
    expect(stateStub.setRecommendation).toHaveBeenCalled();
    expect(app.isGenerating).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/result']);
    expect(trackingSpy.track).toHaveBeenCalledWith('generate_success', jasmine.any(Object));
  }));

  it('should not navigate when already on /result', fakeAsync(() => {
    routerSpy.url = '/result';
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    regenerate$.next(makePrefs());
    tick(500);

    expect(stateStub.setRecommendation).toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));

  it('should fall back to the local engine when AI generate fails', fakeAsync(() => {
    aiSpy.generate.and.returnValue(throwError(() => new Error('network')));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    regenerate$.next(makePrefs());
    tick(500);

    expect(recommendationSpy.generate).toHaveBeenCalledWith(stateStub.preferences);
    expect(stateStub.setRecommendation).toHaveBeenCalled();
    expect(app.isGenerating).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/result']);
    expect(trackingSpy.track).toHaveBeenCalledWith('generate_fallback', jasmine.any(Object));
  }));

  it('should track hasRecommendation from state changes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.hasRecommendation).toBeFalse();

    recommendation$.next(makeRecommendation());
    expect(app.hasRecommendation).toBeTrue();

    recommendation$.next(null);
    expect(app.hasRecommendation).toBeFalse();
  });

  it('should derive user label and initial', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.userLabel({ id: 1, username: 'traveller' })).toBe('traveller');
    expect(app.userLabel({ id: 1, username: 'traveller', nickname: ' 小呼 ' })).toBe('小呼');
    expect(app.userInitial({ id: 1, username: 'traveller' })).toBe('T');
  });

  it('should navigate to /auth with redirectUrl on goAuth', () => {
    routerSpy.url = '/wizard';
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.goAuth();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth'], { state: { redirectUrl: '/wizard' } });
  });

  it('should logout and navigate home on doLogout', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.doLogout();
    expect(authSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
  });
});
