import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SpotReplacementOption } from '../../models/travel.model';

/**
 * 行程中 inline 的"替换候选"面板 — 使用 PrimeNG p-button。
 */
@Component({
  selector: 'app-spot-replacement-panel',
  template: `
    <div class="replacement-panel">
      <div class="replacement-panel__header">
        <strong>替换候选</strong>
        <button pButton type="button" class="p-button-text" (click)="cancel.emit()">取消</button>
      </div>

      <p class="replacement-copy" *ngIf="notice">{{ notice }}</p>

      <div class="replacement-list" *ngIf="options.length; else noReplacementTpl">
        <button
          pButton
          type="button"
          class="replacement-item-p"
          *ngFor="let option of options"
          (click)="apply.emit(option)"
        >
          <span class="replacement-name">{{ option.name }}</span>
          <span class="replacement-meta">{{ option.category }} · ¥ {{ option.cost || '参考' }}</span>
          <span class="replacement-desc">{{ option.description }}</span>
        </button>
      </div>

      <ng-template #noReplacementTpl>
        <div class="replacement-empty">没有可替换候选，已保留当前安排。</div>
      </ng-template>
    </div>
  `
})
export class SpotReplacementPanelComponent {
  @Input() options: SpotReplacementOption[] = [];
  @Input() notice: string | null = null;

  @Output() cancel = new EventEmitter<void>();
  @Output() apply = new EventEmitter<SpotReplacementOption>();
}
