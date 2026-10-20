/**
 * FinCloud Transactions Page Module
 * Full CRUD, search & multi-facet filtering, MinIO receipt upload simulation,
 * pagination, and interactive receipts preview.
 */

import { FinStore, CATEGORIES } from './store.js';

export const TransactionsModule = {
  currentPage: 1,
  pageSize: 8,
  searchQuery: '',
  selectedType: 'all',
  selectedCategory: 'all',
  selectedDateFilter: 'all',
  editingTxId: null,
  uploadedReceiptData: null,

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const allCategories = [...CATEGORIES.income, ...CATEGORIES.expense];

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
              <option value="this-month" ${this.selectedDateFilter === 'this-month' ? 'selected' : ''}>Bulan Ini (Okt 2026)</option>
              <option value="last-month" ${this.selectedDateFilter === 'last-month' ? 'selected' : ''}>Bulan Lalu (Sep 2026)</option>
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
                <!-- Rendered dynamically -->
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
    this.renderTableContent();
  },

  getFilteredData() {
    let list = FinStore.getTransactions();

    // Text search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(t => 
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (this.selectedType !== 'all') {
      list = list.filter(t => t.type === this.selectedType);
    }

    // Category filter
    if (this.selectedCategory !== 'all') {
      list = list.filter(t => t.category === this.selectedCategory);
    }

    // Date filter
    if (this.selectedDateFilter === 'this-month') {
      list = list.filter(t => t.date.startsWith('2026-10'));
    } else if (this.selectedDateFilter === 'last-month') {
      list = list.filter(t => t.date.startsWith('2026-09'));
    }

    return list;
  },

  renderTableContent() {
    const tbody = document.getElementById('tx-table-body');
    const pagination = document.getElementById('tx-pagination-container');
    const chipsContainer = document.getElementById('tx-summary-chips');
    if (!tbody) return;

    const filtered = this.getFilteredData();
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / this.pageSize) || 1;

    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    // Summary calculation for chips
    const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    if (chipsContainer) {
      chipsContainer.innerHTML = `
        <span class="tx-summary-chip">Masuk: <b style="color:var(--income-500);">${FinStore.formatCurrency(totalIncome)}</b></span>
        <span class="tx-summary-chip">Keluar: <b style="color:var(--expense-500);">${FinStore.formatCurrency(totalExpense)}</b></span>
      `;
    }

    if (totalCount === 0) {
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

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paginatedItems = filtered.slice(startIndex, startIndex + this.pageSize);

    tbody.innerHTML = paginatedItems.map(t => `
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

    // Pagination HTML
    if (pagination) {
      pagination.innerHTML = `
        <div>
          Menampilkan <b>${startIndex + 1}-${Math.min(startIndex + this.pageSize, totalCount)}</b> dari <b>${totalCount}</b> transaksi
        </div>
        <div class="pagination-controls">
          <button class="page-num-btn" id="pg-prev-btn" ${this.currentPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            &larr;
          </button>
          ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
            <button class="page-num-btn ${this.currentPage === p ? 'active' : ''}" data-page="${p}">
              ${p}
            </button>
          `).join('')}
          <button class="page-num-btn" id="pg-next-btn" ${this.currentPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            &rarr;
          </button>
        </div>
      `;

      // Pagination events
      const prevBtn = document.getElementById('pg-prev-btn');
      const nextBtn = document.getElementById('pg-next-btn');
      if (prevBtn) prevBtn.addEventListener('click', () => { if (this.currentPage > 1) { this.currentPage--; this.renderTableContent(); } });
      if (nextBtn) nextBtn.addEventListener('click', () => { if (this.currentPage < totalPages) { this.currentPage++; this.renderTableContent(); } });

      pagination.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.currentPage = parseInt(e.currentTarget.getAttribute('data-page'));
          this.renderTableContent();
        });
      });
    }

    // Attach row action events
    this.bindRowEvents();
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('tx-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.currentPage = 1;
        this.renderTableContent();
      });
    }

    // Type pills
    document.querySelectorAll('.type-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.type-pill-btn').forEach(b => b.classList.remove('active', 'income', 'expense'));
        const type = e.currentTarget.getAttribute('data-type');
        e.currentTarget.classList.add('active');
        if (type === 'income') e.currentTarget.classList.add('income');
        if (type === 'expense') e.currentTarget.classList.add('expense');
        this.selectedType = type;
        this.currentPage = 1;
        this.renderTableContent();
      });
    });

    // Category filter
    const catSelect = document.getElementById('filter-tx-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.currentPage = 1;
        this.renderTableContent();
      });
    }

    // Date filter
    const dateSelect = document.getElementById('filter-tx-date');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        this.selectedDateFilter = e.target.value;
        this.currentPage = 1;
        this.renderTableContent();
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
        const tx = FinStore.getTransactions().find(t => t.id === id);
        if (tx) {
          window.openTransactionModal(tx);
        }
      });
    });

    // Delete transaction
    document.querySelectorAll('.btn-delete-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tx = FinStore.getTransactions().find(t => t.id === id);
        if (tx && confirm(`Apakah Anda yakin ingin menghapus transaksi "${tx.description}"?`)) {
          FinStore.deleteTransaction(id);
          window.showToast('Transaksi berhasil dihapus', 'info');
          this.renderTableContent();
        }
      });
    });

    // View receipt
    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tx = FinStore.getTransactions().find(t => t.id === id);
        if (tx && tx.receipt) {
          window.openReceiptModal(tx);
        }
      });
    });
  }
};
