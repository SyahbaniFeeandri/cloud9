/**
 * FinCloud Reactive State Management & Storage
 * Handles user sessions, transaction CRUD, Indonesian currency formatting,
 * and persistent storage via localStorage.
 */

const STORAGE_KEYS = {
  USER: 'fincloud_current_user',
  THEME: 'fincloud_theme',
  TRANSACTIONS: 'fincloud_transactions',
  ACCOUNTS: 'fincloud_registered_users'
};

// Seed Categories conforming to docs/05-erd-draft.md
export const CATEGORIES = {
  income: [
    { id: 'cat-inc-1', name: 'Salary', icon: 'briefcase', color: '#10b981' },
    { id: 'cat-inc-2', name: 'Business', icon: 'trending-up', color: '#06b6d4' },
    { id: 'cat-inc-3', name: 'Investment', icon: 'dollar-sign', color: '#8b5cf6' },
    { id: 'cat-inc-4', name: 'Bonus', icon: 'award', color: '#f59e0b' },
    { id: 'cat-inc-5', name: 'Other', icon: 'plus-circle', color: '#64748b' }
  ],
  expense: [
    { id: 'cat-exp-1', name: 'Food', icon: 'utensils', color: '#f43f5e' },
    { id: 'cat-exp-2', name: 'Transportation', icon: 'car', color: '#f97316' },
    { id: 'cat-exp-3', name: 'Housing', icon: 'home', color: '#eab308' },
    { id: 'cat-exp-4', name: 'Education', icon: 'book', color: '#3b82f6' },
    { id: 'cat-exp-5', name: 'Healthcare', icon: 'activity', color: '#ec4899' },
    { id: 'cat-exp-6', name: 'Entertainment', icon: 'film', color: '#a855f7' },
    { id: 'cat-exp-7', name: 'Shopping', icon: 'shopping-bag', color: '#06b6d4' },
    { id: 'cat-exp-8', name: 'Utilities', icon: 'zap', color: '#14b8a6' },
    { id: 'cat-exp-9', name: 'Other', icon: 'more-horizontal', color: '#64748b' }
  ]
};

// Default Sample Seed Data
const DEFAULT_TRANSACTIONS = [
  {
    id: 'tx-101',
    type: 'income',
    amount: 15000000,
    category: 'Salary',
    description: 'Gaji Bulanan Software Engineer Cloud9',
    date: '2026-10-01',
    receipt: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    receiptName: 'slip-gaji-okt-2026.pdf',
    createdAt: '2026-10-01T09:00:00Z'
  },
  {
    id: 'tx-102',
    type: 'expense',
    amount: 3200000,
    category: 'Housing',
    description: 'Sewa Apartemen & Maintenance Bulanan',
    date: '2026-10-02',
    receipt: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
    receiptName: 'invoice-apt-oct.jpg',
    createdAt: '2026-10-02T10:15:00Z'
  },
  {
    id: 'tx-103',
    type: 'expense',
    amount: 850000,
    category: 'Utilities',
    description: 'Tagihan Listrik PLN & Internet Fiber 100Mbps',
    date: '2026-10-03',
    receipt: null,
    receiptName: null,
    createdAt: '2026-10-03T11:30:00Z'
  },
  {
    id: 'tx-104',
    type: 'expense',
    amount: 1250000,
    category: 'Food',
    description: 'Belanja Mingguan Supermarket & Bahan Makanan',
    date: '2026-10-04',
    receipt: 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=600&auto=format&fit=crop&q=80',
    receiptName: 'struk-supermarket.jpg',
    createdAt: '2026-10-04T15:20:00Z'
  },
  {
    id: 'tx-105',
    type: 'income',
    amount: 4500000,
    category: 'Business',
    description: 'Jasa Konsultasi Arsitektur Cloud AWS & DevOps',
    date: '2026-10-05',
    receipt: null,
    receiptName: null,
    createdAt: '2026-10-05T14:00:00Z'
  },
  {
    id: 'tx-106',
    type: 'expense',
    amount: 420000,
    category: 'Transportation',
    description: 'Bensin Pertamax & Saldo Tol Elektronik',
    date: '2026-10-05',
    receipt: null,
    receiptName: null,
    createdAt: '2026-10-05T17:45:00Z'
  },
  {
    id: 'tx-107',
    type: 'expense',
    amount: 350000,
    category: 'Healthcare',
    description: 'Suplemen Vitamin & Pemeriksaan Rutin',
    date: '2026-10-06',
    receipt: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    receiptName: 'resep-apotek-kimia.jpg',
    createdAt: '2026-10-06T12:10:00Z'
  },
  {
    id: 'tx-108',
    type: 'expense',
    amount: 280000,
    category: 'Entertainment',
    description: 'Langganan Cloud Storage, Spotify, & Cinema',
    date: '2026-10-07',
    receipt: null,
    receiptName: null,
    createdAt: '2026-10-07T16:00:00Z'
  },
  {
    id: 'tx-109',
    type: 'income',
    amount: 1200000,
    category: 'Investment',
    description: 'Dividen Saham Finansial & Kupon Obligasi Negara',
    date: '2026-09-28',
    receipt: null,
    receiptName: null,
    createdAt: '2026-09-28T08:30:00Z'
  },
  {
    id: 'tx-110',
    type: 'expense',
    amount: 750000,
    category: 'Shopping',
    description: 'Buku Pemrograman Cloud Native & Keyboard Mouse',
    date: '2026-09-25',
    receipt: null,
    receiptName: null,
    createdAt: '2026-09-25T13:40:00Z'
  }
];

