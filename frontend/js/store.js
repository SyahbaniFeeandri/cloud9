/**
 * FinCloud state store.
 *
 * All financial data now comes from the Express REST API. The store keeps an
 * in-memory cache so the view modules can stay simple, while every mutation
 * goes through the API and invalidates the cache.
 */

import { STORAGE_KEYS } from './config.js';
import {
  api,
  getToken as getStoredToken,
  setToken,
  clearToken,
  isTokenExpired,
  resolveReceiptUrl
} from './api.js';

const LEGACY_KEYS = [
  'fincloud_transactions',
  'fincloud_registered_users'
];

// Seed Categories conforming to docs/05-erd-draft.md. These names match the
// database seed, so they can be sent as the `category` field to the API.
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

function safeParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function toDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

export function normalizeTransaction(transaction) {
  if (!transaction) return null;

  return {
    ...transaction,
    id: transaction.id,
    type: transaction.type,
    amount: Number(transaction.amount) || 0,
    category: transaction.category || 'Other',
    description: transaction.description || '',
    date: toDateOnly(transaction.date),
    receipt: resolveReceiptUrl(transaction.receipt),
    receiptName: transaction.receiptName || null,
    createdAt: transaction.createdAt || null
  };
}

function normalizeDashboard(data) {
  if (!data) return null;

  return {
    ...data,
    currentBalance: Number(data.currentBalance) || 0,
    totalIncome: Number(data.totalIncome) || 0,
    totalExpense: Number(data.totalExpense) || 0,
    monthlyIncome: Number(data.monthlyIncome) || 0,
    monthlyExpense: Number(data.monthlyExpense) || 0,
    transactionCount: Number(data.transactionCount) || 0,
    topCategories: (data.topCategories || []).map((category) => ({
      ...category,
      total_amount: Number(category.total_amount) || 0
    })),
    recentTransactions: (data.recentTransactions || [])
      .map(normalizeTransaction)
      .filter(Boolean)
  };
}

