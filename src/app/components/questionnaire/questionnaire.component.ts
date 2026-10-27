import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  COMPANION_LABELS,
  COMPANION_OPTIONS,
  CompanionId,
  Destination,
  PLACE_TYPE_LABELS,
  PLACE_TYPE_OPTIONS,
  PlaceTypeId,
  PURPOSE_LABELS,
  PURPOSE_OPTIONS,
  PurposeId,
  SeasonContext,
  TravelPreferences
} from '../../models/travel.model';
import { DESTINATIONS } from '../../data/travel-data';
import { SeasonService } from '../../services/season.service';
import { TravelStateService } from '../../services/travel-state.service';

interface WizardStep {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
}

@Component({
  selector: 'app-questionnaire',
  templateUrl: './questionnaire.component.html',
  styleUrls: ['./questionnaire.component.scss']
})
export class QuestionnaireComponent implements OnInit {
  form!: TravelPreferences;
  step = 1;

  steps: WizardStep[] = [
    { key: 'destination', title: '想去哪儿？', subtitle: '选择一个目的地，或自定义', icon: '📍' },
    { key: 'companion', title: '和谁一起去？', subtitle: '不同伙伴，玩法大不同', icon: '👥' },
    { key: 'placeTypes', title: '想去什么类型的地方？', subtitle: '可多选，挑你感兴趣的', icon: '🎯' },
    { key: 'purpose', title: '这次旅行的目的是？', subtitle: '你更想要怎样的体验', icon: '💭' },
    { key: 'daysPeople', title: '出行天数和人数？', subtitle: '决定行程节奏与预算', icon: '📅' },
    { key: 'startDate', title: '计划什么时候出发？', subtitle: '结合季节与天气，安排更靠谱', icon: '🌤️' },
    { key: 'budget', title: '总预算是多少？', subtitle: '全程总花费（元）', icon: '💰' },
    { key: 'confirm', title: '确认你的选择', subtitle: '检查无误后生成专属攻略', icon: '✅' }
  ];

  constructor(
    private seasonService: SeasonService,
    private state: TravelStateService,
    private router: Router
  ) {}

  destinations = DESTINATIONS;
  companionOptions = COMPANION_OPTIONS;
  placeTypeOptions = PLACE_TYPE_OPTIONS;
  purposeOptions = PURPOSE_OPTIONS;
  companionLabels = COMPANION_LABELS;
  placeTypeLabels = PLACE_TYPE_LABELS;
  purposeLabels = PURPOSE_LABELS;

  budgetMin = 500;
  budgetMax = 100000;
  budgetStep = 500;

  destIcons: Record<string, string> = {
    chengdu: '🐼',
    beijing: '🏯',
    shanghai: '🌃',
    sanya: '🏖️',
    dali: '🏔️',
    lijiang: '🏮',
    xian: '🏺',
    hangzhou: '🛶',
    chongqing: '🌶️',
    guangzhou: '🥟',
    tokyo: '🗼',
    bangkok: '🛕'
  };

