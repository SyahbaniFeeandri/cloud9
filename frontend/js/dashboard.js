/**
 * FinCloud Dashboard View Module
 * Renders executive KPI metrics, interactive HTML5 canvas charts,
 * recent transactions list, and cloud service status indicators.
 */

import { FinStore } from './store.js';
import { router } from './router.js';

export const DashboardModule = {
  render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const user = FinStore.getUser();
    const metrics = FinStore.getFinancialMetrics();
    const transactions = FinStore.getTransactions().slice(0, 5);
    const health = FinStore.getSystemHealth();

    container.innerHTML = `
      <div class="dashboard-view">
        <!-- Top Welcome & Quick Actions -->
        <div class="dashboard-banner">
          <div class="banner-welcome">
            <h2>Ringkasan Finansial, ${user ? user.name : 'Pengguna'} 👋</h2>
            <p>Pantau pertumbuhan aset, pengeluaran terencana, dan status infrastruktur cloud Anda secara real-time.</p>
          </div>
          <div class="banner-actions">
            <button class="btn btn-primary" id="btn-dashboard-add-tx">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Tambah Transaksi
            </button>
            <button class="btn btn-secondary" id="btn-dashboard-view-report">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Lihat Laporan
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards Grid -->
        <div class="metrics-grid">
          <!-- Total Balance -->
          <div class="stat-card" style="--card-accent: var(--primary-500); --icon-bg: rgba(99,102,241,0.15); --icon-color: var(--primary-400);">
            <div class="stat-header">
              <span class="stat-label">Total Saldo Bersih</span>
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              </div>
            </div>
            <div class="stat-value">${FinStore.formatCurrency(metrics.balance)}</div>
            <div class="stat-footer">
              <span class="trend-badge up">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                +14.2%
              </span>
              <span>vs bulan sebelumnya</span>
            </div>
          </div>

          <!-- Total Income -->
          <div class="stat-card" style="--card-accent: var(--income-500); --icon-bg: rgba(16,185,129,0.15); --icon-color: var(--income-500);">
            <div class="stat-header">
              <span class="stat-label">Total Pemasukan</span>
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
              </div>
            </div>
            <div class="stat-value" style="color: var(--income-500);">${FinStore.formatCurrency(metrics.totalIncome)}</div>
            <div class="stat-footer">
              <span class="trend-badge up">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                +8.5%
              </span>
              <span>dari target pendapatan</span>
            </div>
          </div>

          <!-- Total Expense -->
          <div class="stat-card" style="--card-accent: var(--expense-500); --icon-bg: rgba(244,63,94,0.15); --icon-color: var(--expense-500);">
            <div class="stat-header">
              <span class="stat-label">Total Pengeluaran</span>
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
              </div>
            </div>
            <div class="stat-value" style="color: var(--expense-500);">${FinStore.formatCurrency(metrics.totalExpense)}</div>
            <div class="stat-footer">
              <span class="trend-badge down">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                -3.1%
              </span>
              <span>terkendali di bawah budget</span>
            </div>
          </div>

          <!-- Savings Rate -->
          <div class="stat-card" style="--card-accent: var(--accent-cyan); --icon-bg: rgba(6,182,212,0.15); --icon-color: var(--accent-cyan);">
            <div class="stat-header">
              <span class="stat-label">Rasio Tabungan</span>
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
              </div>
            </div>
            <div class="stat-value" style="color: var(--accent-cyan);">${metrics.savingsRate}%</div>
            <div class="stat-footer">
              <span class="trend-badge up">Optimal</span>
              <span>${metrics.transactionCount} total transaksi tercatat</span>
            </div>
          </div>
        </div>

        <!-- Interactive Visual Charts -->
        <div class="charts-grid">
          <!-- Cash Flow Bar/Area Chart -->
          <div class="card chart-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                Tren Arus Kas (Pemasukan vs Pengeluaran)
              </h3>
              <div class="chart-legend">
                <div class="legend-item">
                  <span class="legend-dot" style="background: var(--income-500);"></span>
                  <span>Pemasukan</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot" style="background: var(--expense-500);"></span>
                  <span>Pengeluaran</span>
                </div>
              </div>
            </div>
            <div class="chart-card-body" id="cashflow-canvas-container">
              <canvas id="cashflow-canvas" style="width:100%; height:100%;"></canvas>
            </div>
          </div>

          <!-- Expense Category Donut Chart -->
          <div class="card chart-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="m14 12-2 2-2-2"></path></svg>
                Distribusi Kategori
              </h3>
              <span class="card-action" id="btn-chart-view-all">Detail &rarr;</span>
            </div>
            <div class="chart-card-body" id="category-donut-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <canvas id="donut-canvas" width="220" height="220"></canvas>
              <div id="donut-legend-list" style="margin-top: 1rem; width:100%; display:flex; flex-direction:column; gap:0.4rem;"></div>
            </div>
          </div>
        </div>

        <!-- Dashboard Bottom Grid: Recent Activity & Cloud Health -->
        <div class="dashboard-bottom-grid">
          <!-- Recent Transactions Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Transaksi Terbaru
              </h3>
              <span class="card-action" id="btn-see-all-tx">Lihat Semua (${FinStore.getTransactions().length}) &rarr;</span>
            </div>
            <div class="mini-transaction-list">
              ${transactions.length === 0 ? `
                <div class="empty-state">
                  <div class="empty-state-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <h4 class="empty-state-title">Belum ada transaksi</h4>
                  <p class="empty-state-desc">Mulai catat transaksi pertama Anda untuk melihat statistik</p>
                </div>
              ` : transactions.map(t => `
                <div class="mini-tx-item">
                  <div class="mini-tx-left">
                    <div class="mini-tx-icon ${t.type}">
                      ${t.type === 'income' ? `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                      ` : `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                      `}
                    </div>
                    <div>
                      <div class="mini-tx-title">${t.description}</div>
                      <div class="mini-tx-meta">
                        <span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">${t.category}</span>
                        <span>&bull;</span>
                        <span>${FinStore.formatDate(t.date)}</span>
                        ${t.receipt ? '<span class="receipt-badge" title="Struk terlampir"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> Struk</span>' : ''}
                      </div>
                    </div>
                  </div>
                  <div class="mini-tx-right">
                    <div class="mini-tx-amount ${t.type}">
                      ${t.type === 'income' ? '+' : '-'} ${FinStore.formatCurrency(t.amount)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Budget Progress & Cloud Infrastructure Status -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Alokasi Budget & Status Cloud
              </h3>
            </div>
            
            <div class="budget-progress-box">
              <div class="budget-item">
                <div class="budget-item-header">
                  <span class="budget-name">Kebutuhan Rutin & Tempat Tinggal</span>
                  <span class="budget-vals">Rp 4.050.000 / Rp 6.000.000 (68%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: 68%; background: var(--primary-500);"></div>
                </div>
              </div>

              <div class="budget-item">
                <div class="budget-item-header">
                  <span class="budget-name">Makanan & Kuliner</span>
                  <span class="budget-vals">Rp 1.250.000 / Rp 2.500.000 (50%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: 50%; background: var(--accent-cyan);"></div>
                </div>
              </div>

              <div class="budget-item">
                <div class="budget-item-header">
                  <span class="budget-name">Hiburan & Belanja</span>
                  <span class="budget-vals">Rp 1.030.000 / Rp 2.000.000 (51%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: 51%; background: var(--accent-purple);"></div>
                </div>
              </div>
            </div>

            <!-- Cloud Nodes from Docker Charter -->
            <div class="cloud-nodes">
              <div class="cloud-node">
                <div class="node-title">PostgreSQL DB</div>
                <div class="node-status" style="color: var(--income-500);">
                  <span class="pulse-dot"></span> Online
                </div>
              </div>
              <div class="cloud-node">
                <div class="node-title">MinIO Storage</div>
                <div class="node-status" style="color: var(--income-500);">
                  <span class="pulse-dot"></span> S3 Ready
                </div>
              </div>
              <div class="cloud-node">
                <div class="node-title">Prometheus</div>
                <div class="node-status" style="color: var(--accent-cyan);">
                  <span class="pulse-dot" style="background:var(--accent-cyan); box-shadow:0 0 8px var(--accent-cyan);"></span> Aktif
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
    this.drawCashFlowChart();
    this.drawDonutChart();
  },

  bindEvents() {
    const addTxBtn = document.getElementById('btn-dashboard-add-tx');
    if (addTxBtn) {
      addTxBtn.addEventListener('click', () => {
        window.openTransactionModal();
      });
    }

    const reportBtn = document.getElementById('btn-dashboard-view-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => router.navigate('/reports'));
    }

    const seeAllBtn = document.getElementById('btn-see-all-tx');
    if (seeAllBtn) {
      seeAllBtn.addEventListener('click', () => router.navigate('/transactions'));
    }

    const viewAllChartBtn = document.getElementById('btn-chart-view-all');
    if (viewAllChartBtn) {
      viewAllChartBtn.addEventListener('click', () => router.navigate('/reports'));
    }

    if (!this._resizeAttached) {
      window.addEventListener('resize', () => {
        if (document.getElementById('cashflow-canvas')) {
          this.drawCashFlowChart();
        }
      });
      this._resizeAttached = true;
    }
  },

  drawCashFlowChart() {
    const canvas = document.getElementById('cashflow-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (container.clientWidth || 600);
    const h = rect.height > 0 ? rect.height : 280;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = Math.max(w - padding.left - padding.right, 100);
    const chartH = Math.max(h - padding.top - padding.bottom, 100);

    // Sample 6-Month Data: May to Oct 2026
    const months = ['Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt'];
    const incomeData = [12000000, 14500000, 13200000, 16000000, 15000000, 20700000];
    const expenseData = [5800000, 6200000, 7100000, 6900000, 6150000, 6350000];
    const maxVal = 25000000;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw horizontal grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color') || '#202d45';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-faint') || '#64748b';
    ctx.font = '11px sans-serif';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (chartH / gridSteps) * i;
      const val = Math.round((maxVal - (maxVal / gridSteps) * i) / 1000000);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      ctx.fillText(val + 'M', 15, y + 4);
    }

    // Draw bars
    const barGroupWidth = chartW / months.length;
    const barWidth = Math.min(22, barGroupWidth * 0.35);

    months.forEach((month, idx) => {
      const groupX = padding.left + idx * barGroupWidth;
      const centerX = groupX + barGroupWidth / 2;

      // Income bar (green)
      const incH = (incomeData[idx] / maxVal) * chartH;
      const incX = centerX - barWidth - 3;
      const incY = padding.top + chartH - incH;

      ctx.fillStyle = '#10b981';
      this.drawRoundedRect(ctx, incX, incY, barWidth, incH, 4);

      // Expense bar (rose)
      const expH = (expenseData[idx] / maxVal) * chartH;
      const expX = centerX + 3;
      const expY = padding.top + chartH - expH;

      ctx.fillStyle = '#f43f5e';
      this.drawRoundedRect(ctx, expX, expY, barWidth, expH, 4);

      // Month label
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(month, centerX, h - 15);
    });
  },

  drawDonutChart() {
    const canvas = document.getElementById('donut-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 220 * dpr;
    canvas.height = 220 * dpr;
    ctx.scale(dpr, dpr);

    const centerX = 110;
    const centerY = 110;
    const outerRadius = 85;
    const innerRadius = 55;

    const data = [
      { label: 'Housing', value: 3200000, color: '#eab308' },
      { label: 'Food', value: 1250000, color: '#f43f5e' },
      { label: 'Utilities', value: 850000, color: '#14b8a6' },
      { label: 'Transportation', value: 420000, color: '#f97316' },
      { label: 'Healthcare & Lainnya', value: 630000, color: '#a855f7' }
    ];

    const total = data.reduce((a, b) => a + b.value, 0);
    let startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, 220, 220);

    data.forEach(item => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Center text
    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-main') || '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Pengeluaran', centerX, centerY - 2);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#94a3b8';
    ctx.fillText(FinStore.formatCurrency(total), centerX, centerY + 18);

    // Build Legend List
    const legendList = document.getElementById('donut-legend-list');
    if (legendList) {
      legendList.innerHTML = data.map(item => `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.8rem;">
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <span style="width:8px; height:8px; border-radius:50%; background:${item.color};"></span>
            <span>${item.label}</span>
          </div>
          <span style="font-weight:600;">${Math.round((item.value / total) * 100)}%</span>
        </div>
      `).join('');
    }
  },

  drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height <= 0) return;
    const r = Math.min(radius, height / 2, width / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }
};
