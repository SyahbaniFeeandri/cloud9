/**
 * FinCloud Main Application Controller
 * Handles global modals (Transaction Create/Edit, Receipt Preview, User Profile),
 * Theme Switching, Sidebar Navigation, Toast Notifications, and Route Synchronization.
 */

import { FinStore, CATEGORIES } from './store.js';
import { router, routes } from './router.js';
import { AuthModule } from './auth.js';
import { DashboardModule } from './dashboard.js';
import { TransactionsModule } from './transactions.js';
import { ReportsModule } from './reports.js';

class FinCloudApp {
  constructor() {
    this.currentTxEditingId = null;
    this.currentReceiptFile = null;
    this.currentReceiptDataUrl = null;
    this.currentReceiptFileObject = null;
    this.currentRemoveReceipt = false;
    this._sessionVerified = false;
    this._handlingUnauthorized = false;
  }

  init() {
    // 1. Remove data persisted by the old localStorage-only prototype.
    FinStore.clearLegacyMockData();

    // 2. Initialize Theme
    const currentTheme = FinStore.getTheme();
    FinStore.setTheme(currentTheme);

    // 3. Setup Global Helpers
    window.showToast = this.showToast.bind(this);
    window.openTransactionModal = this.openTransactionModal.bind(this);
    window.closeTransactionModal = this.closeTransactionModal.bind(this);
    window.openReceiptModal = this.openReceiptModal.bind(this);
    window.closeReceiptModal = this.closeReceiptModal.bind(this);

    // 4. Central session-expiry handler (dispatched by api.js on HTTP 401).
    window.addEventListener('fincloud:unauthorized', (event) => {
      this.handleUnauthorized(event.detail);
    });

    // 5. Setup Navigation & Layout listeners
    this.bindGlobalEvents();

    // 6. Listen to route changes
    router.onRouteChange((hash, user) => this.handleRouteChange(hash, user));

    // 7. Start router
    router.init();
  }

  handleUnauthorized(detail = {}) {
    if (this._handlingUnauthorized) return;

    this._handlingUnauthorized = true;
    this._sessionVerified = false;
    FinStore.clearSession();

    const message = detail.message === 'Invalid or expired token'
      ? 'Sesi Anda telah berakhir. Silakan login kembali.'
      : detail.message || 'Sesi Anda telah berakhir. Silakan login kembali.';

    this.showToast(message, 'error');
    router.navigate('/login');

    setTimeout(() => {
      this._handlingUnauthorized = false;
    }, 1200);
  }