  ngOnInit(): void {
    this.form = {
      ...this.state.preferences,
      placeTypes: [...this.state.preferences.placeTypes]
    };
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get progress(): number {
    return Math.round((this.step / this.totalSteps) * 100);
  }

  get currentStep(): WizardStep {
    return this.steps[this.step - 1];
  }

  get canNext(): boolean {
    const key = this.currentStep.key;
    if (key === 'destination') {
      return this.form.destinationId !== 'custom' || this.form.customDestination.trim().length > 0;
    }
    if (key === 'placeTypes') {
      return this.form.placeTypes.length > 0;
    }
    return true;
  }

  get isCustomDestination(): boolean {
    return this.form.destinationId === 'custom';
  }

  get destinationName(): string {
    if (this.form.destinationId === 'custom') {
      return this.form.customDestination.trim() || '自定义目的地';
    }
    return DESTINATIONS.find(d => d.id === this.form.destinationId)?.name ?? '目的地';
  }

  get selectedDestination(): Destination | null {
    if (this.form.destinationId === 'custom') {
      return null;
    }
    return DESTINATIONS.find(d => d.id === this.form.destinationId) ?? null;
  }

  /** 随目的地与天数实时变化的季节/天气预览 */
  get seasonPreview(): SeasonContext {
    return this.seasonService.buildContext(this.selectedDestination, this.form);
  }

  get minDate(): string {
    return this.seasonService.todayIso();
  }

  get quickDateOptions(): { label: string; value: string }[] {
    return this.seasonService.quickDateOptions();
  }

  get startDateValue(): string {
    return this.form.startDate ?? '';
  }

  get startDateSummary(): string {
    const season = this.seasonPreview;
    if (!season.startDate) {
      return '还没定，按四季皆宜安排';
    }
    return `${season.dateLabel} · ${season.seasonIcon}${season.seasonLabel}`;
  }

  get companionLabel(): string {
    return COMPANION_LABELS[this.form.companion];
  }

  get purposeLabel(): string {
    return PURPOSE_LABELS[this.form.purpose];
  }

  get placeTypeLabel(): string {
    return this.form.placeTypes.map(t => PLACE_TYPE_LABELS[t]).join('、');
  }

  get summaryItems(): { icon: string; label: string; value: string; step: number }[] {
    return [
      { icon: '📍', label: '目的地', value: this.destinationName, step: this.stepIndex('destination') },
      { icon: '👥', label: '和谁去', value: this.companionLabel, step: this.stepIndex('companion') },
      { icon: '🎯', label: '想去类型', value: this.placeTypeLabel, step: this.stepIndex('placeTypes') },
      { icon: '💭', label: '旅行目的', value: this.purposeLabel, step: this.stepIndex('purpose') },
      { icon: '📅', label: '出行天数', value: `${this.form.days} 天`, step: this.stepIndex('daysPeople') },
      { icon: '🧑‍🤝‍🧑', label: '出行人数', value: `${this.form.people} 人`, step: this.stepIndex('daysPeople') },
      { icon: '🌤️', label: '出发日期', value: this.startDateSummary, step: this.stepIndex('startDate') },
      { icon: '💰', label: '总预算', value: `¥ ${this.form.budget.toLocaleString('zh-CN')}`, step: this.stepIndex('budget') }
    ];
  }

  stepIndex(key: string): number {
    const index = this.steps.findIndex(s => s.key === key);
    return index >= 0 ? index + 1 : 1;
  }

  setStartDate(value: string): void {
    this.form.startDate = value;
  }

  openDatePicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    }
  }

  destIcon(id: string): string {
    return this.destIcons[id] ?? '📍';
  }

  selectDestination(id: string): void {
    this.form.destinationId = id;
  }

  selectCompanion(id: CompanionId): void {
    this.form.companion = id;
  }

  selectPurpose(id: PurposeId): void {
    this.form.purpose = id;
  }

  togglePlaceType(id: PlaceTypeId): void {
    const index = this.form.placeTypes.indexOf(id);
    if (index >= 0) {
      if (this.form.placeTypes.length > 1) {
        this.form.placeTypes.splice(index, 1);
      }
    } else {
      this.form.placeTypes.push(id);
    }
  }

  decrease(field: 'days' | 'people'): void {
    this.form[field] = Math.max(1, this.form[field] - 1);
  }

  increase(field: 'days' | 'people'): void {
    const max = field === 'days' ? 15 : 20;
    this.form[field] = Math.min(max, this.form[field] + 1);
  }

  next(): void {
    if (!this.canNext) {
      return;
    }
    if (this.step < this.totalSteps) {
      this.step++;
    }
  }

  back(): void {
    if (this.step > 1) {
      this.step--;
    } else {
      this.router.navigate(['/']);
    }
  }

  goToStep(step: number): void {
    this.step = step;
  }

  submit(): void {
    if (!this.canNext || this.form.placeTypes.length === 0) {
      return;
    }
    const prefs = { ...this.form, placeTypes: [...this.form.placeTypes] };
    this.state.clearCurrentPlan();
    this.state.updateAndRegenerate(prefs);
    this.router.navigate(['/result']);
  }
}