export const FinStore = {
  // Current user state
  getUser() {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Default demo user
    return {
      id: 1,
      name: 'Feeandri',
      email: 'feeandri@fincloud.app',
      role: 'USER'
    };
  },

  setUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  // Theme state
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  // Transactions State
  getTransactions() {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed parsing stored transactions', e);
      }
    }
    this.saveTransactions(DEFAULT_TRANSACTIONS);
    return DEFAULT_TRANSACTIONS;
  },

  saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  addTransaction(data) {
    const list = this.getTransactions();
    const newTx = {
      id: 'tx-' + Date.now(),
      type: data.type || 'expense',
      amount: parseFloat(data.amount) || 0,
      category: data.category || 'Other',
      description: data.description || 'Transaksi FinCloud',
      date: data.date || new Date().toISOString().split('T')[0],
      receipt: data.receipt || null,
      receiptName: data.receiptName || null,
      createdAt: new Date().toISOString()
    };
    list.unshift(newTx);
    this.saveTransactions(list);
    return newTx;
  },

  updateTransaction(id, updatedData) {
    const list = this.getTransactions();
    const idx = list.findIndex(t => t.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatedData, updatedAt: new Date().toISOString() };
      this.saveTransactions(list);
      return list[idx];
    }
    return null;
  },

  deleteTransaction(id) {
    const list = this.getTransactions();
    const filtered = list.filter(t => t.id !== id);
    this.saveTransactions(filtered);
    return true;
  },

  // Financial Calculations
  getFinancialMetrics(filterMonth = null) {
    let list = this.getTransactions();
    if (filterMonth) {
      list = list.filter(t => t.date.startsWith(filterMonth));
    }

    const totalIncome = list
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = list
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpense,
      balance,
      savingsRate: Math.max(0, savingsRate),
      transactionCount: list.length
    };
  },

  // System Health mock (Postgres, MinIO, Prometheus)
  getSystemHealth() {
    return {
      api: { status: 'ONLINE', latency: '24ms' },
      postgres: { status: 'ONLINE', pool: '8/20' },
      minio: { status: 'ONLINE', storage: '2.4 GB / 100 GB' },
      monitoring: { status: 'ACTIVE', exporter: 'Prometheus v2.45' }
    };
  },

  // Formatting Utilities
  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }
};