  async handleRouteChange(hash, user) {
    const authRoot = document.getElementById('auth-container-root');
    const dashboardRoot = document.getElementById('dashboard-app-root');

    // Route is Auth (Login or Register)
    if (hash === '/login' || hash === '/register') {
      if (dashboardRoot) dashboardRoot.style.display = 'none';
      if (authRoot) {
        authRoot.style.display = 'block';
        AuthModule.renderAuthPage(hash === '/register');
      }
      return;
    }

    // Route is Authenticated Workspace
    if (!FinStore.isAuthenticated()) {
      router.navigate('/login');
      return;
    }

    if (authRoot) authRoot.style.display = 'none';
    if (dashboardRoot) dashboardRoot.style.display = 'flex';

    // Update user profile in sidebar & topbar
    this.updateUserBadge(user);

    // Update active nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      const targetHash = el.getAttribute('data-route');
      if (targetHash === hash) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update Header Page Title
    const headerTitle = document.getElementById('top-page-title');
    const headerSubtitle = document.getElementById('top-page-subtitle');
    if (headerTitle) {
      if (hash === '/dashboard') {
        headerTitle.textContent = 'Dashboard Finansial';
        if (headerSubtitle) headerSubtitle.textContent = 'Ringkasan arus kas, saldo, dan status sistem';
      } else if (hash === '/transactions') {
        headerTitle.textContent = 'Kelola Transaksi';
        if (headerSubtitle) headerSubtitle.textContent = 'Pencatatan pendapatan, beban biaya, dan struk belanja';
      } else if (hash === '/reports') {
        headerTitle.textContent = 'Laporan Keuangan';
        if (headerSubtitle) headerSubtitle.textContent = 'Analisis berkala, rekapitulasi kategori, dan ekspor data';
      } else if (hash === '/profile') {
        headerTitle.textContent = 'Profil Pengguna';
        if (headerSubtitle) headerSubtitle.textContent = 'Pengaturan akun dan keamanan';
      }
    }

    // Scroll to top of content
    const mainEl = document.querySelector('.main-content');
    if (mainEl) mainEl.scrollTop = 0;

    this.showViewLoading();

    try {
      // Validate the token against the backend once per page load.
      if (!this._sessionVerified) {
        await FinStore.verifySession();
        this._sessionVerified = true;
        this.updateUserBadge(FinStore.getUser());
      }

      if (hash === '/dashboard') {
        await DashboardModule.render();
      } else if (hash === '/transactions') {
        await TransactionsModule.render();
      } else if (hash === '/reports') {
        await ReportsModule.render();
      } else if (hash === '/profile') {
        await this.renderProfilePage();
      }
    } catch (error) {
      if (error?.status === 401) return; // handled by fincloud:unauthorized

      console.error('Route render error:', error);
      this.renderLoadError(error);
    }
  }

  showViewLoading() {
    const container = document.getElementById('view-content');
    if (!container) return;

    container.innerHTML = `
      <div class="view-loading">
        <div class="loading-spinner"></div>
        <p>Memuat data dari server FinCloud...</p>
      </div>
    `;
  }

