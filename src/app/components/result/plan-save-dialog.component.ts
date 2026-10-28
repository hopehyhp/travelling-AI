import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

/**
 * 保存方案的命名 Modal — 使用 PrimeNG p-card + p-button + pInputText。
 */
@Component({
  selector: 'app-plan-save-dialog',
  template: `
    <div class="auth-modal-backdrop" *ngIf="open" (click)="close.emit()">
      <p-card class="auth-modal-card" (click)="$event.stopPropagation()">
        <p-header>
          <h3 style="margin: 0;">💾 保存方案</h3>
          <p class="auth-modal-sub">给这份攻略起个名字，以后可以随时在你的账户里找到。</p>
        </p-header>
        <input
          pInputText
          [(ngModel)]="localName"
          maxlength="60"
          placeholder="例如：成都三天周末行"
          (keydown.enter)="onSave()"
          autofocus
        />
        <div class="auth-modal-error" *ngIf="error">{{ error }}</div>
        <div class="auth-modal-actions">
          <button pButton type="button" class="p-button-text" (click)="close.emit()">取消</button>
          <button pButton type="button" class="p-button-primary" (click)="onSave()" [disabled]="loading">
            <span [class]="{ 'pi pi-spinner pi-spin': loading }" style="margin-right: 6px;"></span>
            {{ loading ? '保存中…' : '保存到我的账户' }}
          </button>
        </div>
      </p-card>
    </div>
  `
})
export class PlanSaveDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() name = '';
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<string>();

  localName = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name']) {
      this.localName = changes['name'].currentValue ?? '';
    }
    if (changes['open'] && changes['open'].currentValue) {
      this.localName = this.name ?? '';
    }
  }

  onSave(): void {
    const trimmed = (this.localName ?? '').trim();
    if (!trimmed) return;
    this.save.emit(trimmed);
  }
}
