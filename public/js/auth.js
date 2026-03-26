'use strict';

// ═══════════════════════════════════════════════════════════
// AUTH.JS — Handles login, signup, logout, session check
// ═══════════════════════════════════════════════════════════

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').style.display = isLogin ? '' : 'none';
  document.getElementById('signupForm').style.display = isLogin ? 'none' : '';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabSignup').classList.toggle('active', !isLogin);
  document.getElementById('loginError').textContent = '';
  document.getElementById('signupError').textContent = '';
}

function setAuthError(formId, msg) {
  document.getElementById(formId + 'Error').textContent = msg;
}

function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'CONNECTING...' : (btnId === 'loginBtn' ? 'ACCESS SYSTEM' : 'INITIALIZE SYSTEM');
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { setAuthError('login', 'All fields required'); return; }

  setAuthLoading('loginBtn', true);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setAuthError('login', data.error || 'Login failed'); return; }
    onAuthSuccess(data.user);
  } catch {
    setAuthError('login', 'Connection error');
  } finally {
    setAuthLoading('loginBtn', false);
  }
}

async function doSignup() {
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  if (!email || !password) { setAuthError('signup', 'All fields required'); return; }
  if (password !== confirm) { setAuthError('signup', 'Passwords do not match'); return; }
  if (password.length < 6) { setAuthError('signup', 'Password must be at least 6 characters'); return; }

  setAuthLoading('signupBtn', true);
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setAuthError('signup', data.error || 'Signup failed'); return; }
    onAuthSuccess(data.user);
  } catch {
    setAuthError('signup', 'Connection error');
  } finally {
    setAuthLoading('signupBtn', false);
  }
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  // Clear state
  if (typeof resetAppState === 'function') resetAppState();
}

function onAuthSuccess(user) {
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = '';
  if (typeof initApp === 'function') initApp();
}

// ─── Check session on load ────────────────────────────────
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      onAuthSuccess(data.user);
    }
    // else: stay on auth screen
  } catch {
    // stay on auth screen
  }
}

// ─── Keyboard shortcuts for auth forms ───────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.getElementById('authScreen').style.display !== 'none') {
      const isLogin = document.getElementById('loginForm').style.display !== 'none';
      if (isLogin) doLogin();
      else doSignup();
    }
  }
});

// Boot
checkSession();
