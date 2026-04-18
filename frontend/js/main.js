/* ════════════════════════════════════════════════════════════
   MAIN.JS — Shared utilities
   ════════════════════════════════════════════════════════════ */

const API = 'http://localhost:3001/api';

// ─── Auth helpers ─────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('cg_token'),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('cg_user')); } catch { return null; }
  },
  isLoggedIn: () => !!localStorage.getItem('cg_token'),
  save: (token, user) => {
    localStorage.setItem('cg_token', token);
    localStorage.setItem('cg_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('cg_token');
    localStorage.removeItem('cg_user');
  },
  logout: () => {
    Auth.clear();
    window.location.href = '/index.html';
  }
};

// ─── API helper ───────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error inesperado');
  return data;
}

// ─── Toast notifications ──────────────────────────────────
function showToast(title, message = '', type = 'default') {
  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D5A" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    default: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B5895A" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.default}</span>
    <div>
      <div class="toast__title">${title}</div>
      ${message ? `<div class="toast__msg">${message}</div>` : ''}
    </div>`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

// ─── Scroll animations ────────────────────────────────────
function initScrollAnimations() {
  const els = document.querySelectorAll('.fade-up');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

// ─── Nav: dynamic auth state ──────────────────────────────
function initNav() {
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    navAuth.innerHTML = `
      <a href="/dashboard.html" class="btn btn--outline btn--sm">Mi cuenta</a>
      <button onclick="Auth.logout()" class="btn btn--ghost btn--sm">Salir</button>`;
  } else {
    navAuth.innerHTML = `
      <a href="/login.html" class="btn btn--ghost btn--sm">Ingresar</a>
      <a href="/signup.html" class="btn btn--primary btn--sm">Reservar turno</a>`;
  }

  // Mobile nav auth
  const mobileAuth = document.getElementById('mobile-nav-auth');
  if (mobileAuth) {
    if (Auth.isLoggedIn()) {
      mobileAuth.innerHTML = `
        <a href="/dashboard.html">Mi cuenta</a>
        <a href="#" onclick="Auth.logout()">Cerrar sesión</a>`;
    } else {
      mobileAuth.innerHTML = `
        <a href="/login.html">Ingresar</a>
        <a href="/signup.html">Reservar turno</a>`;
    }
  }
}

// ─── Nav hamburger ────────────────────────────────────────
function initHamburger() {
  const btn = document.getElementById('nav-hamburger');
  const menu = document.getElementById('nav-mobile');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', menu.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
}

// ─── Mark active nav link ─────────────────────────────────
function markActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && (href.includes(page) || (page === 'index.html' && href === '/index.html'))) {
      a.classList.add('active');
    }
  });
}

// ─── Set loading state on button ─────────────────────────
function setLoading(btn, loading) {
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

// ─── Format date ──────────────────────────────────────────
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
    full: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  };
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHamburger();
  markActiveNav();
  initScrollAnimations();
});
