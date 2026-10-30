import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SpotPlan, SpotReplacementOption } from '../../models/travel.model';

/**
 * 行程中 inline 的候选面板：同时服务「换景点」与「补景点」两种模式。
 * 支持用户手动输入地点 → 确认信息与位置 → 再写入行程。
 * 使用 PrimeNG p-button；样式见全局 styles.scss 的 .replacement-* / .manual-confirm 规则。
 */
@Component({
  selector: 'app-spot-replacement-panel',
  template: `
    <div class="replacement-panel">
      <div class="replacement-panel__header">
        <strong>{{ mode === 'add' ? '补充这一天' : '替换候选' }}</strong>
        <button pButton type="button" class="p-button-text" (click)="cancel.emit()">取消</button>
      </div>

      <p class="replacement-loading" *ngIf="loading">正在{{ mode === 'add' ? '补充' : '挑选' }}候选…</p>

      <p class="replacement-copy" *ngIf="!loading && notice">{{ notice }}</p>

      <div class="replacement-list" *ngIf="options.length; else noReplacementTpl">
        <button
          pButton
          type="button"
          class="replacement-item-p"
          *ngFor="let option of options"
          (click)="apply.emit(option)"
        >
          <span class="replacement-name">{{ option.name }}</span>
          <span class="replacement-meta">
            {{ option.category }} · ¥ {{ option.cost || '参考' }}
            <ng-container *ngIf="option.bestTime"> · 建议{{ option.bestTime }}去</ng-container>
          </span>
          <span class="replacement-desc">{{ option.description }}</span>
        </button>
      </div>

      <ng-template #noReplacementTpl>
        <div class="replacement-empty" *ngIf="!loading">
          {{ mode === 'add' ? '没有合适的候选，可自己输入一个地点。' : '没有可替换候选，已保留当前安排。' }}
        </div>
      </ng-template>

      <!-- 手动输入：先确认信息与位置，再写入行程 -->
      <p class="replacement-loading" *ngIf="manualLoading">正在确认该地点的信息与位置…</p>

      <div class="replacement-manual" *ngIf="!loading && !manualLoading && allowManual && !pendingSpot">
        <input
          type="text"
          class="replacement-manual-input"
          [(ngModel)]="manualName"
          placeholder="输入景点名称，如「茅家埠」"
          (keyup.enter)="submitLookup()"
        />
        <button
          pButton
          type="button"
          class="p-button-outlined replacement-manual-btn-p"
          [disabled]="!manualName.trim()"
          (click)="submitLookup()"
        >查询</button>
      </div>

      <div class="manual-confirm" *ngIf="pendingSpot">
        <div class="manual-confirm__header">
          <strong>{{ pendingSpot.name }}</strong>
          <span class="manual-confirm__meta">
            {{ pendingSpot.category }} ·
            {{ pendingSpot.cost > 0 ? ('¥ ' + pendingSpot.cost) : '免费' }} ·
            {{ pendingSpot.stay }}
          </span>
        </div>
        <p class="manual-confirm__desc">{{ pendingSpot.description }}</p>
        <p class="manual-confirm__location" [class.is-missing]="!pendingLocationOk">
          📍 {{ pendingLocationText }}
        </p>
        <div class="manual-confirm__actions">
          <button pButton type="button" (click)="confirmManual.emit()">
            {{ mode === 'add' ? '确认添加' : '确认替换' }}
          </button>
          <button pButton type="button" class="p-button-text" (click)="discardManual.emit()">重新输入</button>
        </div>
      </div>
    </div>
  `
})
export class SpotReplacementPanelComponent {
  @Input() mode: 'replace' | 'add' = 'replace';
  @Input() options: SpotReplacementOption[] = [];
  @Input() notice: string | null = null;
  @Input() loading = false;
  @Input() allowManual = false;

  /** 手动输入的查询与确认状态由父组件维护 */
  @Input() manualLoading = false;
  @Input() pendingSpot: SpotPlan | null = null;
  @Input() pendingLocationText = '';
  @Input() pendingLocationOk = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() apply = new EventEmitter<SpotReplacementOption>();
  @Output() lookup = new EventEmitter<string>();
  @Output() confirmManual = new EventEmitter<void>();
  @Output() discardManual = new EventEmitter<void>();

  manualName = '';

  submitLookup(): void {
    const name = this.manualName.trim();
    if (!name) {
      return;
    }
    this.lookup.emit(name);
    this.manualName = '';
  }
}
