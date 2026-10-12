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

  it('should expose the travel idea entry and a returnable input page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('我有旅行想法');
    expect(fixture.nativeElement.textContent).toContain('开始定制');

    app.onIdeaStart();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 天、2 人、情侣同行和 ¥5000');
    expect(fixture.nativeElement.querySelector('textarea').maxLength).toBe(500);

    app.onIdeaBack();
    expect(app.view).toBe('landing');
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

  it('should validate travel idea input before generation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.onIdeaStart();
    app.ideaDraft = '   ';
    app.onIdeaSubmit();
    expect(app.view).toEqual('idea');
    expect(app.ideaError).toContain('请填写');
    httpMock.expectNone('/api/generate');

    app.ideaDraft = 'a'.repeat(501);
    app.onIdeaSubmit();
    expect(app.ideaError).toContain('500');
    expect(app.view).toEqual('idea');
    httpMock.expectNone('/api/generate');
  });

  it('should send the original travel idea in the generate request payload', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.onIdeaStart();
    app.ideaDraft = '我想去三亚海岛度假，想看亚龙湾和蜈支洲岛。';
    app.onIdeaSubmit();

    expect(app.view).toEqual('generating');
    expect(app.preferences.destinationId).toEqual('custom');
    expect(app.preferences.travelIdea).toEqual('我想去三亚海岛度假，想看亚龙湾和蜈支洲岛。');
    expect(app.preferences.days).toEqual(3);
    expect(app.preferences.people).toEqual(2);
    expect(app.preferences.companion).toEqual('couple');
    expect(app.preferences.budget).toEqual(5000);

    tick(600);
    const req = httpMock.expectOne('/api/generate');
    expect(req.request.body.travelIdea).toEqual(app.preferences.travelIdea);
    req.flush({
      destinationName: '三亚',
      summary: '三亚 · 3 天 2 人专属行程',
      tags: ['海岛度假'],
      budgetLevel: 'comfort',
      budgetLevelLabel: '舒适型',
      estimatedTotal: 4200,
      overBudget: false,
      attractionCount: 1,
      days: [{ day: 1, title: '第 1 天', focus: '海岛初体验', spots: [{ time: '09:00', name: '亚龙湾', category: '海滩海岛', description: '沙滩细软适合放松', cost: 0, stay: '2–3 小时', reasons: ['适合海岛度假'] }] }],
      tips: ['注意防晒']
    });

    expect(app.view).toEqual('result');
    expect(app.recommendation?.destinationName).toEqual('三亚');
  }));

  it('should explain the limits of local fallback for a travel idea', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.onIdeaStart();
    app.ideaDraft = '我想去三亚看亚龙湾和蜈支洲岛。';
    app.onIdeaSubmit();

    tick(600);
    httpMock.expectOne('/api/generate').error(new ProgressEvent('error'));

    expect(app.view).toEqual('result');
    expect(app.recommendation?.tips[0]).toContain('我想去三亚看亚龙湾和蜈支洲岛');
    expect(app.recommendation?.tips[0]).toContain('本地兜底仅作参考');
    expect(app.recommendation?.tips[0]).toContain('不代表自由文本已被完整逐项落实');
  }));

});
