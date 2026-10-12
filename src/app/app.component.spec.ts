import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { QuestionnaireComponent } from './components/questionnaire/questionnaire.component';
import { ResultComponent } from './components/result/result.component';

const SERVER_PAYLOAD = {
  destinationName: '三亚',
  summary: '三亚 · 3 天 2 人专属行程',
  tags: ['海岛度假'],
  budgetLevel: 'comfort',
  budgetLevelLabel: '舒适型',
  estimatedTotal: 4200,
  overBudget: false,
  attractionCount: 1,
  days: [
    {
      day: 1,
      title: '第 1 天',
      focus: '海岛初体验',
      spots: [{ time: '09:00', name: '亚龙湾', category: '景点', description: '细软沙滩', cost: 0, stay: '2–3 小时', reasons: ['适合海岛度假', '沙滩细软适合放松'] }]
    }
  ],
  tips: ['注意防晒']
};

describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule, HttpClientTestingModule],
      declarations: [AppComponent, QuestionnaireComponent, ResultComponent]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should start in landing view', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.view).toEqual('landing');
  });

  it('should switch to wizard view on start', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.onStart();
    expect(app.view).toEqual('wizard');
  });

  it('should switch to result view on generate', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.onGenerate({ ...app.preferences, placeTypes: [...app.preferences.placeTypes] });
    expect(app.view).toEqual('generating');

    tick(600);
    const req = httpMock.expectOne('/api/generate');
    expect(req.request.body.startDate).toEqual(app.preferences.startDate);
    req.flush(SERVER_PAYLOAD);

    expect(app.view).toEqual('result');
    expect(app.recommendation).toBeTruthy();
    expect(app.recommendation?.destinationName).toEqual('三亚');
    expect(app.recommendation?.season).toBeTruthy();
    expect(app.generating).toBeFalse();
  }));

  it('should fall back to the local engine when the request fails', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.onGenerate({ ...app.preferences, placeTypes: [...app.preferences.placeTypes] });

    tick(600);
    httpMock.expectOne('/api/generate').error(new ProgressEvent('error'));

    expect(app.view).toEqual('result');
    expect(app.recommendation?.days.length).toEqual(app.preferences.days);
    expect(app.recommendation?.season).toBeTruthy();
  }));
});
