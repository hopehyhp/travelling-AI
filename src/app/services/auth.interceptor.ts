import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

/** 自动给需要鉴权的请求加上 Bearer token */
@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    let cloned = req;

    // 所有打到后端 /api/* 的请求都尝试带上 token（包括 auth/register 和 auth/login，
    // 虽然它们不需要，但带了也无害；interceptor 只对同源请求生效）
    if (token) {
      cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }

    return next.handle(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          // token 无效，清掉本地登录态
          this.auth.logout();
        }
        return throwError(() => err);
      })
    );
  }
}