export const FinStore = {
  _user: safeParse(localStorage.getItem(STORAGE_KEYS.USER)),
  _transactions: [],
  _transactionTotal: 0,
  _transactionSummary: { totalIncome: 0, totalExpense: 0 },
  _dashboard: null,
  _monthly: [],
  _categories: null,

  /* ---------------------------------------------------------------- */
  /* Session                                                          */
  /* ---------------------------------------------------------------- */

  clearLegacyMockData() {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  },

  getUser() {
    return this._user;
  },

  setUser(user) {
    this._user = user;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  getToken() {
    return getStoredToken();
  },

  isAuthenticated() {
    const token = getStoredToken();
    return Boolean(token) && !isTokenExpired(token) && Boolean(this._user);
  },

  setSession({ token, user }) {
    setToken(token);
    this.setUser(user);
    // Never reuse cached financial data across accounts.
    this._transactions = [];
    this._transactionTotal = 0;
    this._transactionSummary = { totalIncome: 0, totalExpense: 0 };
    this._dashboard = null;
    this._monthly = [];
  },

  clearSession() {
    clearToken();
    this.setUser(null);
    this._transactions = [];
    this._transactionTotal = 0;
    this._transactionSummary = { totalIncome: 0, totalExpense: 0 };
    this._dashboard = null;
    this._monthly = [];
  },

  async login(email, password) {
    const response = await api.auth.login(email, password);
    this.setSession({ token: response.token, user: response.user });
    this.clearLegacyMockData();
    return response.user;
  },

  async register(name, email, password) {
    const response = await api.auth.register(name, email, password);
    this.setSession({ token: response.token, user: response.user });
    this.clearLegacyMockData();
    return response.user;
  },

  async logout() {
    try {
      if (this.getToken()) {
        await api.auth.logout();
      }
    } catch (error) {
      // Best-effort: the local session is cleared even if the API is down.
    } finally {
      this.clearSession();
    }
  },

  async verifySession() {
    if (!this.isAuthenticated()) return null;

    const response = await api.auth.profile();
    this.setUser(response.user);
    return response.user;
  },

  async updateProfile({ name, email }) {
    const response = await api.auth.updateProfile({ name, email });
    this.setUser(response.user);
    return response.user;
  },

  /* ---------------------------------------------------------------- */
  /* Transactions                                                     */
  /* ---------------------------------------------------------------- */

  async loadTransactions(params = {}) {
    const response = await api.transactions.list(params);

    this._transactions = (response.transactions || [])
      .map(normalizeTransaction)
      .filter(Boolean);
    this._transactionTotal = Number(response.total ?? this._transactions.length) || 0;
    this._transactionSummary = {
      totalIncome: Number(response.summary?.totalIncome) || 0,
      totalExpense: Number(response.summary?.totalExpense) || 0
    };

    return this._transactions;
  },

  getTransactions() {
    return this._transactions;
  },

  getTransactionTotal() {
    return this._transactionTotal;
  },

  getTransactionSummary() {
    return this._transactionSummary;
  },

  toApiPayload(data) {
    return {
      type: data.type,
      amount: Number(data.amount),
      category: data.category,
      description: data.description,
      date: data.date
    };
  },

  async addTransaction(data) {
    const response = await api.transactions.create(this.toApiPayload(data));
    let receiptError = null;

    if (data.receiptFile) {
      try {
        await api.transactions.uploadReceipt(response.transactionId, data.receiptFile);
      } catch (error) {
        receiptError = error.message;
      }
    }

    this.invalidateData();
    return { ...response, receiptError };
  },

  async updateTransaction(id, data) {
    await api.transactions.update(id, this.toApiPayload(data));
    let receiptError = null;

    if (data.receiptFile) {
      try {
        await api.transactions.uploadReceipt(id, data.receiptFile);
      } catch (error) {
        receiptError = error.message;
      }
    } else if (data.removeReceipt) {
      try {
        await api.transactions.deleteReceipt(id);
      } catch (error) {
        receiptError = error.message;
      }
    }

    this.invalidateData();
    return { success: true, receiptError };
  },

  async deleteTransaction(id) {
    await api.transactions.remove(id);
    this._transactions = this._transactions.filter(
      (transaction) => String(transaction.id) !== String(id)
    );
    this._transactionTotal = Math.max(this._transactionTotal - 1, 0);
    this.invalidateData(false);
    return true;
  },

  async refreshReceiptUrl(id) {
    const response = await api.transactions.receiptUrl(id);
    return resolveReceiptUrl(response.url);
  },

  invalidateData(clearTransactions = true) {
    if (clearTransactions) this._transactions = [];
    this._dashboard = null;
    this._monthly = [];
  },

  /* ---------------------------------------------------------------- */
  /* Dashboard & reports                                              */
  /* ---------------------------------------------------------------- */

  async loadDashboard() {
    const response = await api.dashboard.get();
    this._dashboard = normalizeDashboard(response.data);
    return this._dashboard;
  },

  getDashboardData() {
    return this._dashboard;
  },

  async loadMonthlyReport(year = new Date().getFullYear()) {
    const response = await api.reports.monthly(year);
    this._monthly = (response.monthlyStats || []).map((row) => ({
      month: Number(row.month),
      income: Number(row.income) || 0,
      expense: Number(row.expense) || 0,
      count: Number(row.count) || 0
    }));
    return this._monthly;
  },

  getMonthlyReport() {
    return this._monthly;
  },

  async loadCategoryReport(params = {}) {
    const response = await api.reports.category(params);
    return (response.categories || []).map((category) => ({
      ...category,
      total_amount: Number(category.total_amount) || 0,
      transaction_count: Number(category.transaction_count) || 0
    }));
  },

  async loadCategories() {
    const response = await api.transactions.categories();
    this._categories = response.categories || [];
    return this._categories;
  },

  getCategories() {
    return this._categories;
  },

  async loadSystemHealth() {
    const health = await api.health.check();

    let adminStatus = null;
    if (this.getUser()?.role === 'ADMIN') {
      try {
        adminStatus = await api.admin.systemStatus();
      } catch (error) {
        adminStatus = null;
      }
    }

    return { health, adminStatus };
  },

  getFinancialMetrics(filterMonth = null) {
    let list = this._transactions;

    if (filterMonth) {
      list = list.filter((transaction) => transaction.date.startsWith(filterMonth));
    }

    const totalIncome = list
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const totalExpense = list
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const balance = totalIncome - totalExpense;
    const savingsRate =
      totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpense,
      balance,
      savingsRate: Math.max(0, savingsRate),
      transactionCount: list.length
    };
  },

  /* ---------------------------------------------------------------- */
  /* Theme & formatting                                               */
  /* ---------------------------------------------------------------- */

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';

    try {
      const parts = String(dateStr).slice(0, 10).split('-');
      if (parts.length === 3) {
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('id-ID', {
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
    } catch (error) {
      return dateStr;
    }
  }
};
