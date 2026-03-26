'use strict';

// ═══════════════════════════════════════════════════════════
// APP.JS — All budget tracker logic (API-backed)
// ═══════════════════════════════════════════════════════════

// ─── STATE ────────────────────────────────────────────────
let state = {
  budget: 0,
  expenses: [],
  categories: [],
};

const NEON_COLORS = ['#00d4ff','#b347ff','#00fff5','#ff2d9b','#00ff88','#ff8c00','#ff6b35','#7fff00','#ff99cc','#33ccff'];
let colorIndex = 5;
let currentView = 'daily';
let prevRemaining = 0;

function resetAppState() {
  state = { budget: 0, expenses: [], categories: [] };
  prevRemaining = 0;
  colorIndex = 5;
}

// ─── API HELPERS ──────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);

  // session expired
  if (res.status === 401) {
    doLogout();
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── INIT (called after login) ────────────────────────────
async function initApp() {
  initBackground();
  updateHeader();

  try {
    await Promise.all([loadCategories(), loadBudget(), loadExpenses()]);
    updateAll(false); // false = don't re-fetch
    setTimeout(() => updateCharts(), 100);
  } catch (err) {
    showNotif('Failed to load data', 'error');
    console.error(err);
  }
}

// ─── LOADERS ─────────────────────────────────────────────
async function loadCategories() {
  state.categories = await api('GET', '/api/categories');
}

async function loadBudget() {
  const now = new Date();
  const data = await api('GET', `/api/budget?month=${now.getMonth()+1}&year=${now.getFullYear()}`);
  state.budget = data.amount;
}

async function loadExpenses() {
  const now = new Date();
  state.expenses = await api('GET', `/api/expenses?month=${now.getMonth()+1}&year=${now.getFullYear()}`);
}

// ─── NOTIFICATION ─────────────────────────────────────────
let notifTimer;
function showNotif(msg, type = 'success') {
  const el = document.getElementById('notif');
  el.className = 'notif' + (type !== 'success' ? ' ' + type : '');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── ANIMATED COUNTER ────────────────────────────────────
function animateNum(el, from, to, format, duration = 500) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
    const val = from + (to - from) * ease;
    el.textContent = format(val);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = format(to);
  }
  requestAnimationFrame(tick);
}

function fmtCurrency(n) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-₹' : '₹') + str;
}

// ─── DATE HELPERS ─────────────────────────────────────────
function getDaysInMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getDayOfMonth() { return new Date().getDate(); }
function getDaysLeft() { return getDaysInMonth() - getDayOfMonth(); }

function getTotalSpent() {
  return state.expenses.reduce((s, e) => s + e.amount, 0);
}

// ─── MAIN UPDATE ─────────────────────────────────────────
function updateAll(redraw = true) {
  updateHeader();
  updateBudgetStats();
  updateProgress();
  updateAnalytics();
  updatePrediction();
  updateCategoryList();
  updateTxList();
  if (redraw) updateCharts();
}