  renderLoadError(error) {
    const container = document.getElementById('view-content');
    if (!container) return;

    const message = error?.message || 'Terjadi kesalahan saat memuat data.';

    container.innerHTML = `
      <div class="view-error">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h4 class="empty-state-title">Gagal memuat data</h4>
        <p class="empty-state-desc">${message}</p>
        <button class="btn btn-primary" id="btn-retry-view" style="margin-top:1rem;">Coba Lagi</button>
      </div>
    `;

    const retryBtn = document.getElementById('btn-retry-view');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => router.handleRouting());
    }
  }

  async refreshCurrentView() {
    try {
      if (router.currentRoute === '/dashboard') {
        await DashboardModule.render();
      } else if (router.currentRoute === '/transactions') {
        await TransactionsModule.render();
      } else if (router.currentRoute === '/reports') {
        await ReportsModule.render();
      }
    } catch (error) {
      if (error?.status !== 401) {
        this.showToast(error.message || 'Gagal memperbarui tampilan', 'error');
      }
    }
  }

  updateUserBadge(user) {
    if (!user) return;
    const nameEls = document.querySelectorAll('.user-display-name');
    const roleEls = document.querySelectorAll('.user-display-role');
    const avatarEls = document.querySelectorAll('.user-avatar');

    nameEls.forEach(el => el.textContent = user.name || 'Pengguna');
    roleEls.forEach(el => el.textContent = user.role || 'USER');
    avatarEls.forEach(el => {
      const initial = (user.name || 'F').charAt(0).toUpperCase();
      el.textContent = initial;
    });
  }

  bindGlobalEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = FinStore.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        FinStore.setTheme(next);
        this.updateThemeButtonIcon(next);
        // re-render charts to update contrast if on dashboard
        if (router.currentRoute === '/dashboard') {
          DashboardModule.render().catch((error) => {
            if (error?.status !== 401) {
              this.showToast(error.message || 'Gagal memperbarui grafik', 'error');
            }
          });
        }
      });
      this.updateThemeButtonIcon(FinStore.getTheme());
    }

    // Mobile sidebar toggle
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.querySelector('.sidebar');
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Close sidebar on clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // Sidebar navigation clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = e.currentTarget.getAttribute('data-route');
        if (route) {
          router.navigate(route);
          if (sidebar) sidebar.classList.remove('open');
        }
      });
    });

    // Logout
    const logoutBtn = document.getElementById('btn-sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        await FinStore.logout();
        this._sessionVerified = false;
        this.showToast('Anda telah keluar dari FinCloud', 'info');
        router.navigate('/login');
        logoutBtn.disabled = false;
      });
    }

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTransactionModal();
        this.closeReceiptModal();
      }
    });

    // Header quick add button
    const headerQuickAddBtn = document.getElementById('btn-header-quick-add');
    if (headerQuickAddBtn) {
      headerQuickAddBtn.addEventListener('click', () => this.openTransactionModal());
    }

    // Receipt viewer bottom close button
    const closeReceiptBottomBtn = document.getElementById('btn-close-receipt-bottom');
    if (closeReceiptBottomBtn) {
      closeReceiptBottomBtn.addEventListener('click', () => this.closeReceiptModal());
    }

    // Transaction Modal Submit & Setup
    this.setupTransactionModalEvents();
  }

  updateThemeButtonIcon(theme) {
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (!themeBtn) return;
    if (theme === 'light') {
      themeBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
      `;
      themeBtn.title = 'Beralih ke Mode Gelap';
    } else {
      themeBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path><path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path><path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      `;
      themeBtn.title = 'Beralih ke Mode Terang';
    }
  }

  /* Modal Management */
  openTransactionModal(txData = null) {
    const modal = document.getElementById('modal-transaction');
    if (!modal) return;

    this.currentTxEditingId = txData ? txData.id : null;
    this.currentReceiptDataUrl = txData ? txData.receipt : null;
    this.currentReceiptFile = txData ? txData.receiptName : null;
    this.currentReceiptFileObject = null;
    this.currentRemoveReceipt = false;

    const modalTitle = document.getElementById('modal-tx-title');
    const typeBtnIncome = document.getElementById('modal-toggle-income');
    const typeBtnExpense = document.getElementById('modal-toggle-expense');
    const amountInput = document.getElementById('modal-input-amount');
    const descInput = document.getElementById('modal-input-desc');
    const dateInput = document.getElementById('modal-input-date');
    const dropzoneContent = document.getElementById('modal-dropzone-content');

    if (modalTitle) {
      modalTitle.textContent = txData ? 'Ubah Transaksi' : 'Catat Transaksi Baru';
    }

    const currentType = txData ? txData.type : 'expense';
    this.setModalType(currentType);

    if (amountInput) amountInput.value = txData ? txData.amount : '';
    if (descInput) descInput.value = txData ? txData.description : '';
    if (dateInput) {
      dateInput.value = txData ? txData.date : new Date().toISOString().split('T')[0];
    }

    // Populate category dropdown
    this.populateModalCategories(currentType, txData ? txData.category : null);

    // Populate receipt preview
    this.updateModalReceiptPreview();

    modal.classList.add('active');
  }

  closeTransactionModal() {
    const modal = document.getElementById('modal-transaction');
    if (modal) modal.classList.remove('active');
    this.currentTxEditingId = null;
    this.currentReceiptFile = null;
    this.currentReceiptDataUrl = null;
    this.currentReceiptFileObject = null;
    this.currentRemoveReceipt = false;
  }

  setModalType(type) {
    const incBtn = document.getElementById('modal-toggle-income');
    const expBtn = document.getElementById('modal-toggle-expense');
    if (type === 'income') {
      incBtn.classList.add('active', 'income');
      expBtn.classList.remove('active', 'expense');
    } else {
      expBtn.classList.add('active', 'expense');
      incBtn.classList.remove('active', 'income');
    }
    this.populateModalCategories(type);
  }

  populateModalCategories(type, selectedCategory = null) {
    const select = document.getElementById('modal-select-category');
    if (!select) return;

    const list = CATEGORIES[type] || CATEGORIES.expense;
    select.innerHTML = list.map(c => `
      <option value="${c.name}" ${selectedCategory === c.name ? 'selected' : ''}>
        ${c.name}
      </option>
    `).join('');
  }

  updateModalReceiptPreview() {
    const dropzoneContent = document.getElementById('modal-dropzone-content');
    if (!dropzoneContent) return;

    if (this.currentReceiptDataUrl) {
      const isPdf = /\.pdf$/i.test(this.currentReceiptFile || '') ||
        /\.pdf(?:$|[?#])/i.test(String(this.currentReceiptDataUrl)) ||
        String(this.currentReceiptDataUrl).startsWith('data:application/pdf');

      const thumb = isPdf
        ? `<div style="width:50px; height:50px; display:flex; align-items:center; justify-content:center; border-radius:6px; border:1px solid var(--border-color); background:rgba(244,63,94,0.1); color:var(--expense-500); font-size:0.7rem; font-weight:700;">PDF</div>`
        : `<img src="${this.currentReceiptDataUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);" />`;

      dropzoneContent.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; width:100%;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            ${thumb}
            <div style="text-align:left;">
              <div style="font-size:0.85rem; font-weight:600;">${this.currentReceiptFile || 'struk-terlampir.jpg'}</div>
              <div style="font-size:0.72rem; color:var(--income-500);">Tersimpan di Cloud Storage (MinIO)</div>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-outline" id="btn-remove-receipt" style="color:var(--expense-500);">Hapus</button>
        </div>
      `;

      const removeBtn = document.getElementById('btn-remove-receipt');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentReceiptDataUrl = null;
          this.currentReceiptFile = null;
          this.currentReceiptFileObject = null;
          this.currentRemoveReceipt = true;
          this.updateModalReceiptPreview();
        });
      }
    } else {
      dropzoneContent.innerHTML = `
        <div class="dropzone-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <p class="dropzone-text">Pilih atau Seret Bukti Struk ke Sini</p>
        <p class="dropzone-subtext">JPG, PNG, atau PDF (Disimpan via MinIO Bucket)</p>
      `;
    }
  }

  handleReceiptFile(file) {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      this.showToast('Format struk harus JPG, PNG, WEBP, atau PDF', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showToast('Ukuran struk maksimal 10 MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      this.currentReceiptDataUrl = event.target.result;
      this.currentReceiptFile = file.name;
      this.currentReceiptFileObject = file;
      this.currentRemoveReceipt = false;
      this.updateModalReceiptPreview();
    };
    reader.readAsDataURL(file);
  }

  setupTransactionModalEvents() {
    const modal = document.getElementById('modal-transaction');
    const closeBtn = document.getElementById('btn-close-modal-tx');
    const cancelBtn = document.getElementById('btn-cancel-modal-tx');
    const typeIncome = document.getElementById('modal-toggle-income');
    const typeExpense = document.getElementById('modal-toggle-expense');
    const dropzone = document.getElementById('modal-receipt-dropzone');
    const fileInput = document.getElementById('modal-receipt-file-input');
    const form = document.getElementById('form-modal-transaction');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeTransactionModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeTransactionModal());

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeTransactionModal();
      });
    }

    if (typeIncome) {
      typeIncome.addEventListener('click', () => this.setModalType('income'));
    }
    if (typeExpense) {
      typeExpense.addEventListener('click', () => this.setModalType('expense'));
    }

    // Dropzone upload
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        this.handleReceiptFile(file);
        fileInput.value = '';
      });

      // Drag & drop
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleReceiptFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isIncome = typeIncome.classList.contains('active');
        const amount = parseFloat(document.getElementById('modal-input-amount').value);
        const category = document.getElementById('modal-select-category').value;
        const description = document.getElementById('modal-input-desc').value.trim();
        const date = document.getElementById('modal-input-date').value;

        if (!amount || isNaN(amount) || amount <= 0) {
          this.showToast('Nominal transaksi harus lebih besar dari 0', 'error');
          return;
        }

        if (!description) {
          this.showToast('Silakan isi keterangan transaksi', 'error');
          return;
        }

        const payload = {
          type: isIncome ? 'income' : 'expense',
          amount,
          category,
          description,
          date,
          receiptFile: this.currentReceiptFileObject,
          removeReceipt: this.currentRemoveReceipt
        };

        const saveBtn = document.getElementById('btn-save-modal-tx');
        const originalText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Menyimpan...';
        }

        try {
          let result;
          if (this.currentTxEditingId) {
            result = await FinStore.updateTransaction(this.currentTxEditingId, payload);
            this.showToast('Transaksi berhasil diperbarui!', 'success');
          } else {
            result = await FinStore.addTransaction(payload);
            this.showToast('Transaksi baru berhasil disimpan!', 'success');
          }

          if (result?.receiptError) {
            this.showToast(`Struk gagal diunggah: ${result.receiptError}`, 'error');
          }

          this.closeTransactionModal();
          await this.refreshCurrentView();
        } catch (error) {
          if (error?.status !== 401) {
            this.showToast(error.message || 'Gagal menyimpan transaksi', 'error');
          }
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
          }
        }
      });
    }
  }

  /* Receipt Viewer Modal */
  openReceiptModal(tx) {
    const modal = document.getElementById('modal-receipt-viewer');
    if (!modal) return;

    const previewBox = modal.querySelector('.receipt-preview-box');
    const title = document.getElementById('receipt-viewer-title');
    const fileLabel = document.getElementById('receipt-viewer-filename');
    const downloadBtn = document.getElementById('btn-receipt-download');

    let receiptUrl = tx.receipt;
    let retried = false;
    const isPdf = /\.pdf(?:$|[?#])/i.test(receiptUrl || '') ||
      /\.pdf$/i.test(tx.receiptName || '');

    const bindDownload = (url) => {
      if (!downloadBtn) return;
      downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = url;
        link.download = tx.receiptName || 'struk-fincloud.jpg';
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
      };
    };

    // Presigned URLs expire; ask the API for a fresh one and swap the source.
    const refreshUrl = async () => {
      if (!tx.id) return;
      try {
        const fresh = await FinStore.refreshReceiptUrl(tx.id);
        if (!fresh) return;
        receiptUrl = fresh;
        const image = previewBox?.querySelector('img');
        if (image) image.src = fresh;
        const frame = previewBox?.querySelector('iframe');
        if (frame) frame.src = fresh;
        bindDownload(fresh);
      } catch {
        // Keep the existing URL; the viewer still shows the last known value.
      }
    };

    // Rebuild the preview so switching between images and PDFs works.
    if (previewBox) {
      previewBox.replaceChildren();

      if (isPdf) {
        const frame = document.createElement('iframe');
        frame.src = receiptUrl;
        frame.title = `Struk ${tx.description || ''}`;
        frame.style.cssText = 'width:100%; height:420px; border:0; border-radius:8px; background:#fff;';
        previewBox.appendChild(frame);
      } else {
        const image = document.createElement('img');
        image.id = 'receipt-viewer-img';
        image.className = 'receipt-preview-img';
        image.alt = 'Bukti Struk Transaksi FinCloud';
        image.src = receiptUrl;
        image.onerror = () => {
          if (retried) return;
          retried = true;
          refreshUrl();
        };
        previewBox.appendChild(image);
      }
    }

    if (title) title.textContent = `Bukti: ${tx.description}`;
    if (fileLabel) fileLabel.textContent = tx.receiptName || 'struk-transaksi.jpg';
    bindDownload(receiptUrl);

    // Always refresh proactively: the cached URL may already be close to expiry.
    refreshUrl();

    modal.classList.add('active');

    const closeBtn = document.getElementById('btn-close-receipt-viewer');
    if (closeBtn) closeBtn.onclick = () => this.closeReceiptModal();
    modal.onclick = (e) => {
      if (e.target === modal) this.closeReceiptModal();
    };
  }

  closeReceiptModal() {
    const modal = document.getElementById('modal-receipt-viewer');
    if (modal) modal.classList.remove('active');
  }

  /* Profile Page */
  async renderProfilePage() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const user = FinStore.getUser() || { name: '-', email: '-', role: 'USER' };

    let health = null;
    let adminStatus = null;
    try {
      const result = await FinStore.loadSystemHealth();
      health = result.health;
      adminStatus = result.adminStatus;
    } catch (error) {
      health = null;
    }

    const dbConnected = Boolean(health?.database?.connected);
    const apiUp = health?.status === 'UP';
    const storageConnected = Boolean(health?.storage?.connected);
    const storageStatus = storageConnected ? 'Terhubung' : 'Tidak Terhubung';

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 800px; margin: 0 auto;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Informasi Akun</h3>
            <span class="badge badge-primary">Role: ${user.role}</span>
          </div>

          <form id="profile-form">
            <div class="form-group">
              <label class="form-label">Nama Lengkap</label>
              <input type="text" class="form-input" id="profile-name" value="${user.name || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Alamat Email</label>
              <input type="email" class="form-input" id="profile-email" value="${user.email || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Role Akses (RBAC)</label>
              <select class="form-select" id="profile-role" disabled>
                <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>USER (Pengguna Biasa)</option>
                <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN (Pengelola Sistem)</option>
              </select>
              <span class="form-label-desc">Role hanya dapat diubah oleh Administrator melalui panel admin.</span>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 1rem;" id="btn-save-profile">Simpan Perubahan</button>
          </form>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Status Layanan FinCloud</h3>
            <span class="badge ${apiUp ? 'badge-income' : 'badge-expense'}">${apiUp ? 'Sehat' : 'Tidak Terhubung'}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-subtle);">
              <span style="color:var(--text-muted);">Backend REST API</span>
              <span style="color:${apiUp ? 'var(--income-500)' : 'var(--expense-500)'}; font-weight:600;">${apiUp ? 'Online' : 'Offline'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-subtle);">
              <span style="color:var(--text-muted);">Database MariaDB</span>
              <span style="color:${dbConnected ? 'var(--income-500)' : 'var(--expense-500)'}; font-weight:600;">${dbConnected ? 'Terhubung' : 'Tidak Terhubung'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-subtle);">
              <span style="color:var(--text-muted);">Object Storage MinIO</span>
              <span style="color:${storageConnected ? 'var(--income-500)' : 'var(--expense-500)'}; font-weight:600;">${storageStatus}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0;">
              <span style="color:var(--text-muted);">Monitoring Prometheus & Grafana</span>
              <span style="color:var(--accent-cyan); font-weight:600;">${adminStatus ? 'Metrics Exporter Aktif' : 'Khusus Administrator'}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('profile-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updatedName = document.getElementById('profile-name').value.trim();
        const updatedEmail = document.getElementById('profile-email').value.trim();
        const saveBtn = document.getElementById('btn-save-profile');

        if (!updatedName || !updatedEmail) {
          this.showToast('Nama dan email wajib diisi', 'error');
          return;
        }

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Menyimpan...';
        }

        try {
          await FinStore.updateProfile({ name: updatedName, email: updatedEmail });
          this.updateUserBadge(FinStore.getUser());
          this.showToast('Profil berhasil diperbarui!', 'success');
        } catch (error) {
          if (error?.status !== 401) {
            this.showToast(error.message || 'Gagal memperbarui profil', 'error');
          }
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Simpan Perubahan';
          }
        }
      });
    }
  }

  /* Toast Notification */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <div style="flex:1; font-size:0.88rem; font-weight:500;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }
}

// Instantiate and start app
document.addEventListener('DOMContentLoaded', () => {
  const app = new FinCloudApp();
  app.init();
});
