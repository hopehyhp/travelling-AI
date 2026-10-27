import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

/**
 * 保存方案的命名 Modal。
 * 只负责展示 UI 和发射 save/close 事件，实际保存逻辑在父组件。
 */
@Component({
  selector: 'app-plan-save-dialog',
  template: `
    <div class="auth-modal-backdrop" *ngIf="open" (click)="close.emit()">
      <div class="auth-modal" (click)="$event.stopPropagation()">
        <h3 class="auth-modal-title">💾 保存方案</h3>
        <p class="auth-modal-sub">给这份攻略起个名字，以后可以随时在你的账户里找到。</p>
        <input
          class="auth-field-input"
          [(ngModel)]="localName"
          maxlength="60"
          placeholder="例如：成都三天周末行"
          (keydown.enter)="onSave()"
          autofocus
        />
        <div class="auth-modal-error" *ngIf="error">{{ error }}</div>
        <div class="auth-modal-actions">
          <button class="ghost-btn" type="button" (click)="close.emit()">取消</button>
          <button class="primary-btn" type="button" (click)="onSave()" [disabled]="loading">
            {{ loading ? '保存中…' : '保存到我的账户' }}
          </button>
        </div>
      </div>
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
    // 每次父组件传入新 name 时同步（打开 modal、保存成功后重置等场景）
    if (changes['name']) {
      this.localName = changes['name'].currentValue ?? '';
    }
    if (changes['open'] && changes['open'].currentValue) {
      // 每次打开 modal 时也把 localName 重置为当前传入值
      this.localName = this.name ?? '';
    }
  }

  onSave(): void {
    const trimmed = (this.localName ?? '').trim();
    if (!trimmed) return; // 空值直接忽略，父组件会看到 error
    this.save.emit(trimmed);
  }
}
