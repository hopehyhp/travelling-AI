import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, AuthUser } from '../../services/auth.service';
import { PlanService, PlanSummary } from '../../services/plan.service';
import { TravelStateService } from '../../services/travel-state.service';
import { ModalLockService } from '../../services/modal-lock.service';

type SortKey = 'updated' | 'created' | 'name';

interface ShareDialogState {
  open: boolean;
  plan: PlanSummary | null;
  loading: boolean;
  url: string;
  copied: boolean;
  error: string | null;
}

interface ImportDialogState {
  open: boolean;
  token: string;
  loading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: AuthUser | null = null;
  authReady = false;

  plans: PlanSummary[] = [];
  loadingPlans = true;
  listError: string | null = null;
  pageNotice: string | null = null;
  busyPlanId: number | null = null;

  search = '';
  sort: SortKey = 'updated';

  profileForm = { nickname: '', email: '', bio: '' };
  savingProfile = false;
  profileError: string | null = null;
  profileNotice: string | null = null;

  passwordForm = { current: '', next: '', confirm: '' };
  savingPassword = false;
  passwordError: string | null = null;
  passwordNotice: string | null = null;

  renameTarget: PlanSummary | null = null;
  renameName = '';
  renameLoading = false;
  renameError: string | null = null;

  deleteTarget: PlanSummary | null = null;
  deleteLoading = false;
  deleteError: string | null = null;

  shareDialog: ShareDialogState = { open: false, plan: null, loading: false, url: '', copied: false, error: null };
  importDialog: ImportDialogState = { open: false, token: '', loading: false, error: null };

  profileModalOpen = false;
  passwordModalOpen = false;

