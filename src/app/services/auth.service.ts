import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface AuthUser {
  id: number;
  username: string;
  nickname?: string;
  email?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
  plan_count?: number;
  share_count?: number;
}

export interface ProfilePatch {
  nickname?: string;
  email?: string;
  bio?: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'travelling-ai.token';
const USER_KEY = 'travelling-ai.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** 唯一真相源：当前登录用户对象，null 表示未登录 */
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.loadUser());
  currentUser$ = this.currentUserSubject.asObservable();

  /** 登录态初始化是否已完成（用于个人中心等页面避免误跳转） */
  private readySubject = new BehaviorSubject<boolean>(false);
  ready$ = this.readySubject.asObservable();

  constructor(private http: HttpClient) {}

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** 页面启动时调用一次，从后端校验 token 是否还有效 */
  init(): void {
    if (!this.token) {
      this.readySubject.next(true);
      return;
    }
    this.refresh();
  }

  /** 重新拉取当前用户资料（含统计信息） */
  refresh(): void {
    if (!this.token) {
      this.readySubject.next(true);
      return;
    }
    this.http.get<{ user: AuthUser }>('/api/auth/me').pipe(
      catchError(() => {
        this.clear();
        return of(null);
      })
    ).subscribe({
      next: (res) => {
        if (res?.user) {
          this.currentUserSubject.next(res.user);
          this.saveUser(res.user);
        }
      },
      complete: () => this.readySubject.next(true),
      error: () => this.readySubject.next(true)
    });
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { username, password }).pipe(
      tap((res) => this.persist(res.token, res.user))
    );
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { username, password }).pipe(
      tap((res) => this.persist(res.token, res.user))
    );
  }

  updateProfile(patch: ProfilePatch): Observable<{ user: AuthUser }> {
    return this.http.put<{ user: AuthUser }>('/api/auth/me', patch).pipe(
      tap((res) => {
        this.currentUserSubject.next(res.user);
        this.saveUser(res.user);
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>('/api/auth/me/password', { currentPassword, newPassword });
  }

  logout(): void {
    this.clear();
  }

  /** 让 AuthInterceptor 能拿到 token（同步方法，拦截器同步读取） */
  getToken(): string | null {
    return this.token;
  }

  private persist(token: string, user: AuthUser): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
    this.currentUserSubject.next(user);
  }

  private clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
    this.currentUserSubject.next(null);
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private saveUser(user: AuthUser): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  }
}
