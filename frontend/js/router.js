/**
 * FinCloud Client-side Router
 * Manages URL hash navigation between Auth, Dashboard, Transactions, and Reports.
 */

import { FinStore } from './store.js';

export const routes = {
  '/login': { title: 'Masuk - FinCloud', authRequired: false },
  '/register': { title: 'Daftar Akun - FinCloud', authRequired: false },
  '/dashboard': { title: 'Dashboard Finansial - FinCloud', authRequired: true },
  '/transactions': { title: 'Daftar Transaksi - FinCloud', authRequired: true },
  '/reports': { title: 'Laporan Keuangan - FinCloud', authRequired: true },
  '/profile': { title: 'Profil Pengguna - FinCloud', authRequired: true }
};

class Router {
  constructor() {
    this.currentRoute = null;
    this.listeners = [];
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRouting());
    // Initial route
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    } else {
      this.handleRouting();
    }
  }

  onRouteChange(callback) {
    this.listeners.push(callback);
  }

  navigate(path) {
    window.location.hash = '#' + path;
  }

  handleRouting() {
    let hash = window.location.hash.slice(1) || '/dashboard';
    if (!routes[hash]) {
      hash = '/dashboard';
    }

    const routeConfig = routes[hash];
    const user = FinStore.getUser();

    // Check auth guards
    if (routeConfig.authRequired && !user) {
      this.navigate('/login');
      return;
    }

    if (!routeConfig.authRequired && user && (hash === '/login' || hash === '/register')) {
      // Already logged in, redirect to dashboard
      this.navigate('/dashboard');
      return;
    }

    this.currentRoute = hash;
    document.title = routeConfig.title;

    // Notify subscribers
    this.listeners.forEach(cb => cb(hash, user));
  }
}

export const router = new Router();
