import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ShareResult } from '../../services/plan.service';

/**
 * 分享方案 Modal。负责展示分享链接、复制、统计浏览/导入。
 * 实际的 share 生成 / 统计刷新逻辑仍在父组件（需要 PlanService），
 * 子组件只展示 @Input 并 emit copy/close。
 */
@Component({
  selector: 'app-plan-share-dialog',
  template: `
    <div class="auth-modal-backdrop" *ngIf="open" (click)="close.emit()">
      <div class="auth-modal" (click)="$event.stopPropagation()">
        <h3 class="auth-modal-title">🔗 分享方案</h3>

        <div *ngIf="loading" class="auth-modal-loading">
          <div class="shared-spinner"></div>
          <span>正在生成分享链接…</span>
        </div>

        <ng-container *ngIf="result && !loading">
          <p class="auth-modal-sub">把下面的链接发给朋友，他们打开就能看到完整攻略，并可以保存到自己的账户里。</p>
          <div class="share-link-row">
            <input class="auth-field-input share-link-input" readonly [value]="result.share_url" />
            <button class="primary-btn" type="button" (click)="copyLink()">
              {{ copied ? '✅ 已复制' : '复制链接' }}
            </button>
          </div>
          <div class="share-stats" *ngIf="result.view_count !== undefined">
            <span class="share-stat-item">👀 <strong>{{ result.view_count }}</strong> 次浏览</span>
            <span class="share-stat-item">📥 <strong>{{ result.import_count }}</strong> 次导入</span>
            <span class="share-stat-hint">链接永久有效 · 朋友登录可一键保存 · 每 15 秒刷新</span>
          </div>
          <p class="share-link-hint" *ngIf="result.view_count === undefined">分享链接永久有效 · 朋友登录后可一键保存</p>
        </ng-container>

        <div *ngIf="error" class="auth-modal-error">{{ error }}</div>

        <div class="auth-modal-actions" *ngIf="!loading">
          <button class="ghost-btn" type="button" (click)="close.emit()">关闭</button>
        </div>
      </div>
    </div>
  `
})
export class PlanShareDialogComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() result: ShareResult | null = null;
  @Input() error: string | null = null;

  @Output() close = new EventEmitter<void>();

  copied = false;

  copyLink(): void {
    const url = this.result?.share_url;
    if (!url) return;

    const onCopied = () => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2400);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(onCopied).catch(() => this.copyFallback(url, onCopied));
    } else {
      this.copyFallback(url, onCopied);
    }
  }

  private copyFallback(text: string, onSuccess: () => void): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand('copy');
      if (ok) onSuccess();
    } catch { /* ignore */ }
    document.body.removeChild(ta);
  }
}