function updateHeader() {
  const now = new Date();
  document.getElementById('monthDisplay').textContent =
    now.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  document.getElementById('daysLeftChip').textContent = `${getDaysLeft()} DAYS LEFT`;
  document.getElementById('todayChip').textContent =
    now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function updateBudgetStats() {
  const spent = getTotalSpent();
  const remaining = state.budget - spent;
  const heroEl = document.getElementById('remainingHero');

  animateNum(document.getElementById('totalBudgetStat'), 0, state.budget, fmtCurrency);
  animateNum(document.getElementById('totalSpentStat'), 0, spent, fmtCurrency);
  animateNum(document.getElementById('remainingStat'), 0, remaining, fmtCurrency);

  const prevNum = prevRemaining;
  prevRemaining = remaining;
  animateNum(heroEl, prevNum, remaining, fmtCurrency, 600);
  heroEl.classList.add('amount-changing');
  setTimeout(() => heroEl.classList.remove('amount-changing'), 300);

  const pct = state.budget > 0 ? spent / state.budget : 0;
  let cls, statusTxt, dotColor;
  if (pct < 0.6) { cls = 'safe'; statusTxt = 'SYSTEM NOMINAL'; dotColor = 'var(--safe)'; }
  else if (pct < 0.85) { cls = 'warning'; statusTxt = 'CAUTION: APPROACHING LIMIT'; dotColor = 'var(--warning)'; }
  else { cls = 'danger'; statusTxt = 'WARNING: BUDGET CRITICAL'; dotColor = 'var(--danger)'; }

  heroEl.className = `remaining-amount ${cls}`;
  document.getElementById('statusText').textContent = statusTxt;
  const dot = document.getElementById('statusDot');
  dot.style.background = dotColor;
  dot.style.boxShadow = `0 0 8px ${dotColor}`;
}

function updateProgress() {
  const spent = getTotalSpent();
  const pct = state.budget > 0 ? Math.min((spent / state.budget) * 100, 100) : 0;
  const fill = document.getElementById('progressFill');
  const pctEl = document.getElementById('progressPct');
  fill.style.width = pct + '%';
  const cls = pct < 60 ? 'safe' : pct < 85 ? 'warning' : 'danger';
  fill.className = `progress-fill ${cls}`;
  pctEl.className = `progress-pct ${cls}`;
  pctEl.textContent = pct.toFixed(1) + '%';
}

function updateAnalytics() {
  const daysLeft = getDaysLeft();
  const daysPast = getDayOfMonth();
  const spent = getTotalSpent();
  const remaining = state.budget - spent;
  const dailyAllowed = daysLeft > 0 ? remaining / daysLeft : 0;
  const dailyAvg = daysPast > 0 ? spent / daysPast : 0;

  document.getElementById('daysLeftVal').textContent = daysLeft;
  document.getElementById('daysPastVal').textContent = daysPast;
  document.getElementById('dailyAllowVal').textContent = fmtCurrency(dailyAllowed);
  document.getElementById('dailyAvgVal').textContent = fmtCurrency(dailyAvg);

  const avgCard = document.getElementById('dailyAvgCard');
  const allowCard = document.getElementById('dailyAllowCard');
  avgCard.className = 'analytics-card';
  allowCard.className = 'analytics-card';
  if (dailyAvg > dailyAllowed && dailyAllowed > 0) avgCard.classList.add('alert-card');
  else if (dailyAvg <= dailyAllowed && dailyAllowed > 0) allowCard.classList.add('good-card');
}

function updatePrediction() {
  const daysPast = getDayOfMonth();
  const daysInMonth = getDaysInMonth();
  const spent = getTotalSpent();
  if (daysPast === 0 || spent === 0) {
    document.getElementById('projSpend').textContent = '─';
    document.getElementById('projLeft').textContent = '─';
    return;
  }
  const dailyAvg = spent / daysPast;
  const projected = dailyAvg * daysInMonth;
  const projLeft = state.budget - projected;
  const projSpendEl = document.getElementById('projSpend');
  const projLeftEl = document.getElementById('projLeft');
  projSpendEl.textContent = fmtCurrency(projected);
  projLeftEl.textContent = fmtCurrency(projLeft);
  projSpendEl.style.color = projected > state.budget ? 'var(--neon-red)' : 'var(--neon-cyan)';
  projLeftEl.style.color = projLeft < 0 ? 'var(--neon-red)' : 'var(--safe)';
}

// ─── CHARTS ───────────────────────────────────────────────
function updateCharts() {
  if (currentView === 'daily') drawLineChart();
  else drawCategoryBarChart();
  drawPieChart();
}

function switchView(v, btn) {
  currentView = v;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateCharts();
}

function drawLineChart() {
  const canvas = document.getElementById('lineChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = 220;
  ctx.clearRect(0, 0, W, H);

  const daysInMonth = getDaysInMonth();
  const today = getDayOfMonth();
  const dailySpend = new Array(daysInMonth).fill(0);

  state.expenses.forEach(e => {
    const day = new Date(e.date + 'T00:00:00').getDate() - 1;
    if (day >= 0 && day < daysInMonth) dailySpend[day] += e.amount;
  });

  const pad = { top: 20, right: 20, bottom: 30, left: 60 };
  const gW = W - pad.left - pad.right;
  const gH = H - pad.top - pad.bottom;
  const maxY = Math.max(...dailySpend, state.budget / daysInMonth * 1.5, 100);
  const xPos = i => pad.left + (i / (daysInMonth - 1)) * gW;
  const yPos = v => pad.top + gH - (v / maxY) * gH;

  // Grid
  ctx.strokeStyle = 'rgba(0,212,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * gH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + gW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'right';
    ctx.fillText(fmtCurrency(maxY * (1 - i/4)).replace('₹',''), pad.left - 6, y + 4);
  }

  // X labels
  ctx.fillStyle = 'rgba(0,212,255,0.4)';
  ctx.font = '9px Share Tech Mono';
  ctx.textAlign = 'center';
  for (let i = 0; i < daysInMonth; i += 5) {
    ctx.fillText(i + 1, xPos(i), H - 8);
  }

  // Budget line
  const budgetPerDay = state.budget / daysInMonth;
  if (budgetPerDay > 0) {
    const by = yPos(budgetPerDay);
    ctx.strokeStyle = 'rgba(0,255,136,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, by); ctx.lineTo(pad.left + gW, by); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Projected
  if (today > 1) {
    const totalSpent = dailySpend.slice(0, today).reduce((a,b) => a+b, 0);
    const dailyAvg = totalSpent / today;
    ctx.strokeStyle = 'rgba(179,71,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xPos(today - 1), yPos(dailyAvg));
    ctx.lineTo(xPos(daysInMonth - 1), yPos(dailyAvg));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Actual fill
  if (today > 0) {
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + gH);
    grad.addColorStop(0, 'rgba(0,212,255,0.3)');
    grad.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(dailySpend[0]));
    for (let i = 1; i < today; i++) {
      const x0 = xPos(i-1), y0 = yPos(dailySpend[i-1]);
      const x1 = xPos(i), y1 = yPos(dailySpend[i]);
      const cx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
    }
    ctx.lineTo(xPos(today - 1), yPos(0));
    ctx.lineTo(xPos(0), yPos(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(dailySpend[0]));
    for (let i = 1; i < today; i++) {
      const x0 = xPos(i-1), y0 = yPos(dailySpend[i-1]);
      const x1 = xPos(i), y1 = yPos(dailySpend[i]);
      const cx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
    }
    ctx.strokeStyle = 'var(--neon-blue)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'var(--neon-blue)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = 0; i < today; i++) {
      if (dailySpend[i] > 0) {
        ctx.beginPath();
        ctx.arc(xPos(i), yPos(dailySpend[i]), 3, 0, Math.PI*2);
        ctx.fillStyle = 'var(--neon-blue)';
        ctx.shadowColor = 'var(--neon-blue)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

function drawCategoryBarChart() {
  const canvas = document.getElementById('lineChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = 220;
  ctx.clearRect(0, 0, W, H);

  const catTotals = {};
  state.categories.forEach(c => catTotals[c.id] = 0);
  state.expenses.forEach(e => {
    if (e.categoryId && catTotals[e.categoryId] !== undefined) catTotals[e.categoryId] += e.amount;
  });

  const cats = state.categories.filter(c => catTotals[c.id] > 0);
  if (cats.length === 0) {
    ctx.fillStyle = 'rgba(0,212,255,0.3)';
    ctx.font = '14px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText('NO DATA YET', W/2, H/2);
    return;
  }

  const maxVal = Math.max(...cats.map(c => catTotals[c.id]));
  const pad = { top: 20, right: 20, bottom: 50, left: 60 };
  const gW = W - pad.left - pad.right;
  const gH = H - pad.top - pad.bottom;
  const barW = Math.min(gW / cats.length * 0.6, 60);
  const gap = gW / cats.length;

  cats.forEach((cat, i) => {
    const val = catTotals[cat.id];
    const barH = (val / maxVal) * gH;
    const x = pad.left + i * gap + gap/2 - barW/2;
    const y = pad.top + gH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, cat.color);
    grad.addColorStop(1, cat.color + '40');
    ctx.fillStyle = grad;
    ctx.shadowColor = cat.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, barW, barH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = cat.color;
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText(cat.name.slice(0,7), x + barW/2, pad.top + gH + 20);
    ctx.fillText(fmtCurrency(val), x + barW/2, y - 6);
  });
}

function drawPieChart() {
  const canvas = document.getElementById('pieCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 160 * dpr; canvas.height = 160 * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, 160, 160);

  const catTotals = {};
  state.categories.forEach(c => catTotals[c.id] = 0);
  state.expenses.forEach(e => {
    if (e.categoryId && catTotals[e.categoryId] !== undefined) catTotals[e.categoryId] += e.amount;
  });

  const total = Object.values(catTotals).reduce((a,b) => a+b, 0);
  const legend = document.getElementById('pieLegend');

  if (total === 0) {
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(80, 80, 55, 0, Math.PI * 2);
    ctx.stroke();
    legend.innerHTML = '<div class="pie-legend-item" style="justify-content:center;color:var(--text-dim)">No data yet</div>';
    return;
  }

  let startAngle = -Math.PI / 2;
  legend.innerHTML = '';

  state.categories.forEach(cat => {
    const val = catTotals[cat.id];
    if (val === 0) return;
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(80, 80);
    ctx.arc(80, 80, 60, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = cat.color + 'cc';
    ctx.shadowColor = cat.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += slice;

    const pct = ((val / total) * 100).toFixed(1);
    legend.innerHTML += `<div class="pie-legend-item">
      <div class="pie-legend-dot" style="background:${cat.color};box-shadow:0 0 5px ${cat.color}"></div>
      <span>${cat.name}</span>
      <span class="pie-legend-pct">${pct}%</span>
    </div>`;
  });

  ctx.beginPath();
  ctx.arc(80, 80, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#050d14';
  ctx.fill();

  ctx.fillStyle = 'rgba(0,212,255,0.6)';
  ctx.font = 'bold 11px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText(fmtCurrency(total).replace('₹',''), 80, 77);
  ctx.font = '8px Share Tech Mono';
  ctx.fillStyle = 'rgba(0,212,255,0.4)';
  ctx.fillText('SPENT', 80, 90);
}

// ─── CATEGORIES ───────────────────────────────────────────
function updateCategoryList() {
  const list = document.getElementById('categoryList');
  list.innerHTML = '';
  state.categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'category-item';
    row.innerHTML = `
      <div class="cat-dot" style="background:${cat.color};box-shadow:0 0 6px ${cat.color}"></div>
      <span class="cat-name" id="catName_${cat.id}">${cat.name}</span>
      <div class="cat-actions">
        <button class="cat-btn" onclick="renameCategory(${cat.id})">REN</button>
        <button class="cat-btn del" onclick="deleteCategory(${cat.id})">DEL</button>
      </div>
    `;
    list.appendChild(row);
  });
}

async function addCategory() {
  const input = document.getElementById('newCatInput');
  const name = input.value.trim();
  if (!name) { showNotif('Enter a category name', 'error'); return; }

  const color = NEON_COLORS[colorIndex % NEON_COLORS.length];
  colorIndex++;

  try {
    const cat = await api('POST', '/api/categories', { name, color });
    state.categories.push(cat);
    input.value = '';
    updateAll();
    showNotif(`Category "${name}" added`);
  } catch (err) {
    showNotif(err.message || 'Failed to add category', 'error');
  }
}

function renameCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  const nameEl = document.getElementById('catName_' + id);
  const oldName = cat.name;
  nameEl.outerHTML = `<input class="cat-name-input" id="catNameEdit_${id}" value="${oldName}"
    onblur="finishRename(${id}, this.value)"
    onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.value='${oldName}';this.blur();}">`;
  document.getElementById('catNameEdit_' + id)?.focus();
}

async function finishRename(id, newName) {
  newName = newName.trim();
  if (!newName) { updateCategoryList(); return; }
  try {
    const updated = await api('PATCH', `/api/categories/${id}`, { name: newName });
    const cat = state.categories.find(c => c.id === id);
    if (cat) cat.name = updated.name;
    // Also update expenses in state
    state.expenses.forEach(e => { if (e.categoryId === id) e.categoryName = updated.name; });
    updateAll();
    showNotif('Category renamed');
  } catch (err) {
    showNotif(err.message || 'Rename failed', 'error');
    updateCategoryList();
  }
}

async function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  try {
    await api('DELETE', `/api/categories/${id}`);
    state.categories = state.categories.filter(c => c.id !== id);
    updateAll();
    showNotif(`Category "${cat?.name}" deleted`);
  } catch (err) {
    showNotif(err.message || 'Cannot delete category', 'error');
  }
}

// ─── TRANSACTION LIST ─────────────────────────────────────
function updateTxList() {
  const list = document.getElementById('txList');
  const expenses = [...state.expenses].reverse();
  document.getElementById('txCount').textContent = expenses.length + ' entries';

  if (expenses.length === 0) {
    list.innerHTML = '<div class="empty-state">[ NO TRANSACTIONS THIS MONTH ]</div>';
    return;
  }

  list.innerHTML = '';
  expenses.forEach(exp => {
    const color = exp.categoryColor || '#888';
    const row = document.createElement('div');
    row.className = 'tx-item';
    row.innerHTML = `
      <div class="tx-dot" style="background:${color};box-shadow:0 0 5px ${color}"></div>
      <div class="tx-cat">${exp.categoryName || 'Uncategorized'}</div>
      <div class="tx-desc">${exp.description || '—'}</div>
      <div class="tx-date">${formatDate(exp.date)}</div>
      <div class="tx-amount">${fmtCurrency(exp.amount)}</div>
      <button class="tx-del" onclick="deleteExpense(${exp.id})" title="Delete">✕</button>
    `;
    list.appendChild(row);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

async function deleteExpense(id) {
  try {
    await api('DELETE', `/api/expenses/${id}`);
    state.expenses = state.expenses.filter(e => e.id !== id);
    updateAll();
    showNotif('Expense removed', 'warning');
  } catch (err) {
    showNotif(err.message || 'Failed to delete', 'error');
  }
}

// ─── BUDGET CONTROL ───────────────────────────────────────
async function setBudget() {
  const val = parseFloat(document.getElementById('budgetInput').value);
  if (isNaN(val) || val <= 0) { showNotif('Enter a valid budget', 'error'); return; }

  try {
    const data = await api('PUT', '/api/budget', { amount: val });
    state.budget = data.amount;
    document.getElementById('budgetInput').value = '';
    updateAll();
    showNotif(`Budget set to ${fmtCurrency(val)}`);
  } catch (err) {
    showNotif(err.message || 'Failed to set budget', 'error');
  }
}

async function resetAll() {
  if (!confirm('Reset budget to 0 and clear all this month\'s expenses? This cannot be undone.')) return;
  try {
    // Delete all expenses for this month
    const deletePromises = state.expenses.map(e => api('DELETE', `/api/expenses/${e.id}`));
    await Promise.all(deletePromises);
    // Reset budget
    await api('PUT', '/api/budget', { amount: 0 });
    state.expenses = [];
    state.budget = 0;
    prevRemaining = 0;
    updateAll();
    showNotif('System reset complete', 'warning');
  } catch (err) {
    showNotif(err.message || 'Reset failed', 'error');
  }
}

// ─── MODAL ────────────────────────────────────────────────
function openModal() {
  const select = document.getElementById('expCategory');
  select.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
  document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expAmount').value = '';
  document.getElementById('expDesc').value = '';
  document.getElementById('modalOverlay').classList.add('active');
  setTimeout(() => document.getElementById('expAmount').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

async function addExpense() {
  const amount = parseFloat(document.getElementById('expAmount').value);
  if (isNaN(amount) || amount <= 0) { showNotif('Enter a valid amount', 'error'); return; }
  const categoryId = parseInt(document.getElementById('expCategory').value) || null;
  const date = document.getElementById('expDate').value;
  const description = document.getElementById('expDesc').value.trim();
  if (!date) { showNotif('Select a date', 'error'); return; }

  const btn = document.getElementById('expSubmitBtn');
  btn.disabled = true;

  try {
    const exp = await api('POST', '/api/expenses', { amount, categoryId, date, description });
    state.expenses.push(exp);
    closeModal();
    updateAll();
    showNotif(`${fmtCurrency(amount)} added to ${exp.categoryName}`);
  } catch (err) {
    showNotif(err.message || 'Failed to add expense', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── BACKGROUND CANVAS ────────────────────────────────────
function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (canvas._initialized) return;
  canvas._initialized = true;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: ['#00d4ff','#b347ff','#00fff5'][Math.floor(Math.random()*3)]
    });
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,212,255,0.03)';
    ctx.lineWidth = 1;
    const gs = 60;
    for (let x = 0; x < canvas.width; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * (0.7 + 0.3 * Math.sin(t * 0.02 + p.x));
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });
    ctx.lineWidth = 0.3;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist/100)})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    t++;
    requestAnimationFrame(draw);
  }
  draw();
}

// ─── RESIZE HANDLER ───────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => updateCharts(), 200);
});

// ─── KEYBOARD ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (document.getElementById('appScreen').style.display === 'none') return;
  if (e.key === 'Escape') closeModal();
  if (e.key === 'n' && !document.getElementById('modalOverlay').classList.contains('active')) openModal();
  if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('active')) addExpense();
});

document.getElementById('budgetInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') setBudget();
});
