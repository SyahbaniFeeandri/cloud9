/**
 * FinCloud Authentication Logic
 * Handles Login, Register, Demo Switchers, Form Validation and Session Storage.
 */

import { FinStore } from './store.js';
import { router } from './router.js';

export const AuthModule = {
  renderAuthPage(isRegister = false) {
    const container = document.getElementById('auth-container-root');
    if (!container) return;

    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-container">
          <!-- Left Hero Branding -->
          <div class="auth-hero">
            <div class="auth-hero-glow"></div>
            <div class="auth-brand">
              <div class="auth-brand-logo">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
                </svg>
              </div>
              <span class="auth-brand-name">FinCloud</span>
            </div>

            <div class="auth-hero-content">
              <div class="auth-hero-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Cloud Financial Architecture
              </div>
              <h1 class="auth-hero-title">Kelola Keuangan Cerdas dengan <span>FinCloud</span></h1>
              <p class="auth-hero-desc">
                Platform monitoring arus kas, transaksi multi-kategori, pelaporan instan, dan penyimpanan struk terintegrasi Docker & MinIO.
              </p>

              <!-- Floating Stat Previews -->
              <div class="auth-preview-cards">
                <div class="preview-stat-card">
                  <div class="preview-stat-info">
                    <h5>Arus Kas Bulan Ini</h5>
                    <p>+Rp 19.500.000</p>
                  </div>
                  <span class="trend-badge up">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    +24.8%
                  </span>
                </div>
                <div class="preview-stat-card" style="animation-delay: -3s;">
                  <div class="preview-stat-info">
                    <h5>Status Infrastruktur</h5>
                    <p style="font-size: 1.05rem; color: #10b981; display:flex; align-items:center; gap:0.4rem;">
                      <span class="pulse-dot"></span> PostgreSQL & MinIO Normal
                    </p>
                  </div>
                  <span class="brand-badge">99.98% SLA</span>
                </div>
              </div>
            </div>

            <div class="auth-hero-footer">
              <span>&copy; 2026 Cloud9 FinCloud</span>
              <span>PostgreSQL &bull; MinIO &bull; JWT Auth</span>
            </div>
          </div>

          <!-- Right Auth Form Panel -->
          <div class="auth-form-panel">
            <div class="auth-box">
              <div class="auth-box-header">
                <h2 class="auth-title">${isRegister ? 'Buat Akun Baru' : 'Selamat Datang Kembali'}</h2>
                <p class="auth-subtitle">
                  ${isRegister ? 'Daftarkan akun untuk mulai mengelola portofolio keuangan Anda' : 'Masukkan kredensial akun FinCloud Anda untuk melanjutkan'}
                </p>
              </div>

              <!-- Auth Switch Tabs -->
              <div class="auth-tabs">
                <button type="button" class="auth-tab-btn ${!isRegister ? 'active' : ''}" id="tab-login-btn">
                  Masuk
                </button>
                <button type="button" class="auth-tab-btn ${isRegister ? 'active' : ''}" id="tab-register-btn">
                  Daftar
                </button>
              </div>

              <!-- Auth Form -->
              <form id="auth-main-form" autocomplete="off">
                ${isRegister ? `
                  <div class="form-group" id="group-name">
                    <label class="form-label" for="input-auth-name">Nama Lengkap</label>
                    <div class="input-wrapper">
                      <span class="input-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </span>
                      <input type="text" id="input-auth-name" class="form-input has-left-icon" placeholder="Contoh: Feeandri" required />
                    </div>
                    <span class="form-error-msg" id="error-auth-name">Nama lengkap wajib diisi</span>
                  </div>
                ` : ''}

                <div class="form-group" id="group-email">
                  <label class="form-label" for="input-auth-email">Alamat Email</label>
                  <div class="input-wrapper">
                    <span class="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </span>
                    <input type="email" id="input-auth-email" class="form-input has-left-icon" placeholder="nama@fincloud.app" value="${isRegister ? '' : 'feeandri@fincloud.app'}" required />
                  </div>
                  <span class="form-error-msg" id="error-auth-email">Format email tidak valid</span>
                </div>

                <div class="form-group" id="group-password">
                  <div class="form-label">
                    <label for="input-auth-password">Kata Sandi</label>
                    ${!isRegister ? '<a href="javascript:void(0)" id="btn-forgot-pw" class="form-label-desc" style="color:var(--primary-400);">Lupa sandi?</a>' : ''}
                  </div>
                  <div class="input-wrapper">
                    <span class="input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                    <input type="password" id="input-auth-password" class="form-input has-left-icon has-right-action" placeholder="Min. 6 karakter" value="${isRegister ? '' : 'password123'}" required />
                    <button type="button" class="input-action" id="btn-toggle-password" title="Tampilkan/Sembunyikan">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                  <span class="form-error-msg" id="error-auth-password">Kata sandi minimal 6 karakter</span>
                </div>

                ${isRegister ? `
                  <div class="form-group" id="group-password-confirm">
                    <label class="form-label" for="input-auth-password-confirm">Konfirmasi Kata Sandi</label>
                    <div class="input-wrapper">
                      <span class="input-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </span>
                      <input type="password" id="input-auth-password-confirm" class="form-input has-left-icon" placeholder="Ulangi kata sandi Anda" required />
                    </div>
                    <span class="form-error-msg" id="error-auth-confirm">Konfirmasi kata sandi tidak cocok</span>
                  </div>
                ` : ''}

                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.85rem;" id="btn-auth-submit">
                  ${isRegister ? 'Daftar Sekarang' : 'Masuk ke Dashboard'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              </form>

              <!-- Quick Demo Credentials for Review / Demo -->
              <div class="demo-accounts">
                <div class="demo-accounts-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>
                  Demo Quick Login (1-Klik)
                </div>
                <div class="demo-btn-group">
                  <button type="button" class="demo-account-pill" id="btn-demo-user">
                    Feeandri <span>Role: USER</span>
                  </button>
                  <button type="button" class="demo-account-pill" id="btn-demo-admin">
                    Admin FinCloud <span>Role: ADMIN</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(isRegister);
  },

  bindEvents(isRegister) {
    // Switch tabs
    const tabLogin = document.getElementById('tab-login-btn');
    const tabRegister = document.getElementById('tab-register-btn');

    if (tabLogin) tabLogin.addEventListener('click', () => router.navigate('/login'));
    if (tabRegister) tabRegister.addEventListener('click', () => router.navigate('/register'));

    // Toggle password visibility
    const togglePw = document.getElementById('btn-toggle-password');
    const pwInput = document.getElementById('input-auth-password');
    if (togglePw && pwInput) {
      togglePw.addEventListener('click', () => {
        const isPw = pwInput.type === 'password';
        pwInput.type = isPw ? 'text' : 'password';
      });
    }

    // Forgot password hint
    const forgotBtn = document.getElementById('btn-forgot-pw');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        window.showToast('Fitur reset kata sandi: Silakan hubungi Administrator atau gunakan demo login.', 'info');
      });
    }

    // Demo user buttons
    const demoUser = document.getElementById('btn-demo-user');
    const demoAdmin = document.getElementById('btn-demo-admin');

    if (demoUser) {
      demoUser.addEventListener('click', () => {
        FinStore.setUser({
          id: 1,
          name: 'Feeandri',
          email: 'feeandri@fincloud.app',
          role: 'USER'
        });
        window.showToast('Login berhasil sebagai USER (Feeandri)', 'success');
        router.navigate('/dashboard');
      });
    }

    if (demoAdmin) {
      demoAdmin.addEventListener('click', () => {
        FinStore.setUser({
          id: 99,
          name: 'Administrator FinCloud',
          email: 'admin@fincloud.app',
          role: 'ADMIN'
        });
        window.showToast('Login berhasil sebagai ADMIN', 'success');
        router.navigate('/dashboard');
      });
    }

    // Form submit
    const form = document.getElementById('auth-main-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('input-auth-email').value.trim();
        const pw = document.getElementById('input-auth-password').value;

        if (isRegister) {
          const name = document.getElementById('input-auth-name').value.trim();
          const pwConfirm = document.getElementById('input-auth-password-confirm').value;

          if (!name) {
            window.showToast('Silakan isi nama Anda', 'error');
            return;
          }
          if (pw !== pwConfirm) {
            window.showToast('Konfirmasi kata sandi tidak cocok!', 'error');
            return;
          }

          FinStore.setUser({
            id: Date.now(),
            name: name,
            email: email,
            role: 'USER'
          });
          window.showToast('Registrasi berhasil! Selamat datang di FinCloud, ' + name, 'success');
          router.navigate('/dashboard');
        } else {
          // Login
          if (!email || !pw) {
            window.showToast('Silakan lengkapi email dan kata sandi', 'error');
            return;
          }
          const defaultName = email.split('@')[0];
          FinStore.setUser({
            id: 1,
            name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
            email: email,
            role: email.toLowerCase().includes('admin') ? 'ADMIN' : 'USER'
          });
          window.showToast('Login berhasil! Selamat datang kembali.', 'success');
          router.navigate('/dashboard');
        }
      });
    }
  }
};
