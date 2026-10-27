import { Injectable } from '@angular/core';

/**
 * 全局弹窗滚动锁。
 *
 * 使用引用计数：lock() 计数 +1，unlock() 计数 -1。
 * 计数 > 0 时给 body 加上 .modal-locked（全局 styles.scss 中定义为 overflow:hidden）。
 * 计数回到 0 时移除。
 *
 * 避免用 JS preventDefault 拦截滚动事件——那会把弹窗内部滚动也一并杀掉。
 * 只依赖 CSS overflow:hidden，现代浏览器下 body 被锁住后弹窗内 overflow:auto 元素仍可正常滚动。
 */
@Injectable({ providedIn: 'root' })
export class ModalLockService {
  private counter = 0;
  private readonly className = 'modal-locked';

  lock(): void {
    if (typeof document === 'undefined') return; // SSR 保护
    this.counter++;
    if (this.counter === 1) {
      document.body.classList.add(this.className);
    }
  }

  unlock(): void {
    if (typeof document === 'undefined') return;
    if (this.counter <= 0) return;
    this.counter--;
    if (this.counter === 0) {
      document.body.classList.remove(this.className);
    }
  }

  /** 强制重置到 0 次（仅在 ngOnDestroy / 路由切换等极端场景使用） */
  reset(): void {
    if (typeof document === 'undefined') return;
    this.counter = 0;
    document.body.classList.remove(this.className);
  }

  /** 当前锁定的弹窗数，便于调试 */
  get activeLocks(): number {
    return this.counter;
  }
}
