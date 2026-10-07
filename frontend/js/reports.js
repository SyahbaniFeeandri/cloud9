/**
 * FinCloud Reports View Module
 * Provides financial performance analytics, executive summary cards,
 * category spending ranks, CSV export engine, and printable PDF reports.
 */

import { FinStore } from './store.js';

export const ReportsModule = {
  selectedPeriod: 'this-month',

  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const data = this.calculateReportData();

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
              <button class="period-pill ${this.selectedPeriod === 'quarter' ? 'active' : ''}" data-period="quarter">Kuartal 4</button>
              <button class="period-pill ${this.selectedPeriod === 'year' ? 'active' : ''}" data-period="year">Tahun 2026</button>
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
                      <span style="width:10px; height:10px; border-radius:50%; background:var(--expense-500);"></span>
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
                      <span style="width:10px; height:10px; border-radius:50%; background:var(--income-500);"></span>
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

  getPeriodLabel() {
    switch (this.selectedPeriod) {
      case 'this-month': return 'Oktober 2026';
      case 'quarter': return 'Kuartal 4 (Okt - Des 2026)';
      case 'year': return 'Tahun Kalender 2026';
      default: return 'Seluruh Waktu';
    }
  },

  calculateReportData() {
    let list = FinStore.getTransactions();

    if (this.selectedPeriod === 'this-month') {
      list = list.filter(t => t.date.startsWith('2026-10'));
    } else if (this.selectedPeriod === 'quarter') {
      list = list.filter(t => t.date.startsWith('2026-10') || t.date.startsWith('2026-11') || t.date.startsWith('2026-12'));
    } else if (this.selectedPeriod === 'year') {
      list = list.filter(t => t.date.startsWith('2026'));
    }

    const incomeTx = list.filter(t => t.type === 'income');
    const expenseTx = list.filter(t => t.type === 'expense');

    const totalIncome = incomeTx.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expenseTx.reduce((s, t) => s + t.amount, 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRatio = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
    const avgDailyExpense = Math.round(totalExpense / 30);

    // Group expense by category
    const expenseGroups = {};
    expenseTx.forEach(t => {
      expenseGroups[t.category] = (expenseGroups[t.category] || { total: 0, count: 0 });
      expenseGroups[t.category].total += t.amount;
      expenseGroups[t.category].count += 1;
    });

    const expenseRanks = Object.keys(expenseGroups).map(cat => ({
      category: cat,
      type: 'expense',
      total: expenseGroups[cat].total,
      count: expenseGroups[cat].count,
      percentage: totalExpense > 0 ? Math.round((expenseGroups[cat].total / totalExpense) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    // Group income by category
    const incomeGroups = {};
    incomeTx.forEach(t => {
      incomeGroups[t.category] = (incomeGroups[t.category] || { total: 0, count: 0 });
      incomeGroups[t.category].total += t.amount;
      incomeGroups[t.category].count += 1;
    });

    const incomeRanks = Object.keys(incomeGroups).map(cat => ({
      category: cat,
      type: 'income',
      total: incomeGroups[cat].total,
      count: incomeGroups[cat].count,
      percentage: totalIncome > 0 ? Math.round((incomeGroups[cat].total / totalIncome) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    return {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRatio,
      avgDailyExpense,
      incomeCount: incomeTx.length,
      expenseCount: expenseTx.length,
      expenseRanks,
      incomeRanks
    };
  },

  bindEvents() {
    // Period pills
    document.querySelectorAll('.period-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.period-pill').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedPeriod = e.currentTarget.getAttribute('data-period');
        this.render();
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
    const list = FinStore.getTransactions();
    if (list.length === 0) {
      window.showToast('Tidak ada transaksi untuk diekspor', 'error');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID Transaksi,Tanggal,Tipe,Kategori,Deskripsi,Nominal,Bukti Struk\r\n';

    list.forEach(t => {
      const row = [
        t.id,
        t.date,
        t.type,
        `"${t.category}"`,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount,
        t.receiptName || 'None'
      ].join(',');
      csvContent += row + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fincloud_laporan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast('Laporan CSV berhasil diunduh!', 'success');
  }
};
