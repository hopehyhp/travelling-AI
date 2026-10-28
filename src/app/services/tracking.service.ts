import { Injectable, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

/** 埋点属性只允许基础类型，避免把用户隐私对象/文件塞进来 */
export type TrackProps = Record<string, string | number | boolean>;

interface QueuedEvent {
  name: string;
  props: TrackProps;
}

const MAX_BATCH = 50;
const FLUSH_DELAY = 4000;
const SESSION_KEY = 'hh_session_id';

/**
 * 轻量埋点：内存队列 + 延迟批量上报，页面隐藏/卸载时用 sendBeacon 补发。
 * 不采集任何个人身份信息（用户名、邮箱、行程名称一律不上报）。
 */
@Injectable({ providedIn: 'root' })
export class TrackingService implements OnDestroy {
  private readonly sessionId = this.resolveSessionId();
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private routeSub: Subscription;

  constructor(private router: Router) {
    // 路由级别的页面浏览统一在这里采集，避免每个页面重复写
    this.routeSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.track('page_view', { path: event.urlAfterRedirects }));

    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  track(name: string, props: TrackProps = {}): void {
    this.queue.push({ name, props });
    if (this.queue.length >= MAX_BATCH) {
      this.flush(false);
      return;
    }
    this.scheduleFlush();
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.flush(true);
  }

  private readonly onPageHide = (): void => {
    this.flush(true);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flush(true);
    }
  };

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush(false);
    }, FLUSH_DELAY);
  }

  /** 发送一批事件；useBeacon=true 用于页面即将卸载的场景 */
  private flush(useBeacon: boolean): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.queue.length) return;

    const batch = this.queue.splice(0, MAX_BATCH);
    const payload = JSON.stringify({ sessionId: this.sessionId, events: batch });

    try {
      if (useBeacon && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/events', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {
          // 埋点失败不影响业务，直接丢弃这批事件
        });
      }
    } catch (e) {
      // sendBeacon / fetch 异常同样静默处理
    }

    if (this.queue.length) {
      this.scheduleFlush();
    }
  }

  private resolveSessionId(): string {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) return cached;
      const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (e) {
      // 隐私模式下 sessionStorage 可能不可用，退化成内存态随机串
      return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}
