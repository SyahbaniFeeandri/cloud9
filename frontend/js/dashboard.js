/**
 * FinCloud Dashboard View Module
 * Renders KPI metrics, canvas charts, recent transactions and live service
 * status using data from /api/dashboard, /api/reports and /api/health.
 */

import { FinStore } from './store.js';
import { router } from './router.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const CATEGORY_PALETTE = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6'];

function formatCompact(value) {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(0)}rb`;
  return String(Math.round(num));
}

function trendMarkup(current, previous) {
  if (!previous || previous <= 0) {
    return `<span class="trend-badge up">Data API</span>`;
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  const isUp = percent >= 0;

  return `
    <span class="trend-badge ${isUp ? 'up' : 'down'}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${isUp
          ? '<polyline points="18 15 12 9 6 15"></polyline>'
          : '<polyline points="6 9 12 15 18 9"></polyline>'}
      </svg>
      ${isUp ? '+' : ''}${percent}%
    </span>
  `;
}

export const DashboardModule = {
  _monthly: [],
  _expenseCategories: [],
  _recentTransactions: [],
  _health: null,

  async render() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const currentYear = new Date().getFullYear();

    const [dashboard, monthly, expenseCategories] = await Promise.all([
      FinStore.loadDashboard(),
      FinStore.loadMonthlyReport(currentYear),
      FinStore.loadCategoryReport({ type: 'expense' })
    ]);

    let health = null;
    try {
      health = await FinStore.loadSystemHealth();
    } catch (error) {
      health = null;
    }

    this._monthly = monthly || [];
    this._expenseCategories = expenseCategories || [];
    this._recentTransactions = dashboard?.recentTransactions || [];
    this._health = health;

    const user = FinStore.getUser();
    const metrics = this.buildMetrics(dashboard, this._monthly);
    const transactions = this._recentTransactions;
    const topCategories = this._expenseCategories.slice(0, 3);
    const totalExpense = metrics.totalExpense;

    const apiUp = health?.health?.status === 'UP';
    const dbConnected = Boolean(health?.health?.database?.connected);
    const storageReady = Boolean(health?.health?.storage?.connected);

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
              ${trendMarkup(metrics.monthlyIncome - metrics.monthlyExpense, metrics.previousNet)}
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
              ${trendMarkup(metrics.monthlyIncome, metrics.previousIncome)}
              <span>Bulan ini ${FinStore.formatCurrency(metrics.monthlyIncome)}</span>
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
              ${trendMarkup(metrics.monthlyExpense, metrics.previousExpense)}
              <span>Bulan ini ${FinStore.formatCurrency(metrics.monthlyExpense)}</span>
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
              <span class="trend-badge up">${metrics.savingsRate >= 20 ? 'Optimal' : 'Perlu Ditingkatkan'}</span>
              <span>${metrics.transactionCount} total transaksi tercatat</span>
            </div>
          </div>
        </div>

        <!-- Interactive Visual Charts -->
        <div class="charts-grid">
          <!-- Cash Flow Bar Chart -->
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
              <span class="card-action" id="btn-see-all-tx">Lihat Semua (${metrics.transactionCount}) &rarr;</span>
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
                <div class="mini-tx-item" data-id="${t.id}" style="cursor: pointer;" title="Klik untuk lihat transaksi">
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
                        ${t.receipt ? `<button class="receipt-badge btn-dashboard-receipt" data-id="${t.id}" title="Struk terlampir" style="border:none; cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> Struk</button>` : ''}
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

          <!-- Category Allocation & Cloud Infrastructure Status -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Alokasi Pengeluaran & Status Cloud
              </h3>
            </div>

            <div class="budget-progress-box">
              ${topCategories.length === 0 ? `
                <p style="color:var(--text-muted); font-size:0.85rem;">Belum ada pengeluaran untuk dianalisis.</p>
              ` : topCategories.map((category, index) => {
                const percent = totalExpense > 0
                  ? Math.round((category.total_amount / totalExpense) * 100)
                  : 0;
                const color = category.color || CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];

                return `
                  <div class="budget-item">
                    <div class="budget-item-header">
                      <span class="budget-name">${category.name}</span>
                      <span class="budget-vals">${FinStore.formatCurrency(category.total_amount)} (${percent}%)</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width: ${percent}%; background: ${color};"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Cloud Nodes from live API health -->
            <div class="cloud-nodes">
              <div class="cloud-node">
                <div class="node-title">REST API</div>
                <div class="node-status" style="color: ${apiUp ? 'var(--income-500)' : 'var(--expense-500)'};">
                  <span class="pulse-dot" style="${apiUp ? '' : 'background:var(--expense-500); box-shadow:0 0 8px var(--expense-500);'}"></span>
                  ${apiUp ? 'Online' : 'Offline'}
                </div>
              </div>
              <div class="cloud-node">
                <div class="node-title">MariaDB</div>
                <div class="node-status" style="color: ${dbConnected ? 'var(--income-500)' : 'var(--expense-500)'};">
                  <span class="pulse-dot" style="${dbConnected ? '' : 'background:var(--expense-500); box-shadow:0 0 8px var(--expense-500);'}"></span>
                  ${dbConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <div class="cloud-node">
                <div class="node-title">MinIO Storage</div>
                <div class="node-status" style="color: ${storageReady ? 'var(--income-500)' : 'var(--expense-500)'};">
                  <span class="pulse-dot" style="${storageReady ? '' : 'background:var(--expense-500); box-shadow:0 0 8px var(--expense-500);'}"></span>
                  ${storageReady ? 'S3 Ready' : 'Offline'}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
    this.drawCashFlowChart(this._monthly);
    this.drawDonutChart(this._expenseCategories);
  },

  buildMetrics(dashboard, monthly) {
    const totalIncome = Number(dashboard?.totalIncome) || 0;
    const totalExpense = Number(dashboard?.totalExpense) || 0;
    const balance = Number(dashboard?.currentBalance) || 0;
    const transactionCount = Number(dashboard?.transactionCount) || 0;
    const monthlyIncome = Number(dashboard?.monthlyIncome) || 0;
    const monthlyExpense = Number(dashboard?.monthlyExpense) || 0;

    const currentMonth = new Date().getMonth() + 1;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const currentRow = (monthly || []).find((row) => row.month === currentMonth);
    const previousRow = (monthly || []).find((row) => row.month === previousMonth);

    const previousIncome = previousRow?.income ?? (currentRow ? 0 : 0);
    const previousExpense = previousRow?.expense ?? (currentRow ? 0 : 0);
    const previousNet = previousIncome - previousExpense;

    return {
      totalIncome,
      totalExpense,
      balance,
      transactionCount,
      monthlyIncome,
      monthlyExpense,
      previousIncome,
      previousExpense,
      previousNet,
      savingsRate:
        totalIncome > 0 ? Math.max(0, Math.round((balance / totalIncome) * 100)) : 0
    };
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

    // Mini recent activity item clicks
    document.querySelectorAll('.mini-tx-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-dashboard-receipt')) return;
        const id = item.getAttribute('data-id');
        const tx = this._recentTransactions.find(t => String(t.id) === String(id));
        if (tx && window.openTransactionModal) {
          window.openTransactionModal(tx);
        }
      });
    });

    document.querySelectorAll('.btn-dashboard-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const tx = this._recentTransactions.find(t => String(t.id) === String(id));
        if (tx && tx.receipt && window.openReceiptModal) {
          window.openReceiptModal(tx);
        }
      });
    });

    if (!this._resizeAttached) {
      window.addEventListener('resize', () => {
        if (document.getElementById('cashflow-canvas')) {
          this.drawCashFlowChart();
        }
      });
      this._resizeAttached = true;
    }
  },

  drawCashFlowChart(monthly = null) {
    const canvas = document.getElementById('cashflow-canvas');
    if (!canvas) return;

    if (monthly) this._monthly = monthly;
    const data = this._monthly || [];

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (container.clientWidth || 600);
    const h = rect.height > 0 ? rect.height : 280;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padding = { top: 20, right: 20, bottom: 40, left: 56 };
    const chartW = Math.max(w - padding.left - padding.right, 100);
    const chartH = Math.max(h - padding.top - padding.bottom, 100);

    // Last 6 months ending with the current month.
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthNumber = date.getMonth() + 1;
      const row = data.find((item) => item.month === monthNumber) || { income: 0, expense: 0 };
      months.push({
        label: MONTH_LABELS[date.getMonth()],
        income: row.income,
        expense: row.expense
      });
    }

    const maxValue = Math.max(
      ...months.map((month) => Math.max(month.income, month.expense)),
      1
    );
    const maxVal = Math.ceil(maxValue / 1_000_000) * 1_000_000 || 1;

    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color') || '#202d45';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-faint') || '#64748b';
    ctx.font = '11px sans-serif';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i += 1) {
      const y = padding.top + (chartH / gridSteps) * i;
      const value = maxVal - (maxVal / gridSteps) * i;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(formatCompact(value), padding.left - 10, y + 4);
    }

    const barGroupWidth = chartW / months.length;
    const barWidth = Math.min(22, barGroupWidth * 0.35);

    months.forEach((month, index) => {
      const groupX = padding.left + index * barGroupWidth;
      const centerX = groupX + barGroupWidth / 2;

      const incomeHeight = (month.income / maxVal) * chartH;
      const incomeX = centerX - barWidth - 3;
      const incomeY = padding.top + chartH - incomeHeight;

      ctx.fillStyle = '#10b981';
      this.drawRoundedRect(ctx, incomeX, incomeY, barWidth, incomeHeight, 4);

      const expenseHeight = (month.expense / maxVal) * chartH;
      const expenseX = centerX + 3;
      const expenseY = padding.top + chartH - expenseHeight;

      ctx.fillStyle = '#f43f5e';
      this.drawRoundedRect(ctx, expenseX, expenseY, barWidth, expenseHeight, 4);

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(month.label, centerX, h - 15);
    });
  },

  drawDonutChart(categories = null) {
    const canvas = document.getElementById('donut-canvas');
    if (!canvas) return;

    if (categories) this._expenseCategories = categories;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 220 * dpr;
    canvas.height = 220 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centerX = 110;
    const centerY = 110;
    const outerRadius = 85;
    const innerRadius = 55;

    const source = this._expenseCategories || [];
    let data = source
      .slice(0, 5)
      .map((category, index) => ({
        label: category.name,
        value: Number(category.total_amount) || 0,
        color: category.color || CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]
      }))
      .filter((item) => item.value > 0);

    const hasData = data.length > 0;

    if (!hasData) {
      data = [{ label: 'Belum Ada', value: 1, color: '#334155' }];
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, 220, 220);

    data.forEach(item => {
      const sliceAngle = total > 0 ? (item.value / total) * 2 * Math.PI : 0;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-main') || '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Pengeluaran', centerX, centerY - 2);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#94a3b8';
    ctx.fillText(FinStore.formatCurrency(hasData ? total : 0), centerX, centerY + 18);

    const legendList = document.getElementById('donut-legend-list');
    if (legendList) {
      legendList.innerHTML = hasData
        ? data.map(item => `
          <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.8rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="width:8px; height:8px; border-radius:50%; background:${item.color};"></span>
              <span>${item.label}</span>
            </div>
            <span style="font-weight:600;">${total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
          </div>
        `).join('')
        : '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Belum ada pengeluaran untuk dianalisis.</p>';
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