  private loadedOnce = false;
  private noticeTimer: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private planService: PlanService,
    private state: TravelStateService,
    private modalLock: ModalLockService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
      if (user) {
        this.profileForm = {
          nickname: user.nickname || '',
          email: user.email || '',
          bio: user.bio || ''
        };
        if (!this.loadedOnce) {
          this.loadedOnce = true;
          this.loadPlans();
        }
      }
    });

    this.auth.ready$.pipe(takeUntil(this.destroy$)).subscribe((ready) => {
      this.authReady = ready;
      if (ready && !this.auth.currentUser) {
        this.router.navigate(['/auth'], { state: { redirectUrl: '/profile' } });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.noticeTimer) {
      window.clearTimeout(this.noticeTimer);
    }
    // 保险：路由切换时如果 modal 还开着，解锁 body
    this.modalLock.reset();
  }

  get displayName(): string {
    if (!this.user) return '';
    return this.user.nickname?.trim() || this.user.username;
  }

  get avatarText(): string {
    return this.displayName.slice(0, 1).toUpperCase();
  }

  get joinedLabel(): string {
    if (!this.user?.created_at) return '—';
    return this.formatDate(this.user.created_at, true);
  }

  get sharedCount(): number {
    return this.plans.filter((p) => p.shared).length;
  }

  get visiblePlans(): PlanSummary[] {
    const keyword = this.search.trim().toLowerCase();
    const list = this.plans.filter((p) => {
      if (!keyword) return true;
      return (
        p.name.toLowerCase().includes(keyword) ||
        (p.destination || '').toLowerCase().includes(keyword)
      );
    });

    const sorted = [...list];
    if (this.sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    } else if (this.sort === 'created') {
      sorted.sort((a, b) => this.timeOf(b.created_at) - this.timeOf(a.created_at));
    } else {
      sorted.sort((a, b) => this.timeOf(b.updated_at) - this.timeOf(a.updated_at));
    }
    return sorted;
  }

  formatDate(value: string | undefined, dateOnly = false): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    if (dateOnly) {
      return date.toLocaleDateString('zh-CN');
    }
    return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  goCreate(): void {
    this.router.navigate(['/wizard']);
  }

  doLogout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  // —— 账号弹窗 ——

  openProfileModal(): void {
    if (this.user) {
      this.profileForm = {
        nickname: this.user.nickname || '',
        email: this.user.email || '',
        bio: this.user.bio || ''
      };
    }
    this.profileError = null;
    this.profileNotice = null;
    this.profileModalOpen = true;
    this.modalLock.lock();
  }

  closeProfileModal(): void {
    if (this.savingProfile) return;
    this.profileModalOpen = false;
    this.profileError = null;
    this.profileNotice = null;
    this.modalLock.unlock();
  }

  openPasswordModal(): void {
    this.passwordForm = { current: '', next: '', confirm: '' };
    this.passwordError = null;
    this.passwordNotice = null;
    this.passwordModalOpen = true;
    this.modalLock.lock();
  }

  closePasswordModal(): void {
    if (this.savingPassword) return;
    this.passwordModalOpen = false;
    this.passwordError = null;
    this.passwordNotice = null;
    this.modalLock.unlock();
  }

  // —— 方案列表 ——

  loadPlans(): void {
    this.loadingPlans = true;
    this.listError = null;
    this.planService.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.plans = res.plans || [];
        this.loadingPlans = false;
      },
      error: (err) => {
        this.loadingPlans = false;
        this.listError = err?.error?.message || '方案加载失败，请稍后重试';
      }
    });
  }

  openPlan(plan: PlanSummary): void {
    if (this.busyPlanId !== null) return;
    this.busyPlanId = plan.id;
    this.listError = null;

    this.planService.get(plan.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.busyPlanId = null;
        this.state.loadPlan(res.plan.preferences, res.plan.recommendation, res.plan.id, res.plan.name);
        this.router.navigate(['/result']);
      },
      error: (err) => {
        this.busyPlanId = null;
        this.listError = err?.error?.message || '打开方案失败，请稍后重试';
      }
    });
  }

  duplicatePlan(plan: PlanSummary): void {
    if (this.busyPlanId !== null) return;
    this.busyPlanId = plan.id;
    this.planService.duplicate(plan.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.busyPlanId = null;
        this.showNotice('已复制方案');
        this.loadPlans();
      },
      error: (err) => {
        this.busyPlanId = null;
        this.listError = err?.error?.message || '复制失败，请稍后重试';
      }
    });
  }

  // —— 重命名 ——

  openRename(plan: PlanSummary): void {
    this.renameTarget = plan;
    this.renameName = plan.name;
    this.renameError = null;
    this.modalLock.lock();
  }

  closeRename(): void {
    if (this.renameLoading) return;
    this.renameTarget = null;
    this.renameError = null;
    this.modalLock.unlock();
  }

  confirmRename(): void {
    const target = this.renameTarget;
    if (!target) return;
    const name = this.renameName.trim();
    if (!name) {
      this.renameError = '请输入方案名称';
      return;
    }
    this.renameLoading = true;
    this.renameError = null;

    this.planService.update(target.id, name).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        target.name = name;
        if (this.state.currentPlanId === target.id) {
          this.state.setCurrentPlan(target.id, name);
        }
        this.closeRename();
        this.showNotice('方案名称已更新');
      },
      error: (err) => {
        this.renameLoading = false;
        this.renameError = err?.error?.message || '重命名失败，请稍后重试';
      }
    });
  }

  // —— 删除 ——

  askDelete(plan: PlanSummary): void {
    this.deleteTarget = plan;
    this.deleteError = null;
    this.modalLock.lock();
  }

  closeDelete(): void {
    if (this.deleteLoading) return;
    this.deleteTarget = null;
    this.deleteError = null;
    this.modalLock.unlock();
  }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target) return;
    this.deleteLoading = true;
    this.deleteError = null;

    this.planService.delete(target.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.plans = this.plans.filter((p) => p.id !== target.id);
        if (this.state.currentPlanId === target.id) {
          this.state.clearCurrentPlan();
        }
        this.closeDelete();
        this.showNotice('方案已删除');
      },
      error: (err) => {
        this.deleteLoading = false;
        this.deleteError = err?.error?.message || '删除失败，请稍后重试';
      }
    });
  }

  // —— 分享 ——

  openShare(plan: PlanSummary): void {
    this.shareDialog = { open: true, plan, loading: false, url: '', copied: false, error: null };
    this.modalLock.lock();

    if (plan.shared && plan.share_token) {
      this.shareDialog.url = this.buildShareUrl(plan.share_token);
      return;
    }

    this.shareDialog.loading = true;
    this.planService.share(plan.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        plan.shared = true;
        plan.share_token = res.share_token;
        this.shareDialog.loading = false;
        this.shareDialog.url = this.buildShareUrl(res.share_token);
      },
      error: (err) => {
        this.shareDialog.loading = false;
        this.shareDialog.error = err?.error?.message || '生成分享链接失败';
      }
    });
  }

  closeShare(): void {
    if (!this.shareDialog.open) return;
    this.shareDialog = { open: false, plan: null, loading: false, url: '', copied: false, error: null };
    this.modalLock.unlock();
  }

  copyShareLink(): void {
    const url = this.shareDialog.url;
    if (!url) return;
    const onCopied = () => {
      this.shareDialog.copied = true;
      window.setTimeout(() => { this.shareDialog.copied = false; }, 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(onCopied).catch(() => this.copyFallback(url, onCopied));
    } else {
      this.copyFallback(url, onCopied);
    }
  }

  cancelShare(plan: PlanSummary): void {
    this.planService.removeShare(plan.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        plan.shared = false;
        plan.share_token = null;
        if (this.shareDialog.plan?.id === plan.id) {
          this.closeShare();
        }
        this.showNotice('已取消该方案的分享');
      },
      error: (err) => {
        this.listError = err?.error?.message || '取消分享失败，请稍后重试';
      }
    });
  }

  // —— 导入分享方案 ——

  openImport(): void {
    this.importDialog = { open: true, token: '', loading: false, error: null };
    this.modalLock.lock();
  }

  closeImport(): void {
    if (this.importDialog.loading) return;
    this.importDialog = { open: false, token: '', loading: false, error: null };
    this.modalLock.unlock();
  }

  confirmImport(): void {
    const token = this.extractToken(this.importDialog.token);
    if (!token) {
      this.importDialog.error = '请粘贴分享链接或分享码';
      return;
    }
    this.importDialog.loading = true;
    this.importDialog.error = null;

    this.planService.import(token).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadPlans();
        this.closeImport();
        this.showNotice('已导入分享方案');
      },
      error: (err) => {
        this.importDialog.loading = false;
        this.importDialog.error = err?.error?.message || '导入失败，请检查分享链接是否有效';
      }
    });
  }

  // —— 个人资料 / 密码 ——

  saveProfile(): void {
    const nickname = this.profileForm.nickname.trim();
    const email = this.profileForm.email.trim();
    const bio = this.profileForm.bio.trim();

    this.profileError = null;
    this.profileNotice = null;

    if (nickname.length > 20) {
      this.profileError = '昵称最多 20 个字符';
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.profileError = '邮箱格式不正确';
      return;
    }
    if (bio.length > 120) {
      this.profileError = '个人简介最多 120 个字符';
      return;
    }

    this.savingProfile = true;
    this.auth.updateProfile({ nickname, email, bio }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.savingProfile = false;
        this.profileNotice = '个人资料已保存';
        this.profileForm = {
          nickname: res.user.nickname || '',
          email: res.user.email || '',
          bio: res.user.bio || ''
        };
      },
      error: (err) => {
        this.savingProfile = false;
        this.profileError = err?.error?.message || '保存失败，请稍后重试';
      }
    });
  }

  changePassword(): void {
    this.passwordError = null;
    this.passwordNotice = null;

    if (!this.passwordForm.current) {
      this.passwordError = '请输入当前密码';
      return;
    }
    if (this.passwordForm.next.length < 4 || this.passwordForm.next.length > 64) {
      this.passwordError = '新密码需 4-64 位';
      return;
    }
    if (this.passwordForm.next !== this.passwordForm.confirm) {
      this.passwordError = '两次输入的新密码不一致';
      return;
    }

    this.savingPassword = true;
    this.auth.changePassword(this.passwordForm.current, this.passwordForm.next)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingPassword = false;
          this.passwordNotice = '密码已更新';
          this.passwordForm = { current: '', next: '', confirm: '' };
        },
        error: (err) => {
          this.savingPassword = false;
          this.passwordError = err?.error?.message || '密码修改失败，请稍后重试';
        }
      });
  }

  // —— 内部工具 ——

  private showNotice(message: string): void {
    this.pageNotice = message;
    if (this.noticeTimer) {
      window.clearTimeout(this.noticeTimer);
    }
    this.noticeTimer = window.setTimeout(() => { this.pageNotice = null; }, 2400);
  }

  private timeOf(value: string): number {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private buildShareUrl(token: string): string {
    return `${window.location.origin}/share/${token}`;
  }

  private extractToken(value: string): string {
    const raw = value.trim();
    if (!raw) return '';
    const shareIndex = raw.indexOf('/share/');
    if (shareIndex >= 0) {
      return raw.slice(shareIndex + '/share/'.length).split(/[?#]/)[0].trim();
    }
    return raw;
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
      if (document.execCommand('copy')) onSuccess();
    } catch {}
    document.body.removeChild(ta);
  }
}
