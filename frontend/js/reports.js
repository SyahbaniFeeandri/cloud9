/**
 * FinCloud Reports View Module
 * Financial analytics backed by /api/reports, with CSV export from live data.
 */

import { FinStore } from './store.js';
import {
  calculatePeriodDays,
  calculateReportData as computeReportData
} from './finance.js';

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthName(date) {
  return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

export const ReportsModule = {
  selectedPeriod: 'this-month',
  _transactions: [],

  async render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const range = this.getPeriodRange();
    const year = new Date().getFullYear();

    const [expenseCategories, incomeCategories, transactions] = await Promise.all([
      FinStore.loadCategoryReport({ type: 'expense', ...range }),
      FinStore.loadCategoryReport({ type: 'income', ...range }),
      FinStore.loadTransactions({ ...range, limit: 1000 })
    ]);

    this._transactions = transactions;
    const data = this.calculateReportData(incomeCategories, expenseCategories);

    container.innerHTML = `
      <div class="reports-view">
        <!-- Report Header Controls -->
        <div class="report-header-card">
          <div class="report-title-info">
            <h3>Laporan Ringkasan Keuangan</h3>
            <p>Periode: <b>${this.getPeriodLabel()}</b> &bull; Dibuat secara otomatis oleh FinCloud Platform</p>
          </div>

          <div class="report-controls">
            <!-- Period Switcher -->
            <div class="period-pills">
              <button class="period-pill ${this.selectedPeriod === 'this-month' ? 'active' : ''}" data-period="this-month">Bulan Ini</button>
              <button class="period-pill ${this.selectedPeriod === 'quarter' ? 'active' : ''}" data-period="quarter">Kuartal Ini</button>
              <button class="period-pill ${this.selectedPeriod === 'year' ? 'active' : ''}" data-period="year">Tahun ${year}</button>
              <button class="period-pill ${this.selectedPeriod === 'all' ? 'active' : ''}" data-period="all">Semua</button>
            </div>

            <!-- Export Buttons -->
            <button class="btn btn-secondary" id="btn-export-csv" title="Unduh data format CSV/Excel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export CSV
            </button>
            <button class="btn btn-primary" id="btn-print-report" title="Cetak atau simpan sebagai PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
              Cetak / PDF
            </button>
          </div>
        </div>

        <!-- Executive Metrics Row -->
        <div class="report-summary-grid">
          <div class="report-metric-card">
            <span class="report-metric-title">Total Arus Masuk</span>
            <span class="report-metric-val income">${FinStore.formatCurrency(data.totalIncome)}</span>
            <span class="report-metric-sub">${data.incomeCount} transaksi pendapatan</span>
          </div>

          <div class="report-metric-card">
            <span class="report-metric-title">Total Arus Keluar</span>
            <span class="report-metric-val expense">${FinStore.formatCurrency(data.totalExpense)}</span>
            <span class="report-metric-sub">${data.expenseCount} transaksi belanja & tagihan</span>
          </div>

          <div class="report-metric-card">
            <span class="report-metric-title">Surplus Kas Bersih</span>
            <span class="report-metric-val net">${FinStore.formatCurrency(data.netSavings)}</span>
            <span class="report-metric-sub">${data.netSavings >= 0 ? 'Surplus Finansial' : 'Defisit Pengeluaran'}</span>
          </div>

          <div class="report-metric-card">
            <span class="report-metric-title">Rasio Tabungan / Aset</span>
            <span class="report-metric-val" style="color: var(--accent-purple);">${data.savingsRatio}%</span>
            <span class="report-metric-sub">Rata-rata pengeluaran/hari: ${FinStore.formatCurrency(data.avgDailyExpense)}</span>
          </div>
        </div>

        <!-- Analytics 2-Col Grid: Category Breakdown Ranks -->
        <div class="report-analytics-grid">
          <!-- Expense Category Ranks -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                Peringkat Pengeluaran per Kategori
              </h3>
              <span class="badge badge-expense">Beban Biaya</span>
            </div>

            <div class="category-rank-list">
              ${data.expenseRanks.length === 0 ? '<p style="color:var(--text-muted); padding:1rem 0;">Tidak ada pengeluaran pada periode ini.</p>' : ''}
              ${data.expenseRanks.map(item => `
                <div class="category-rank-item">
                  <div class="category-rank-meta">
                    <span class="category-rank-name">
                      <span style="width:10px; height:10px; border-radius:50%; background:${item.color || 'var(--expense-500)'};"></span>
                      ${item.category} (${item.count}x)
                    </span>
                    <div class="category-rank-values">
                      <span class="category-rank-amount">${FinStore.formatCurrency(item.total)}</span>
                      <span class="category-rank-pct">${item.percentage}%</span>
                    </div>
                  </div>
                  <div class="rank-bar-bg">
                    <div class="rank-bar-fill" style="width: ${item.percentage}%;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Income Sources Breakdown -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Sumber Pendapatan & Portofolio
              </h3>
              <span class="badge badge-income">Aset Masuk</span>
            </div>

            <div class="category-rank-list">
              ${data.incomeRanks.length === 0 ? '<p style="color:var(--text-muted); padding:1rem 0;">Tidak ada pendapatan pada periode ini.</p>' : ''}
              ${data.incomeRanks.map(item => `
                <div class="category-rank-item">
                  <div class="category-rank-meta">
                    <span class="category-rank-name">
                      <span style="width:10px; height:10px; border-radius:50%; background:${item.color || 'var(--income-500)'};"></span>
                      ${item.category} (${item.count}x)
                    </span>
                    <div class="category-rank-values">
                      <span class="category-rank-amount" style="color: var(--income-500);">${FinStore.formatCurrency(item.total)}</span>
                      <span class="category-rank-pct">${item.percentage}%</span>
                    </div>
                  </div>
                  <div class="rank-bar-bg">
                    <div class="rank-bar-fill" style="width: ${item.percentage}%; background: linear-gradient(90deg, var(--income-500), var(--accent-cyan));"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Comprehensive Statement Breakdown Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              Detail Rekapitulasi per Kategori
            </h3>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nama Kategori</th>
                  <th>Jenis Arus Kas</th>
                  <th style="text-align: center;">Frekuensi</th>
                  <th style="text-align: right;">Total Nominal</th>
                  <th style="text-align: right;">Porsi Finansial</th>
                </tr>
              </thead>
              <tbody>
                ${[...data.incomeRanks, ...data.expenseRanks].map(row => `
                  <tr>
                    <td style="font-weight: 600;">${row.category}</td>
                    <td>
                      <span class="badge ${row.type === 'income' ? 'badge-income' : 'badge-expense'}">
                        ${row.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td style="text-align: center; color: var(--text-muted);">${row.count} kali</td>
                    <td style="text-align: right; font-weight: 700; color: ${row.type === 'income' ? 'var(--income-500)' : 'var(--expense-500)'}">
                      ${row.type === 'income' ? '+' : '-'} ${FinStore.formatCurrency(row.total)}
                    </td>
                    <td style="text-align: right; font-weight: 600;">${row.percentage}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  },

  getPeriodRange() {
    const now = new Date();
    const year = now.getFullYear();

    if (this.selectedPeriod === 'this-month') {
      return {
        startDate: toInputDate(new Date(year, now.getMonth(), 1)),
        endDate: toInputDate(new Date(year, now.getMonth() + 1, 0))
      };
    }

    if (this.selectedPeriod === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        startDate: toInputDate(new Date(year, quarterStartMonth, 1)),
        endDate: toInputDate(new Date(year, quarterStartMonth + 3, 0))
      };
    }

    if (this.selectedPeriod === 'year') {
      return {
        startDate: toInputDate(new Date(year, 0, 1)),
        endDate: toInputDate(new Date(year, 11, 31))
      };
    }

    return {};
  },

  getPeriodLabel() {
    const now = new Date();
    const year = now.getFullYear();

    if (this.selectedPeriod === 'this-month') {
      return now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    if (this.selectedPeriod === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      const quarter = Math.floor(now.getMonth() / 3) + 1;

      return `Kuartal ${quarter} (${monthName(start)} - ${monthName(end)})`;
    }

    if (this.selectedPeriod === 'year') {
      return `Tahun Kalender ${year}`;
    }

    return 'Seluruh Waktu';
  },

  getPeriodDays() {
    const range = this.getPeriodRange();
    return calculatePeriodDays(range.startDate, range.endDate);
  },

  calculateReportData(incomeCategories, expenseCategories) {
    return computeReportData(incomeCategories, expenseCategories, this.getPeriodDays());
  },

  bindEvents() {
    // Period pills
    document.querySelectorAll('.period-pill').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.period-pill').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedPeriod = e.currentTarget.getAttribute('data-period');

        try {
          await this.render();
        } catch (error) {
          if (error?.status !== 401) {
            window.showToast(error.message || 'Gagal memuat laporan', 'error');
          }
        }
      });
    });

    // Export CSV
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToCSV();
      });
    }

    // Print Report
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  },

  exportToCSV() {
    const list = this._transactions;

    if (!list || list.length === 0) {
      window.showToast('Tidak ada transaksi untuk diekspor', 'error');
      return;
    }

    const lines = ['ID Transaksi,Tanggal,Tipe,Kategori,Deskripsi,Nominal,Bukti Struk'];

    list.forEach(t => {
      lines.push([
        t.id,
        t.date,
        t.type,
        `"${t.category}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
        t.receiptName || 'None'
      ].join(','));
    });

    // BOM keeps Excel happy with UTF-8 characters; Blob avoids URL length limits.
    const blob = new Blob([`\ufeff${lines.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8;'
    });
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', objectUrl);
    link.setAttribute('download', `fincloud_laporan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    window.showToast('Laporan CSV berhasil diunduh!', 'success');
  }
};
