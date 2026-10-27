import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SpotReplacementOption } from '../../models/travel.model';

/**
 * 行程中 inline 的"替换候选"面板。
 * 显示当前要替换的景点、AI 给出的候选列表、以及选择后的回调。
 */
@Component({
  selector: 'app-spot-replacement-panel',
  template: `
    <div class="replacement-panel">
      <div class="replacement-panel__header">
        <strong>替换候选</strong>
        <button type="button" class="text-btn" (click)="cancel.emit()">取消</button>
      </div>

      <p class="replacement-copy" *ngIf="notice">{{ notice }}</p>

      <div class="replacement-list" *ngIf="options.length; else noReplacementTpl">
        <button type="button" class="replacement-item" *ngFor="let option of options" (click)="apply.emit(option)">
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
