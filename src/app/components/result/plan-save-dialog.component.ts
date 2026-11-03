import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

/**
 * 保存方案 Modal — 使用 PrimeNG p-dialog。
 */
@Component({
  selector: 'app-plan-save-dialog',
  template: `
    <p-dialog
      [(visible)]="dialogVisible"
      header="💾 保存方案"
      [modal]="true"
      [closable]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [resizable]="false"
      [appendTo]="'body'"
      [style]="{ width: 'min(100%, 440px)' }"
      [showHeader]="true"
      [contentStyle]="{ padding: '0' }"
      (onHide)="close.emit()"
      class="app-dialog"
    >
      <p class="app-dialog__sub">给这份攻略起个名字，以后可以随时在你的账户里找到。</p>
      <input
        pInputText
        [(ngModel)]="localName"
        maxlength="60"
        placeholder="例如：成都三天周末行"
        (keydown.enter)="onSave()"
        autofocus
      />
      <div class="app-dialog__error" *ngIf="error">{{ error }}</div>
      <div class="app-dialog__actions">
        <button pButton type="button" class="p-button-text" (click)="close.emit()">取消</button>
        <button pButton type="button" class="p-button-primary" (click)="onSave()" [disabled]="loading">
          <span [class]="{ 'pi pi-spinner pi-spin': loading }" style="margin-right: 6px;"></span>
          {{ loading ? '保存中…' : '保存到我的账户' }}
        </button>
      </div>
    </p-dialog>
  `
})
export class PlanSaveDialogComponent implements OnChanges {
  dialogVisible = false;

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
    if (changes['open']) {
      this.dialogVisible = changes['open'].currentValue ?? false;
      if (this.dialogVisible) {
        this.localName = this.name ?? '';
      }
    }
  }

  onSave(): void {
    const trimmed = (this.localName ?? '').trim();
    if (!trimmed) return;
    this.save.emit(trimmed);
  }
}
