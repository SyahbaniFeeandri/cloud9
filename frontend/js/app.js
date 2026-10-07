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
  }

  init() {
    // 1. Initialize Theme
    const currentTheme = FinStore.getTheme();
    FinStore.setTheme(currentTheme);

    // 2. Setup Global Helpers
    window.showToast = this.showToast.bind(this);
    window.openTransactionModal = this.openTransactionModal.bind(this);
    window.closeTransactionModal = this.closeTransactionModal.bind(this);
    window.openReceiptModal = this.openReceiptModal.bind(this);
    window.closeReceiptModal = this.closeReceiptModal.bind(this);

    // 3. Setup Navigation & Layout listeners
    this.bindGlobalEvents();

    // 4. Listen to route changes
    router.onRouteChange((hash, user) => this.handleRouteChange(hash, user));

    // 5. Start router
    router.init();
  }

  handleRouteChange(hash, user) {
    const appContainer = document.getElementById('app');
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

    // Render corresponding view
    if (hash === '/dashboard') {
      DashboardModule.render();
    } else if (hash === '/transactions') {
      TransactionsModule.render();
    } else if (hash === '/reports') {
      ReportsModule.render();
    } else if (hash === '/profile') {
      this.renderProfilePage();
    }

    // Scroll to top of content
    const mainEl = document.querySelector('.main-content');
    if (mainEl) mainEl.scrollTop = 0;
  }

  updateUserBadge(user) {
    if (!user) return;
    const nameEls = document.querySelectorAll('.user-display-name');
    const roleEls = document.querySelectorAll('.user-display-role');
    const avatarEls = document.querySelectorAll('.user-avatar');

    nameEls.forEach(el => el.textContent = user.name || 'Feeandri');
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
          DashboardModule.render();
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
      logoutBtn.addEventListener('click', () => {
        FinStore.logout();
        this.showToast('Anda telah keluar dari FinCloud', 'info');
        router.navigate('/login');
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
      dropzoneContent.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; width:100%;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${this.currentReceiptDataUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);" />
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

    // Dropzone upload simulation
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.currentReceiptDataUrl = event.target.result;
            this.currentReceiptFile = file.name;
            this.updateModalReceiptPreview();
          };
          reader.readAsDataURL(file);
        }
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
          const file = e.dataTransfer.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
            this.currentReceiptDataUrl = event.target.result;
            this.currentReceiptFile = file.name;
            this.updateModalReceiptPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', (e) => {
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
          receipt: this.currentReceiptDataUrl,
          receiptName: this.currentReceiptFile
        };

        if (this.currentTxEditingId) {
          FinStore.updateTransaction(this.currentTxEditingId, payload);
          this.showToast('Transaksi berhasil diperbarui!', 'success');
        } else {
          FinStore.addTransaction(payload);
          this.showToast('Transaksi baru berhasil disimpan!', 'success');
        }

        this.closeTransactionModal();

        // Refresh current active view
        if (router.currentRoute === '/dashboard') {
          DashboardModule.render();
        } else if (router.currentRoute === '/transactions') {
          TransactionsModule.render();
        } else if (router.currentRoute === '/reports') {
          ReportsModule.render();
        }
      });
    }
  }

  /* Receipt Viewer Modal */
  openReceiptModal(tx) {
    const modal = document.getElementById('modal-receipt-viewer');
    if (!modal) return;

    const img = document.getElementById('receipt-viewer-img');
    const title = document.getElementById('receipt-viewer-title');
    const fileLabel = document.getElementById('receipt-viewer-filename');
    const downloadBtn = document.getElementById('btn-receipt-download');

    if (img) img.src = tx.receipt;
    if (title) title.textContent = `Bukti: ${tx.description}`;
    if (fileLabel) fileLabel.textContent = tx.receiptName || 'struk-transaksi.jpg';

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = tx.receipt;
        link.download = tx.receiptName || 'struk-fincloud.jpg';
        link.target = '_blank';
        link.click();
      };
    }

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
  renderProfilePage() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const user = FinStore.getUser();

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
              <input type="text" class="form-input" id="profile-name" value="${user.name}" />
            </div>

            <div class="form-group">
              <label class="form-label">Alamat Email</label>
              <input type="email" class="form-input" id="profile-email" value="${user.email}" />
            </div>

            <div class="form-group">
              <label class="form-label">Role Akses (RBAC)</label>
              <select class="form-select" id="profile-role">
                <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>USER (Pengguna Biasa)</option>
                <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN (Pengelola Sistem)</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">Simpan Perubahan</button>
          </form>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Status Layanan FinCloud</h3>
            <span class="badge badge-income">Sehat</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-subtle);">
              <span style="color:var(--text-muted);">Database PostgreSQL</span>
              <span style="color:var(--income-500); font-weight:600;">Terhubung (Port 5432)</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-subtle);">
              <span style="color:var(--text-muted);">Object Storage MinIO</span>
              <span style="color:var(--income-500); font-weight:600;">S3 API OK (Port 9000)</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0;">
              <span style="color:var(--text-muted);">Monitoring Prometheus & Grafana</span>
              <span style="color:var(--accent-cyan); font-weight:600;">Metrics Exporter Aktif</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('profile-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const updatedName = document.getElementById('profile-name').value.trim();
        const updatedEmail = document.getElementById('profile-email').value.trim();
        const updatedRole = document.getElementById('profile-role').value;

        FinStore.setUser({
          ...user,
          name: updatedName,
          email: updatedEmail,
          role: updatedRole
        });

        this.updateUserBadge(FinStore.getUser());
        this.showToast('Profil dan role berhasil diperbarui!', 'success');
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
