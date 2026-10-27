import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  constructor(private auth: AuthService, private router: Router) {}

  onBack(): void {
    this.router.navigate(['/']);
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password) return;
    this.loading = true;
    this.error = null;

    const obs = this.mode === 'login'
      ? this.auth.login(this.username.trim(), this.password)
      : this.auth.register(this.username.trim(), this.password);

    obs.subscribe({
      next: () => {
        this.loading = false;
        // 回到上次页面或首页
        const redirect = history.state?.redirectUrl || '/';
        this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || '操作失败，请稍后重试';
        this.error = msg;
      }
    });
  }
}
