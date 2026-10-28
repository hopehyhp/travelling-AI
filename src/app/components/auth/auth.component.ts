import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem, Message } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { TrackingService } from '../../services/tracking.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  mode: AuthMode = 'login';
  username = '';
  password = '';
  loading = false;
  error: string | null = null;
  // p-messages 绑定的消息数组
  messages: Message[] = [];

  // p-tabMenu 菜单项
  tabItems: MenuItem[] = [
    { label: '登录', command: () => { this.mode = 'login'; this.clearError(); } },
    { label: '注册', command: () => { this.mode = 'register'; this.clearError(); } }
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private tracking: TrackingService
  ) {}

  onBack(): void {
    this.router.navigate(['/']);
  }

  clearError(): void {
    this.error = null;
    this.messages = [];
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password) return;
    this.loading = true;
    this.clearError();

    const obs = this.mode === 'login'
      ? this.auth.login(this.username.trim(), this.password)
      : this.auth.register(this.username.trim(), this.password);

    obs.subscribe({
      next: () => {
        this.loading = false;
        this.tracking.track('login_success', { mode: this.mode });
        // 回到上次页面或首页
        const redirect = history.state?.redirectUrl || '/';
        this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || '操作失败，请稍后重试';
        this.error = msg;
        this.messages = [{ severity: 'error', detail: msg }];
      }
    });
  }
}
