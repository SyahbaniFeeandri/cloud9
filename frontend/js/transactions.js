/**
 * FinCloud Transactions Page Module
 * Full CRUD with server-side filtering/search/pagination and MinIO receipts.
 */

import { FinStore, CATEGORIES } from './store.js';

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
    label: start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  };
}

export const TransactionsModule = {
  currentPage: 1,
  pageSize: 8,
  searchQuery: '',
  selectedType: 'all',
  selectedCategory: 'all',
  selectedDateFilter: 'all',
  _rows: [],
  _searchTimer: null,

  async render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const thisMonth = getMonthRange(0);
    const lastMonth = getMonthRange(-1);

    container.innerHTML = `
      <div class="transactions-view">
        <!-- Toolbar & Filter Card -->
        <div class="tx-toolbar">
          <div class="tx-toolbar-top">
            <div class="search-box">
              <div class="input-wrapper">
                <span class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input type="text" id="tx-search-input" class="form-input has-left-icon" placeholder="Cari nama transaksi atau catatan..." value="${this.searchQuery}" />
              </div>
            </div>

            <div class="tx-actions">
              <button class="btn btn-primary" id="btn-open-add-tx">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Catat Transaksi
              </button>
            </div>
          </div>

          <!-- Secondary Filters Row -->
          <div class="tx-filters-row">
            <!-- Type Filter Pills -->
            <div class="type-pills">
              <button class="type-pill-btn ${this.selectedType === 'all' ? 'active' : ''}" data-type="all">Semua</button>
              <button class="type-pill-btn ${this.selectedType === 'income' ? 'active income' : ''}" data-type="income">Pemasukan</button>
              <button class="type-pill-btn ${this.selectedType === 'expense' ? 'active expense' : ''}" data-type="expense">Pengeluaran</button>
            </div>

            <!-- Category Filter Dropdown -->
            <select class="filter-select" id="filter-tx-category">
              <option value="all">Semua Kategori</option>
              <optgroup label="Pemasukan">
                ${CATEGORIES.income.map(c => `<option value="${c.name}" ${this.selectedCategory === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
              </optgroup>
              <optgroup label="Pengeluaran">
                ${CATEGORIES.expense.map(c => `<option value="${c.name}" ${this.selectedCategory === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
              </optgroup>
            </select>

            <!-- Date Range Filter -->
            <select class="filter-select" id="filter-tx-date">
              <option value="all" ${this.selectedDateFilter === 'all' ? 'selected' : ''}>Semua Periode</option>
              <option value="this-month" ${this.selectedDateFilter === 'this-month' ? 'selected' : ''}>Bulan Ini (${thisMonth.label})</option>
              <option value="last-month" ${this.selectedDateFilter === 'last-month' ? 'selected' : ''}>Bulan Lalu (${lastMonth.label})</option>
            </select>

            <!-- Summary Chips -->
            <div class="tx-summary-chips" id="tx-summary-chips">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>

        <!-- Table Card -->
        <div class="tx-table-card">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 130px;">Tanggal</th>
                  <th>Keterangan</th>
                  <th style="width: 150px;">Kategori</th>
                  <th style="width: 120px;">Bukti / Struk</th>
                  <th style="width: 160px; text-align: right;">Nominal</th>
                  <th style="width: 100px; text-align: center;">Aksi</th>
                </tr>
              </thead>
              <tbody id="tx-table-body">
                <tr>
                  <td colspan="6">
                    <div class="view-loading" style="min-height:180px;">
                      <div class="loading-spinner"></div>
                      <p>Memuat transaksi...</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div class="table-pagination" id="tx-pagination-container">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadAndRender();
  },

  getDateRange() {
    if (this.selectedDateFilter === 'this-month') {
      const range = getMonthRange(0);
      return { startDate: range.startDate, endDate: range.endDate };
    }

    if (this.selectedDateFilter === 'last-month') {
      const range = getMonthRange(-1);
      return { startDate: range.startDate, endDate: range.endDate };
    }

    return {};
  },

  buildParams() {
    const params = {
      limit: this.pageSize,
      offset: (this.currentPage - 1) * this.pageSize
    };

    if (this.selectedType !== 'all') params.type = this.selectedType;
    if (this.selectedCategory !== 'all') params.category = this.selectedCategory;
    if (this.searchQuery.trim()) params.search = this.searchQuery.trim();

    return { ...params, ...this.getDateRange() };
  },

  async loadAndRender() {
    const tbody = document.getElementById('tx-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="view-loading" style="min-height:180px;">
              <div class="loading-spinner"></div>
              <p>Memuat transaksi...</p>
            </div>
          </td>
        </tr>
      `;
    }

    try {
      const rows = await FinStore.loadTransactions(this.buildParams());
      const total = FinStore.getTransactionTotal();
      const summary = FinStore.getTransactionSummary();

      const totalPages = Math.max(Math.ceil(total / this.pageSize), 1);
      if (total > 0 && this.currentPage > totalPages) {
        this.currentPage = totalPages;
        return this.loadAndRender();
      }

      this._rows = rows;
      this.renderTableContent(rows, total, summary);
    } catch (error) {
      if (error?.status === 401) return;
      this.renderTableError(error);
    }
  },

  renderTableError(error) {
    const tbody = document.getElementById('tx-table-body');
    const pagination = document.getElementById('tx-pagination-container');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="view-error" style="min-height:180px;">
            <h4 class="empty-state-title">Gagal memuat transaksi</h4>
            <p class="empty-state-desc">${error?.message || 'Terjadi kesalahan.'}</p>
            <button class="btn btn-primary" id="btn-retry-transactions" style="margin-top:0.75rem;">Coba Lagi</button>
          </div>
        </td>
      </tr>
    `;
    if (pagination) pagination.innerHTML = '<span>Data tidak tersedia</span>';

    const retryBtn = document.getElementById('btn-retry-transactions');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadAndRender());
    }
  },

  renderTableContent(rows, total, summary) {
    const tbody = document.getElementById('tx-table-body');
    const pagination = document.getElementById('tx-pagination-container');
    const chipsContainer = document.getElementById('tx-summary-chips');
    if (!tbody) return;

    if (chipsContainer) {
      chipsContainer.innerHTML = `
        <span class="tx-summary-chip">Masuk: <b style="color:var(--income-500);">${FinStore.formatCurrency(summary.totalIncome)}</b></span>
        <span class="tx-summary-chip">Keluar: <b style="color:var(--expense-500);">${FinStore.formatCurrency(summary.totalExpense)}</b></span>
      `;
    }

    if (total === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <h4 class="empty-state-title">Tidak ada transaksi yang cocok</h4>
              <p class="empty-state-desc">Coba sesuaikan kata kunci pencarian atau ubah filter periode dan kategori Anda.</p>
            </div>
          </td>
        </tr>
      `;
      if (pagination) pagination.innerHTML = '<span>Menampilkan 0 dari 0 transaksi</span>';
      return;
    }

    tbody.innerHTML = rows.map(t => `
      <tr>
        <td style="color: var(--text-muted); font-size: 0.85rem;">
          ${FinStore.formatDate(t.date)}
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${t.description}</div>
          <div style="font-size: 0.75rem; color: var(--text-faint); margin-top: 0.15rem;">ID: ${t.id}</div>
        </td>
        <td>
          <span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">
            ${t.category}
          </span>
        </td>
        <td>
          ${t.receipt ? `
            <button class="receipt-badge btn-view-receipt" data-id="${t.id}" title="Klik untuk lihat bukti struk MinIO">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              Lihat Struk
            </button>
          ` : `
            <span class="receipt-badge empty">
              Tidak Ada
            </span>
          `}
        </td>
        <td style="text-align: right; font-weight: 700; font-size: 0.95rem;" class="${t.type === 'income' ? 'mini-tx-amount income' : 'mini-tx-amount expense'}">
          ${t.type === 'income' ? '+' : '-'} ${FinStore.formatCurrency(t.amount)}
        </td>
        <td style="text-align: center;">
          <div class="tx-row-actions" style="justify-content: center;">
            <button class="btn-table-action btn-edit-tx" data-id="${t.id}" title="Ubah Transaksi">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="btn-table-action delete btn-delete-tx" data-id="${t.id}" title="Hapus Transaksi">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    const totalPages = Math.max(Math.ceil(total / this.pageSize), 1);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const displayStart = startIndex + 1;
    const displayEnd = Math.min(startIndex + this.pageSize, total);

    if (pagination) {
      const pageButtons = [];
      for (let page = 1; page <= totalPages; page += 1) {
        pageButtons.push(`
          <button class="page-num-btn ${this.currentPage === page ? 'active' : ''}" data-page="${page}">
            ${page}
          </button>
        `);
      }

      pagination.innerHTML = `
        <div>
          Menampilkan <b>${displayStart}-${displayEnd}</b> dari <b>${total}</b> transaksi
        </div>
        <div class="pagination-controls">
          <button class="page-num-btn" id="pg-prev-btn" ${this.currentPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            &larr;
          </button>
          ${pageButtons.join('')}
          <button class="page-num-btn" id="pg-next-btn" ${this.currentPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            &rarr;
          </button>
        </div>
      `;

      const prevBtn = document.getElementById('pg-prev-btn');
      const nextBtn = document.getElementById('pg-next-btn');

      if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
          if (this.currentPage > 1) {
            this.currentPage -= 1;
            await this.loadAndRender();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
          if (this.currentPage < totalPages) {
            this.currentPage += 1;
            await this.loadAndRender();
          }
        });
      }

      pagination.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          this.currentPage = parseInt(e.currentTarget.getAttribute('data-page'), 10);
          await this.loadAndRender();
        });
      });
    }

    this.bindRowEvents();
  },

  bindEvents() {
    // Search input with debounce
    const searchInput = document.getElementById('tx-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.currentPage = 1;

        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.loadAndRender().catch((error) => {
            if (error?.status !== 401) window.showToast(error.message, 'error');
          });
        }, 350);
      });
    }

    // Type pills
    document.querySelectorAll('.type-pill-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.type-pill-btn').forEach(b => b.classList.remove('active', 'income', 'expense'));
        const type = e.currentTarget.getAttribute('data-type');
        e.currentTarget.classList.add('active');
        if (type === 'income') e.currentTarget.classList.add('income');
        if (type === 'expense') e.currentTarget.classList.add('expense');
        this.selectedType = type;

        // Reset the category filter when it does not belong to the new type.
        if (type !== 'all' && this.selectedCategory !== 'all') {
          const allowed = (CATEGORIES[type] || []).some(c => c.name === this.selectedCategory);
          if (!allowed) {
            this.selectedCategory = 'all';
            const catSelect = document.getElementById('filter-tx-category');
            if (catSelect) catSelect.value = 'all';
          }
        }

        this.currentPage = 1;
        await this.loadAndRender();
      });
    });

    // Category filter
    const catSelect = document.getElementById('filter-tx-category');
    if (catSelect) {
      catSelect.addEventListener('change', async (e) => {
        this.selectedCategory = e.target.value;
        this.currentPage = 1;
        await this.loadAndRender();
      });
    }

    // Date filter
    const dateSelect = document.getElementById('filter-tx-date');
    if (dateSelect) {
      dateSelect.addEventListener('change', async (e) => {
        this.selectedDateFilter = e.target.value;
        this.currentPage = 1;
        await this.loadAndRender();
      });
    }

    // Open Add Transaction Modal
    const addBtn = document.getElementById('btn-open-add-tx');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        window.openTransactionModal();
      });
    }
  },

  bindRowEvents() {
    // Edit transaction
    document.querySelectorAll('.btn-edit-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tx = this._rows.find(t => String(t.id) === String(id));
        if (tx) {
          window.openTransactionModal(tx);
        }
      });
    });

    // Delete transaction
    document.querySelectorAll('.btn-delete-tx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tx = this._rows.find(t => String(t.id) === String(id));

        if (tx && confirm(`Apakah Anda yakin ingin menghapus transaksi "${tx.description}"?`)) {
          try {
            await FinStore.deleteTransaction(id);
            window.showToast('Transaksi berhasil dihapus', 'info');
            await this.loadAndRender();
          } catch (error) {
            if (error?.status !== 401) {
              window.showToast(error.message || 'Gagal menghapus transaksi', 'error');
            }
          }
        }
      });
    });

    // View receipt
    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tx = this._rows.find(t => String(t.id) === String(id));
        if (tx && tx.receipt) {
          window.openReceiptModal(tx);
        }
      });
    });
  }
};
