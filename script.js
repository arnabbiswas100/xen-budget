/* =========================================================
   Budget Tracker — script.js
   Vanilla JS, localStorage-based personal finance tracker
   ========================================================= */

'use strict';

// ===========================================================
//  1. CONSTANTS & DEFAULT DATA
// ===========================================================

const DEFAULT_CATEGORIES = [
  { name: 'Food',          subCategories: ['Breakfast','Lunch','Dinner','Snacks','Coffee'] },
  { name: 'Groceries',     subCategories: ['Vegetables','Fruits','Dairy','Household'] },
  { name: 'Transport',     subCategories: ['Auto','Cab','Fuel','Bus','Metro'] },
  { name: 'Bills',         subCategories: ['Electricity','Water','Internet','Phone','Rent'] },
  { name: 'Shopping',      subCategories: ['Clothing','Electronics','Online'] },
  { name: 'Entertainment', subCategories: ['Movies','Streaming','Gaming','Events'] },
  { name: 'Education',     subCategories: ['Books','Course','Stationery','Fees'] },
  { name: 'Health',        subCategories: ['Medicine','Doctor','Gym','Insurance'] },
  { name: 'Travel',        subCategories: ['Hotel','Flight','Train','Local'] },
  { name: 'Other',         subCategories: ['Miscellaneous'] },
];

// Warm palette: olive greens → caramel browns → beige/gold tones
const CHART_COLORS = [
  '#8da85c', // olive green
  '#c4956a', // warm caramel brown
  '#a8c472', // light sage
  '#d8aa80', // soft tan
  '#6a8840', // deep olive
  '#e8c8a0', // cream
  '#8a5a36', // mahogany
  '#b4d090', // pale sage
  '#b08040', // golden brown
  '#5c7a38', // forest olive
];

const LS_KEY_DATA   = 'budgetTracker_v2_data';
const LS_KEY_PREFS  = 'budgetTracker_v2_prefs';

// ===========================================================
//  2. STATE
// ===========================================================

let state = {
  // Keyed by "YYYY-MM" → { budget, expenses[] }
  months: {},
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  categoryBudgets: {},   // { "Food": 5000, ... }
  currency: '₹',
  theme: 'dark',
  currentMonth: '',      // "YYYY-MM"
};

let activeFilter = { category: '', search: '', sort: 'date-desc' };
let activeCatFilter = '';
let chartInstances = {};

// ===========================================================
//  3. STORAGE HELPERS
// ===========================================================

function saveData() {
  try {
    localStorage.setItem(LS_KEY_DATA, JSON.stringify({
      months: state.months,
      categories: state.categories,
      categoryBudgets: state.categoryBudgets,
    }));
    localStorage.setItem(LS_KEY_PREFS, JSON.stringify({
      currency: state.currency,
      theme: state.theme,
      currentMonth: state.currentMonth,
    }));
  } catch(e) {
    showToast('Storage full or unavailable.', 'error');
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.months         = parsed.months         || {};
      state.categories     = parsed.categories     || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      state.categoryBudgets= parsed.categoryBudgets|| {};
    }
    const prefs = localStorage.getItem(LS_KEY_PREFS);
    if (prefs) {
      const p = JSON.parse(prefs);
      state.currency    = p.currency    || '₹';
      state.theme       = p.theme       || 'dark';
      state.currentMonth= p.currentMonth|| todayMonthKey();
    } else {
      state.currentMonth = todayMonthKey();
    }
  } catch(e) {
    console.warn('Failed to load localStorage data, resetting.', e);
    state.currentMonth = todayMonthKey();
  }
}

// ===========================================================
//  4. DATE HELPERS
// ===========================================================

function todayMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function elapsedDaysInMonth(key) {
  const today = new Date();
  const [y, m] = key.split('-').map(Number);
  if (today.getFullYear() === y && today.getMonth()+1 === m) {
    return today.getDate();
  }
  const totalDays = daysInMonth(key);
  // Past month → all days elapsed; future → 0
  const monthStart = new Date(y, m-1, 1);
  return today >= monthStart ? totalDays : 0;
}

function remainingDaysInMonth(key) {
  const total = daysInMonth(key);
  const elapsed = elapsedDaysInMonth(key);
  return Math.max(0, total - elapsed);
}

function isCurrentMonth(key) {
  return key === todayMonthKey();
}

function isPastMonth(key) {
  return key < todayMonthKey();
}

function parseDateStr(dateStr) {
  // "YYYY-MM-DD"
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d);
}

function dayOfMonth(dateStr) {
  return parseInt(dateStr.split('-')[2], 10);
}

// ===========================================================
//  5. MONTH DATA ACCESSORS
// ===========================================================

function getMonthData(key) {
  if (!state.months[key]) {
    state.months[key] = { budget: 0, expenses: [] };
  }
  return state.months[key];
}

function getCurrentMonthData() {
  return getMonthData(state.currentMonth);
}

// ===========================================================
//  6. CURRENCY / NUMBER FORMATTING
// ===========================================================

function fmt(amount) {
  const sym = state.currency;
  const n = Math.abs(amount);
  // Indian numbering
  const parts = n.toFixed(2).split('.');
  let intPart = parts[0];
  let result = '';
  if (intPart.length > 3) {
    result = ',' + intPart.slice(-3);
    intPart = intPart.slice(0, -3);
    while (intPart.length > 2) {
      result = ',' + intPart.slice(-2) + result;
      intPart = intPart.slice(0, -2);
    }
    result = intPart + result;
  } else {
    result = intPart;
  }
  // Drop paise if .00
  const fmtNum = parts[1] === '00' ? result : result + '.' + parts[1];
  return (amount < 0 ? '-' : '') + sym + fmtNum;
}

function fmtShort(amount) {
  if (Math.abs(amount) >= 1_00_000) return state.currency + (amount/1_00_000).toFixed(1) + 'L';
  if (Math.abs(amount) >= 1_000)   return state.currency + (amount/1_000).toFixed(1) + 'K';
  return fmt(amount);
}

// ===========================================================
//  7. CALCULATIONS
// ===========================================================

function calcTotalSpent(key) {
  const data = getMonthData(key);
  return data.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

function calcBalance(key) {
  const data = getMonthData(key);
  return (parseFloat(data.budget) || 0) - calcTotalSpent(key);
}

function calcDailyAverage(key) {
  const elapsed = elapsedDaysInMonth(key);
  if (elapsed === 0) return 0;
  return calcTotalSpent(key) / elapsed;
}

function calcRecommendedDaily(key, asOfDay) {
  // asOfDay: 1-indexed day number within the month (optional; defaults to today)
  const data = getMonthData(key);
  const budget = parseFloat(data.budget) || 0;
  const [y, m] = key.split('-').map(Number);
  const total = daysInMonth(key);

  let elapsed, spent;
  if (asOfDay === undefined || asOfDay === null) {
    elapsed = elapsedDaysInMonth(key);
    spent = calcTotalSpent(key);
  } else {
    // Calculate spent up to and NOT including asOfDay
    elapsed = asOfDay - 1;
    spent = data.expenses
      .filter(e => dayOfMonth(e.date) < asOfDay)
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  }

  const remaining = Math.max(0, budget - spent);
  const remainingDays = total - elapsed;
  if (remainingDays <= 0) return 0;
  return remaining / remainingDays;
}

function calcProjectedBalance(key) {
  const dailyAvg = calcDailyAverage(key);
  const remaining = remainingDaysInMonth(key);
  const balance = calcBalance(key);
  if (dailyAvg === 0) return balance;
  const projected = balance - (dailyAvg * remaining);
  return projected;
}

function calcCategoryBreakdown(key) {
  const data = getMonthData(key);
  const map = {};
  data.expenses.forEach(e => {
    const cat = e.category || 'Other';
    if (!map[cat]) map[cat] = { total: 0, count: 0 };
    map[cat].total += parseFloat(e.amount) || 0;
    map[cat].count++;
  });
  const totalSpent = calcTotalSpent(key);
  return Object.entries(map).map(([name, d]) => ({
    name,
    total: d.total,
    count: d.count,
    pct: totalSpent > 0 ? (d.total / totalSpent * 100) : 0,
    avg: d.count > 0 ? d.total / d.count : 0,
    budget: state.categoryBudgets[name] || 0,
  })).sort((a,b) => b.total - a.total);
}

function calcDailyTotals(key) {
  const data = getMonthData(key);
  const days = daysInMonth(key);
  const totals = {};
  for (let i = 1; i <= days; i++) totals[i] = 0;
  data.expenses.forEach(e => {
    const d = dayOfMonth(e.date);
    if (d >= 1 && d <= days) totals[d] += parseFloat(e.amount) || 0;
  });
  return totals;
}

function calcOverspendingDays(key) {
  const dailyTotals = calcDailyTotals(key);
  const [y, m] = key.split('-').map(Number);
  let count = 0;
  Object.entries(dailyTotals).forEach(([day, total]) => {
    if (total === 0) return;
    const rec = calcRecommendedDaily(key, parseInt(day, 10));
    if (total > rec && rec > 0) count++;
  });
  return count;
}

// ===========================================================
//  8. EXPENSE CRUD
// ===========================================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addExpense(expObj) {
  const data = getMonthData(state.currentMonth);
  // Calculate historical recommended daily at that date
  const day = dayOfMonth(expObj.date);
  const recAtTime = calcRecommendedDaily(state.currentMonth, day);
  expObj.id = generateId();
  expObj.recAtTime = recAtTime;
  expObj.amount = parseFloat(expObj.amount) || 0;
  data.expenses.push(expObj);
  data.expenses.sort((a,b) => a.date.localeCompare(b.date));
  saveData();
  renderAll();
  showToast('Expense added.', 'success');
}

function updateExpense(id, updates) {
  const data = getMonthData(state.currentMonth);
  const idx = data.expenses.findIndex(e => e.id === id);
  if (idx === -1) return;
  // Preserve historical recAtTime; only recalculate if date changed
  const prev = data.expenses[idx];
  if (updates.date !== prev.date) {
    const day = dayOfMonth(updates.date);
    updates.recAtTime = calcRecommendedDaily(state.currentMonth, day);
  } else {
    updates.recAtTime = prev.recAtTime;
  }
  updates.amount = parseFloat(updates.amount) || 0;
  data.expenses[idx] = { ...prev, ...updates };
  data.expenses.sort((a,b) => a.date.localeCompare(b.date));
  saveData();
  renderAll();
  showToast('Expense updated.', 'success');
}

function deleteExpense(id) {
  const data = getMonthData(state.currentMonth);
  data.expenses = data.expenses.filter(e => e.id !== id);
  saveData();
  renderAll();
  showToast('Expense deleted.', 'info');
}

// ===========================================================
//  9. RECURRING EXPENSES
// ===========================================================

function getRecurringExpenses() {
  const allExpenses = [];
  Object.entries(state.months).forEach(([key, monthData]) => {
    (monthData.expenses || []).forEach(e => {
      if (e.recurring) allExpenses.push({ ...e, _fromMonth: key });
    });
  });
  // Deduplicate by template (same category+subcategory+amount+note)
  const seen = new Map();
  allExpenses.forEach(e => {
    const sig = `${e.category}|${e.subCategory}|${e.amount}|${e.note}`;
    if (!seen.has(sig)) seen.set(sig, e);
  });
  return Array.from(seen.values());
}

function applyRecurringToCurrentMonth() {
  const recurring = getRecurringExpenses();
  if (!recurring.length) { showToast('No recurring expenses found.', 'info'); return; }
  const data = getCurrentMonthData();
  const today = todayStr();
  let added = 0;
  recurring.forEach(template => {
    // Build a date for current month using same day
    const [y, m] = state.currentMonth.split('-');
    const origDay = dayOfMonth(template.date);
    const maxDay  = daysInMonth(state.currentMonth);
    const day     = Math.min(origDay, maxDay);
    const dateStr = `${y}-${m}-${String(day).padStart(2,'0')}`;
    // Check if already added (same cat+sub+date)
    const exists = data.expenses.some(e =>
      e.recurring && e.category === template.category &&
      e.subCategory === template.subCategory && e.date === dateStr
    );
    if (!exists) {
      const recAtTime = calcRecommendedDaily(state.currentMonth, day);
      data.expenses.push({
        id: generateId(),
        date: dateStr,
        category: template.category,
        subCategory: template.subCategory,
        amount: template.amount,
        note: template.note + ' (recurring)',
        recurring: true,
        recAtTime,
      });
      added++;
    }
  });
  data.expenses.sort((a,b) => a.date.localeCompare(b.date));
  saveData();
  renderAll();
  showToast(added > 0 ? `${added} recurring expense(s) added.` : 'Recurring expenses already applied.', 'info');
}

// ===========================================================
//  10. INSIGHTS GENERATOR
// ===========================================================

function generateInsights(key) {
  const data = getMonthData(key);
  const budget = parseFloat(data.budget) || 0;
  const spent = calcTotalSpent(key);
  const balance = budget - spent;
  const pct = budget > 0 ? (spent / budget * 100) : 0;
  const dailyAvg = calcDailyAverage(key);
  const dailyRec = calcRecommendedDaily(key);
  const projected = calcProjectedBalance(key);
  const catBreakdown = calcCategoryBreakdown(key);
  const overspendDays = calcOverspendingDays(key);
  const elapsed = elapsedDaysInMonth(key);
  const remaining = remainingDaysInMonth(key);

  const insights = [];

  if (budget === 0) {
    insights.push({ text: 'Set a monthly budget to start tracking your spending.', type: 'neutral' });
    return insights;
  }

  if (data.expenses.length === 0) {
    insights.push({ text: 'No expenses recorded yet. Add your first expense to see insights.', type: 'neutral' });
    return insights;
  }

  // Budget consumption
  if (pct >= 100) {
    insights.push({ text: `You have exceeded your monthly budget by ${fmt(spent - budget)}.`, type: 'bad' });
  } else if (pct >= 80) {
    insights.push({ text: `You have used ${pct.toFixed(1)}% of your monthly budget. Only ${fmt(balance)} left!`, type: 'warn' });
  } else {
    insights.push({ text: `You have spent ${pct.toFixed(1)}% of your ${fmt(budget)} budget.`, type: 'good' });
  }

  // Daily average
  if (elapsed > 0) {
    insights.push({ text: `Your average daily spending is ${fmt(dailyAvg)}.`, type: 'neutral' });
  }

  // Recommended daily
  if (remaining > 0) {
    if (dailyRec > 0) {
      const tone = dailyAvg > dailyRec * 1.15 ? 'warn' : 'good';
      insights.push({ text: `You can spend approximately ${fmt(dailyRec)}/day for the rest of the month.`, type: tone });
    }
  }

  // Projected end-of-month
  if (elapsed > 0 && remaining > 0) {
    if (projected < 0) {
      insights.push({ text: `At your current rate, you are projected to exceed your budget by ${fmt(Math.abs(projected))}.`, type: 'bad' });
    } else {
      insights.push({ text: `You are projected to end the month with ${fmt(projected)} remaining.`, type: projected > budget * 0.1 ? 'good' : 'warn' });
    }
  }

  // Top category
  if (catBreakdown.length > 0) {
    const top = catBreakdown[0];
    insights.push({ text: `${top.name} is your highest spending category at ${fmt(top.total)} (${top.pct.toFixed(1)}% of spending).`, type: 'neutral' });
  }

  // Overspending days
  if (overspendDays > 0) {
    insights.push({ text: `You had ${overspendDays} day(s) where spending exceeded the daily recommendation.`, type: overspendDays >= 5 ? 'bad' : 'warn' });
  }

  // Category budget warnings
  catBreakdown.forEach(cat => {
    if (cat.budget > 0 && cat.total >= cat.budget * 0.9) {
      if (cat.total >= cat.budget) {
        insights.push({ text: `${cat.name} limit exceeded: ${fmt(cat.total)} of ${fmt(cat.budget)} limit.`, type: 'bad' });
      } else {
        insights.push({ text: `${cat.name} is at ${((cat.total/cat.budget)*100).toFixed(0)}% of its ${fmt(cat.budget)} limit.`, type: 'warn' });
      }
    }
  });

  return insights;
}

// ===========================================================
//  11. RENDER FUNCTIONS — DASHBOARD
// ===========================================================

function renderBudgetHero() {
  const key = state.currentMonth;
  const data = getMonthData(key);
  const budget = parseFloat(data.budget) || 0;
  const spent  = calcTotalSpent(key);
  const balance= budget - spent;
  const pct    = budget > 0 ? Math.min(100, (spent / budget * 100)) : 0;

  document.getElementById('hero-budget').textContent    = fmt(budget);
  document.getElementById('hero-spent').textContent     = fmt(spent);
  document.getElementById('hero-remaining').textContent = fmt(balance);

  // Remaining colour
  const remEl = document.getElementById('hero-remaining');
  remEl.className = 'hero-amount ' + (balance >= 0 ? 'positive' : 'negative');

  // Progress bar
  const fill = document.getElementById('budget-progress-fill');
  fill.style.width = pct + '%';
  fill.className = 'progress-bar-fill' + (pct >= 100 ? ' danger' : pct >= 80 ? ' warning' : '');
  document.getElementById('progress-pct-label').textContent = pct.toFixed(1) + '% of budget used';

  const bar = document.querySelector('.progress-bar-wrap');
  if (bar) { bar.setAttribute('aria-valuenow', pct.toFixed(0)); }

  // Donut chart
  document.getElementById('donut-pct').textContent = pct.toFixed(0) + '%';
  renderBudgetDonut(pct, budget, spent);
}

function renderBudgetDonut(pct, budget, spent) {
  const canvas = document.getElementById('budget-donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartInstances['budget-donut']) {
    chartInstances['budget-donut'].destroy();
  }

  const remaining = Math.max(0, budget - spent);
  const over      = Math.max(0, spent - budget);
  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const usedColor  = pct >= 100 ? '#c47070' : pct >= 80 ? '#d4a84b' : '#8da85c';
  const restColor  = isDark ? 'rgba(240,215,168,0.10)' : 'rgba(160,130,80,0.12)';

  chartInstances['budget-donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: budget > 0 ? [spent, remaining] : [1, 0],
        backgroundColor: budget > 0 ? [usedColor, restColor] : [restColor, restColor],
        borderWidth: 0,
        hoverBorderWidth: 0,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 600 },
    }
  });
}

function renderMetricsStrip() {
  const key = state.currentMonth;
  const elapsed  = elapsedDaysInMonth(key);
  const remaining= remainingDaysInMonth(key);
  const dailyAvg = calcDailyAverage(key);
  const dailyRec = calcRecommendedDaily(key);
  const projected= calcProjectedBalance(key);
  const data     = getMonthData(key);

  document.getElementById('val-daily-avg').textContent  = fmt(dailyAvg);
  document.getElementById('sub-daily-avg').textContent  = `based on ${elapsed} day${elapsed!==1?'s':''}`;

  const recEl = document.getElementById('val-daily-rec');
  recEl.textContent = fmt(dailyRec);
  recEl.className = 'metric-value ' + (dailyRec >= calcDailyAverage(key) * 1.05 ? 'green' : dailyRec > 0 ? 'amber' : 'red');
  document.getElementById('sub-daily-rec').textContent = `${remaining} day${remaining!==1?'s':''} remaining`;

  const projEl = document.getElementById('val-projected');
  projEl.textContent = fmt(projected);
  projEl.className   = 'metric-value ' + (projected >= 0 ? 'green' : 'red');

  document.getElementById('val-txn-count').textContent  = data.expenses.length;
  document.getElementById('sub-txn-count').textContent  = 'this month';
}

function renderInsights() {
  const insights = generateInsights(state.currentMonth);
  const ul = document.getElementById('insights-list');
  ul.innerHTML = insights.map(ins => {
    const cls = { good: 'insight-good', warn: 'insight-warn', bad: 'insight-bad', neutral: 'insight-neutral' }[ins.type] || 'insight-neutral';
    return `<li class="insight-item ${cls}">${ins.text}</li>`;
  }).join('');
}

function renderCategoryAnalysis() {
  const breakdown = calcCategoryBreakdown(state.currentMonth);
  const list = document.getElementById('category-list');

  if (breakdown.length === 0) {
    list.innerHTML = '<p class="empty-state">No expenses yet. Add an expense to see category breakdown.</p>';
    return;
  }

  list.innerHTML = breakdown.map((cat, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const hasBudget = cat.budget > 0;
    const budgetPct = hasBudget ? Math.min(100, (cat.total / cat.budget * 100)) : null;
    const isOverCatBudget = hasBudget && cat.total > cat.budget;
    const isWarnCatBudget = hasBudget && !isOverCatBudget && budgetPct > 80;

    const barFillColor = isOverCatBudget ? '#f87171' : isWarnCatBudget ? '#fbbf24' : color;
    const activeClass = activeCatFilter === cat.name ? ' active-filter' : '';

    return `
      <div class="cat-item${activeClass}" data-cat="${escHtml(cat.name)}" role="button" tabindex="0"
           aria-label="Filter by ${escHtml(cat.name)}" title="Click to filter">
        <div class="cat-name-wrap">
          <span class="cat-name">${escHtml(cat.name)}</span>
          <span class="cat-meta">${cat.count} txn · avg ${fmtShort(cat.avg)}</span>
          ${isOverCatBudget ? `<span class="cat-warn">Limit exceeded</span>` : ''}
          ${isWarnCatBudget ? `<span class="cat-warn">Near limit</span>` : ''}
        </div>
        <div class="cat-bar-wrap">
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${cat.pct.toFixed(1)}%;background:${color}"></div>
          </div>
          ${hasBudget ? `
          <div class="cat-bar-track" style="margin-top:3px">
            <div class="cat-bar-fill" style="width:${budgetPct.toFixed(1)}%;background:${barFillColor}"></div>
          </div>
          <span class="cat-bar-meta">${fmt(cat.total)} / ${fmt(cat.budget)} budget</span>
          ` : `<span class="cat-bar-meta">${cat.pct.toFixed(1)}% of total spending</span>`}
        </div>
        <div class="cat-amount-wrap">
          <div class="cat-amount">${fmt(cat.total)}</div>
          <div class="cat-pct">${cat.pct.toFixed(1)}%</div>
        </div>
      </div>`;
  }).join('');

  // Click to filter
  list.querySelectorAll('.cat-item').forEach(el => {
    const handler = () => {
      const cat = el.dataset.cat;
      if (activeCatFilter === cat) {
        activeCatFilter = '';
        activeFilter.category = '';
      } else {
        activeCatFilter = cat;
        activeFilter.category = cat;
        document.getElementById('filter-category').value = cat;
      }
      renderCategoryAnalysis();
      renderExpensesTab();
      switchTab('expenses');
    };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

function renderHeatmap() {
  const key = state.currentMonth;
  const wrap = document.getElementById('heatmap-wrap');
  const dailyTotals = calcDailyTotals(key);
  const days = daysInMonth(key);
  const [y, m] = key.split('-').map(Number);
  const firstDayOfWeek = new Date(y, m-1, 1).getDay(); // 0=Sun
  const today = new Date();
  const todayDay = isCurrentMonth(key) ? today.getDate() : null;

  // Max for heat scale
  const vals = Object.values(dailyTotals).filter(v => v > 0);
  const maxVal = vals.length ? Math.max(...vals) : 1;

  // Recommended daily for scaling
  const rec = calcRecommendedDaily(key) || 1;

  // Day-of-week headers
  const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dayHeaders.map(d => `<div class="heatmap-day-label">${d}</div>`).join('');

  // Empty cells for alignment
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div class="heatmap-cell empty-cell"></div>`;
  }

  for (let d = 1; d <= days; d++) {
    const val = dailyTotals[d] || 0;
    const ratio = val / Math.max(maxVal, 1);
    let heatLevel = 0;
    if (val > 0) {
      if (ratio < 0.15)       heatLevel = 1;
      else if (ratio < 0.35)  heatLevel = 2;
      else if (ratio < 0.6)   heatLevel = 3;
      else if (ratio < 0.85)  heatLevel = 4;
      else                    heatLevel = 5;
    }
    // Overspending gets at least heat-4
    if (val > rec && val > 0) heatLevel = Math.max(heatLevel, 4);

    const isToday = d === todayDay;
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += `
      <div class="heatmap-cell heat-${heatLevel}${isToday ? ' today-cell' : ''}"
           title="${dateStr}: ${val > 0 ? fmt(val) : 'No spending'}"
           aria-label="Day ${d}: ${val > 0 ? fmt(val) : 'No spending'}">
        <span class="cell-day">${d}</span>
        ${val > 0 ? `<span class="cell-amt">${fmtShort(val)}</span>` : ''}
      </div>`;
  }

  if (vals.length === 0) {
    wrap.innerHTML = '<p class="empty-state">No expenses for this month yet.</p>';
  } else {
    wrap.innerHTML = html;
  }
}

function renderMonthSummary() {
  const key = state.currentMonth;
  const banner = document.getElementById('month-summary-banner');
  if (!isPastMonth(key)) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  const data = getMonthData(key);
  const budget = parseFloat(data.budget) || 0;
  const spent = calcTotalSpent(key);
  const balance = budget - spent;
  const dailyAvg = calcDailyAverage(key);
  const cats = calcCategoryBreakdown(key);
  const dailyTotals = calcDailyTotals(key);
  const overDays = calcOverspendingDays(key);

  const topCat = cats.length ? cats[0].name : '—';
  const dailyEntries = Object.entries(dailyTotals).filter(([,v]) => v > 0);
  const topDay = dailyEntries.length
    ? dailyEntries.reduce((a,b) => b[1] > a[1] ? b : a, dailyEntries[0])
    : null;

  const items = [
    { label: 'Budget', val: fmt(budget) },
    { label: 'Total Spent', val: fmt(spent) },
    { label: 'Remaining', val: fmt(balance) },
    { label: 'Daily Average', val: fmt(dailyAvg) },
    { label: 'Top Category', val: topCat },
    { label: 'Highest Day', val: topDay ? `Day ${topDay[0]} (${fmt(topDay[1])})` : '—' },
    { label: 'Overspend Days', val: overDays.toString() },
    { label: 'Transactions', val: data.expenses.length.toString() },
  ];

  document.getElementById('summary-grid').innerHTML = items.map(it => `
    <div class="summary-item">
      <div class="summary-item-label">${it.label}</div>
      <div class="summary-item-val">${it.val}</div>
    </div>`).join('');
}

// ===========================================================
//  12. RENDER — EXPENSES TAB
// ===========================================================

function getFilteredExpenses() {
  const data = getMonthData(state.currentMonth);
  let list = [...data.expenses];

  if (activeFilter.category) {
    list = list.filter(e => e.category === activeFilter.category);
  }
  if (activeFilter.search) {
    const q = activeFilter.search.toLowerCase();
    list = list.filter(e =>
      (e.category||'').toLowerCase().includes(q) ||
      (e.subCategory||'').toLowerCase().includes(q) ||
      (e.note||'').toLowerCase().includes(q) ||
      String(e.amount).includes(q)
    );
  }

  const sort = activeFilter.sort;
  list.sort((a,b) => {
    if (sort === 'date-desc') return b.date.localeCompare(a.date);
    if (sort === 'date-asc')  return a.date.localeCompare(b.date);
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc')  return a.amount - b.amount;
    return 0;
  });

  return list;
}

function renderExpensesTab() {
  const list = getFilteredExpenses();
  const tbody = document.getElementById('expenses-tbody');
  const totalFiltered = list.reduce((s,e) => s + e.amount, 0);

  // Update filter count
  document.getElementById('expense-count-label').textContent = `${list.length} record${list.length!==1?'s':''}`;
  document.getElementById('footer-total').textContent = fmt(totalFiltered);

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><p class="empty-state">No expenses match the current filters.</p></td></tr>`;
    renderExpenseCards(list);
    return;
  }

  tbody.innerHTML = list.map(e => {
    const over = e.recAtTime > 0 && e.amount > e.recAtTime;
    const overAmt = over ? e.amount - e.recAtTime : 0;
    const statusHtml = over
      ? `<span class="over-badge" title="${fmt(e.amount)} spent · Rec: ${fmt(e.recAtTime)} · ${fmt(overAmt)} over">
           ${fmt(overAmt)} over
         </span>`
      : `<span class="ok-badge">On track</span>`;

    return `<tr class="${over ? 'over-limit' : ''}" data-id="${e.id}">
      <td>${formatDateDisplay(e.date)}</td>
      <td><span class="cat-chip">${escHtml(e.category||'—')}</span></td>
      <td>${escHtml(e.subCategory||'—')}</td>
      <td class="amount-cell">${fmt(e.amount)}${e.recurring ? '<span class="recurring-badge" title="Recurring">↻</span>' : ''}</td>
      <td>${escHtml(e.note||'—')}</td>
      <td>${statusHtml}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit-btn" data-id="${e.id}" aria-label="Edit expense">Edit</button>
          <button class="action-btn delete-btn" data-id="${e.id}" aria-label="Delete expense">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Bind action buttons
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditExpenseModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });

  renderExpenseCards(list);
}

function renderExpenseCards(list) {
  const wrap = document.getElementById('expense-cards');
  if (list.length === 0) {
    wrap.innerHTML = '<p class="empty-state">No expenses match the current filters.</p>';
    return;
  }
  wrap.innerHTML = list.map(e => {
    const over = e.recAtTime > 0 && e.amount > e.recAtTime;
    return `<div class="expense-card ${over ? 'over-limit' : ''}" data-id="${e.id}" role="listitem">
      <div class="card-top">
        <div>
          <div class="card-cat">${escHtml(e.category||'—')} ${e.subCategory ? `· <small>${escHtml(e.subCategory)}</small>` : ''}</div>
          <div class="card-date">${formatDateDisplay(e.date)}</div>
        </div>
        <div class="card-amount">${fmt(e.amount)}</div>
      </div>
      ${e.note ? `<div class="card-note">📝 ${escHtml(e.note)}</div>` : ''}
      ${over ? `<div class="card-note" style="color:var(--red);margin-top:4px">⚠ ${fmt(e.amount - e.recAtTime)} over daily rec (was ${fmt(e.recAtTime)})</div>` : ''}
      <div class="card-actions">
        <button class="action-btn edit-btn" data-id="${e.id}">Edit</button>
        <button class="action-btn delete-btn" data-id="${e.id}">Delete</button>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditExpenseModal(btn.dataset.id));
  });
  wrap.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
}

function formatDateDisplay(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const date = new Date(y, m-1, d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===========================================================
//  13. RENDER — ANALYTICS
// ===========================================================

function renderAnalytics() {
  renderCategoryChart();
  renderBudgetVsChart();
  renderDailyBarChart();
  renderTrendChart();
}

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function getChartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    gridColor:    isDark ? 'rgba(240,215,168,0.08)' : 'rgba(100,70,30,0.08)',
    labelColor:   isDark ? '#c8a878'                : '#7a5a38',
    tooltipBg:    isDark ? '#1e1508'                : '#fdf8f0',
    tooltipColor: isDark ? '#f2e6ce'                : '#2a1a08',
    tooltipBdr:   isDark ? 'rgba(240,215,168,0.18)' : 'rgba(160,120,70,0.22)',
  };
}

function renderCategoryChart() {
  destroyChart('chart-category');
  const breakdown = calcCategoryBreakdown(state.currentMonth);
  const canvas = document.getElementById('chart-category');
  const d = getChartDefaults();

  if (!breakdown.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  chartInstances['chart-category'] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: breakdown.map(c => c.name),
      datasets: [{
        data: breakdown.map(c => c.total),
        backgroundColor: breakdown.map((_,i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: 'transparent',
        hoverBorderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: d.labelColor, font: { family: 'Inter', size: 12 }, boxWidth: 14, padding: 10 },
        },
        tooltip: {
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipColor,
          bodyColor: d.labelColor,
          borderColor: d.tooltipBdr,
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
          }
        }
      }
    }
  });
}

function renderBudgetVsChart() {
  destroyChart('chart-budget-vs');
  const key = state.currentMonth;
  const budget = parseFloat(getMonthData(key).budget) || 0;
  const spent = calcTotalSpent(key);
  const balance = Math.max(0, budget - spent);
  const canvas = document.getElementById('chart-budget-vs');
  const d = getChartDefaults();

  chartInstances['chart-budget-vs'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Budget', 'Spent', 'Remaining'],
      datasets: [{
        data: [budget, spent, balance],
        backgroundColor: ['#8da85c', '#c4956a', '#b4d090'],
        borderRadius: 10,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipColor,
          bodyColor: d.labelColor,
          borderColor: d.tooltipBdr,
          borderWidth: 1,
          callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: d.labelColor, font: { family: 'Inter' } } },
        y: {
          grid: { color: d.gridColor },
          ticks: {
            color: d.labelColor, font: { family: 'Inter' },
            callback: v => fmtShort(v),
          },
          beginAtZero: true,
        }
      }
    }
  });
}

function renderDailyBarChart() {
  destroyChart('chart-daily');
  const key = state.currentMonth;
  const dailyTotals = calcDailyTotals(key);
  const days = daysInMonth(key);
  const labels = [];
  const values = [];
  const colors = [];
  const rec = calcRecommendedDaily(key);
  const canvas = document.getElementById('chart-daily');
  const d = getChartDefaults();

  for (let i = 1; i <= days; i++) {
    labels.push(i);
    const val = dailyTotals[i] || 0;
    values.push(val);
    colors.push(val > rec && rec > 0 ? '#c4956a' : '#8da85c');
  }

  chartInstances['chart-daily'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Daily Spending',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipColor,
          bodyColor: d.labelColor,
          borderColor: d.tooltipBdr,
          borderWidth: 1,
          callbacks: {
            title: ctx => `Day ${ctx[0].label}`,
            label: ctx => ` ${fmt(ctx.parsed.y)}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: d.labelColor, font: { family: 'Inter', size: 11 }, maxTicksLimit: 15 },
        },
        y: {
          grid: { color: d.gridColor },
          ticks: { color: d.labelColor, font: { family: 'Inter' }, callback: v => fmtShort(v) },
          beginAtZero: true,
        }
      }
    }
  });
}

function renderTrendChart() {
  destroyChart('chart-trend');
  const key = state.currentMonth;
  const dailyTotals = calcDailyTotals(key);
  const days = daysInMonth(key);
  const budget = parseFloat(getMonthData(key).budget) || 0;
  const canvas = document.getElementById('chart-trend');
  const d = getChartDefaults();

  const labels = [];
  const cumValues = [];
  let cum = 0;
  const elapsed = elapsedDaysInMonth(key);

  for (let i = 1; i <= days; i++) {
    labels.push(i);
    if (i <= elapsed) {
      cum += (dailyTotals[i] || 0);
      cumValues.push(cum);
    } else {
      cumValues.push(null);
    }
  }

  const budgetLine = Array(days).fill(budget);

  chartInstances['chart-trend'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cumulative Spending',
          data: cumValues,
          borderColor: '#8da85c',
          backgroundColor: 'rgba(141,168,92,0.12)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#8da85c',
          fill: true,
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: 'Budget Limit',
          data: budgetLine,
          borderColor: '#c4956a',
          borderWidth: 1.8,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: d.labelColor, font: { family: 'Inter', size: 12 }, boxWidth: 16 },
        },
        tooltip: {
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipColor,
          bodyColor: d.labelColor,
          borderColor: d.tooltipBdr,
          borderWidth: 1,
          callbacks: {
            title: ctx => `Day ${ctx[0].label}`,
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: d.labelColor, font: { family: 'Inter', size: 11 }, maxTicksLimit: 15 },
        },
        y: {
          grid: { color: d.gridColor },
          ticks: { color: d.labelColor, font: { family: 'Inter' }, callback: v => fmtShort(v) },
          beginAtZero: true,
        }
      }
    }
  });
}

// ===========================================================
//  14. RENDER — SETTINGS
// ===========================================================

function renderSettings() {
  renderCategoryManager();
  renderRecurringList();
  document.getElementById('currency-symbol').value = state.currency;
}

function renderCategoryManager() {
  const wrap = document.getElementById('cat-manage-wrap');
  wrap.innerHTML = state.categories.map(cat => {
    const isDefault = DEFAULT_CATEGORIES.some(d => d.name === cat.name);
    return `
    <div class="cat-manage-item" data-cat="${escHtml(cat.name)}">
      <span>${escHtml(cat.name)}</span>
      <small style="color:var(--text-3);font-size:0.7rem">
        ${(cat.subCategories||[]).length} sub-cat${(cat.subCategories||[]).length !== 1 ? 's' : ''}
      </small>
      <button class="action-btn edit-cat-btn" data-cat="${escHtml(cat.name)}" aria-label="Edit ${escHtml(cat.name)}">Edit</button>
      ${!isDefault
        ? `<button class="action-btn delete-btn delete-cat-btn" data-cat="${escHtml(cat.name)}" aria-label="Delete ${escHtml(cat.name)}">Delete</button>`
        : ''}
    </div>`;
  }).join('');

  wrap.querySelectorAll('.edit-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => openCategoryEditModal(btn.dataset.cat));
  });

  wrap.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm(
        `Delete category "${btn.dataset.cat}"? This cannot be undone.`,
        () => {
          const name = btn.dataset.cat;
          state.categories = state.categories.filter(c => c.name !== name);
          saveData();
          renderSettings();
          populateCategoryDropdowns();
          showToast('Category removed.', 'info');
        },
        'Delete'
      );
    });
  });
}

function renderRecurringList() {
  const recurring = getRecurringExpenses();
  const wrap = document.getElementById('recurring-list');
  if (!recurring.length) {
    wrap.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted)">No recurring expenses yet. Mark an expense as recurring when adding it.</p>';
    return;
  }
  wrap.innerHTML = recurring.map(e => `
    <div class="recurring-item">
      <span><strong>${escHtml(e.category)}</strong>${e.subCategory ? ' · '+escHtml(e.subCategory) : ''} — <strong>${fmt(e.amount)}</strong></span>
      <span style="font-size:0.72rem;color:var(--text-muted)">Day ${dayOfMonth(e.date)} monthly</span>
    </div>`).join('');
}

// ===========================================================
//  15. MODALS — EXPENSE
// ===========================================================

function openAddExpenseModal() {
  document.getElementById('expense-modal-title').textContent = 'Add Expense';
  document.getElementById('expense-id').value = '';
  document.getElementById('expense-date').value = todayStr();
  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-category').value = state.categories[0]?.name || '';
  document.getElementById('expense-subcategory').value = '';
  document.getElementById('expense-note').value = '';
  document.getElementById('expense-recurring').checked = false;
  updateSubcategoryDatalist();
  updateRecHint();
  showModal('expense-modal-overlay');
  document.getElementById('expense-amount').focus();
}

function openEditExpenseModal(id) {
  const data = getMonthData(state.currentMonth);
  const exp = data.expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('expense-modal-title').textContent = 'Edit Expense';
  document.getElementById('expense-id').value = exp.id;
  document.getElementById('expense-date').value = exp.date;
  document.getElementById('expense-amount').value = exp.amount;
  document.getElementById('expense-category').value = exp.category;
  document.getElementById('expense-subcategory').value = exp.subCategory || '';
  document.getElementById('expense-note').value = exp.note || '';
  document.getElementById('expense-recurring').checked = exp.recurring || false;
  updateSubcategoryDatalist();
  updateRecHint();
  showModal('expense-modal-overlay');
  document.getElementById('expense-amount').focus();
}

function updateSubcategoryDatalist() {
  const cat = document.getElementById('expense-category').value;
  const found = state.categories.find(c => c.name === cat);
  const dl = document.getElementById('subcategory-datalist');
  dl.innerHTML = (found ? found.subCategories : []).map(s => `<option value="${escHtml(s)}"></option>`).join('');
}

function updateRecHint() {
  const hint = document.getElementById('rec-daily-hint');
  const dateVal = document.getElementById('expense-date').value;
  const amtVal  = parseFloat(document.getElementById('expense-amount').value) || 0;
  if (!dateVal) { hint.classList.add('hidden'); return; }

  const [ey, em] = dateVal.split('-').map(Number);
  const key = `${ey}-${String(em).padStart(2,'0')}`;
  const day = dayOfMonth(dateVal);
  const rec = calcRecommendedDaily(key, day);

  if (rec <= 0) { hint.classList.add('hidden'); return; }

  hint.classList.remove('hidden');
  if (amtVal > 0 && amtVal > rec) {
    hint.textContent = `⚠ Amount exceeds the daily recommendation of ${fmt(rec)} for this day (${fmt(amtVal - rec)} over).`;
    hint.style.background = 'var(--red-soft)';
    hint.style.color = 'var(--red)';
  } else {
    hint.textContent = `Daily recommendation on this date: ${fmt(rec)}.`;
    hint.style.background = 'var(--amber-soft)';
    hint.style.color = 'var(--amber)';
  }
}

function handleExpenseFormSubmit(e) {
  e.preventDefault();
  const id     = document.getElementById('expense-id').value;
  const date   = document.getElementById('expense-date').value;
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const cat    = document.getElementById('expense-category').value;
  const sub    = document.getElementById('expense-subcategory').value.trim();
  const note   = document.getElementById('expense-note').value.trim();
  const recur  = document.getElementById('expense-recurring').checked;

  // Validation
  if (!date) { showToast('Please select a date.', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount.', 'error'); return; }
  if (!cat) { showToast('Please select a category.', 'error'); return; }

  const obj = { date, amount, category: cat, subCategory: sub, note, recurring: recur };

  if (id) {
    updateExpense(id, obj);
  } else {
    addExpense(obj);
  }

  hideModal('expense-modal-overlay');
}

// ===========================================================
//  16. MODALS — BUDGET
// ===========================================================

function openBudgetModal() {
  const data = getCurrentMonthData();
  document.getElementById('budget-input').value = data.budget || '';
  showModal('budget-modal-overlay');
  document.getElementById('budget-input').focus();
}

function handleBudgetFormSubmit(e) {
  e.preventDefault();
  const val = parseFloat(document.getElementById('budget-input').value);
  if (isNaN(val) || val < 0) { showToast('Please enter a valid budget.', 'error'); return; }
  const data = getCurrentMonthData();
  data.budget = val;
  saveData();
  renderAll();
  hideModal('budget-modal-overlay');
  showToast('Budget updated.', 'success');
}

// ===========================================================
//  17. MODALS — CATEGORY BUDGETS
// ===========================================================

function openCatBudgetModal() {
  const listEl = document.getElementById('cat-budget-list');
  listEl.innerHTML = state.categories.map(cat => `
    <div class="cat-budget-row">
      <label for="catbgt-${escHtml(cat.name)}">${escHtml(cat.name)}</label>
      <input type="number" id="catbgt-${escHtml(cat.name)}"
             class="text-input" placeholder="No limit" min="0" step="1"
             value="${state.categoryBudgets[cat.name] || ''}"
             aria-label="${escHtml(cat.name)} budget limit" />
    </div>`).join('');
  showModal('cat-budget-modal-overlay');
}

function saveCatBudgets() {
  state.categories.forEach(cat => {
    const input = document.getElementById(`catbgt-${cat.name}`);
    if (input) {
      const val = parseFloat(input.value);
      if (!isNaN(val) && val > 0) {
        state.categoryBudgets[cat.name] = val;
      } else {
        delete state.categoryBudgets[cat.name];
      }
    }
  });
  saveData();
  renderAll();
  hideModal('cat-budget-modal-overlay');
  showToast('Category limits saved.', 'success');
}

// ===========================================================
//  18. CONFIRM DIALOG
// ===========================================================

let confirmCallback = null;

function showConfirm(message, onOk, okLabel = 'Delete') {
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok').textContent = okLabel;
  confirmCallback = onOk;
  showModal('confirm-overlay');
}

function confirmDelete(id) {
  showConfirm('Delete this expense? This cannot be undone.', () => deleteExpense(id));
}

// ===========================================================
//  19. MODAL HELPERS
// ===========================================================

function showModal(overlayId) {
  document.getElementById(overlayId).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideModal(overlayId) {
  document.getElementById(overlayId).classList.add('hidden');
  document.body.style.overflow = '';
}

// Close on overlay click
function setupModalClose(overlayId, closeIds = []) {
  const overlay = document.getElementById(overlayId);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) hideModal(overlayId);
  });
  closeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => hideModal(overlayId));
  });
}

// ===========================================================
//  20. MONTH NAVIGATION
// ===========================================================

function navigateMonth(direction) {
  const [y, m] = state.currentMonth.split('-').map(Number);
  let newY = y, newM = m + direction;
  if (newM > 12) { newM = 1; newY++; }
  if (newM < 1)  { newM = 12; newY--; }
  state.currentMonth = `${newY}-${String(newM).padStart(2,'0')}`;
  saveData();
  renderAll();
}

function renderMonthBar() {
  document.getElementById('current-month-label').textContent = monthLabel(state.currentMonth);
  const badge = document.getElementById('month-badge');
  if (isCurrentMonth(state.currentMonth)) {
    badge.textContent = 'Current'; badge.style.display = '';
  } else if (isPastMonth(state.currentMonth)) {
    badge.textContent = 'Past'; badge.style.display = '';
  } else {
    badge.textContent = 'Future'; badge.style.display = '';
  }
}

// ===========================================================
//  21. CATEGORY DROPDOWNS
// ===========================================================

function populateCategoryDropdowns() {
  const expCatSelect  = document.getElementById('expense-category');
  const filterCatSel  = document.getElementById('filter-category');

  const options = state.categories.map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');
  expCatSelect.innerHTML = options;
  filterCatSel.innerHTML = '<option value="">All Categories</option>' + options;
}

// ===========================================================
//  22. TABS
// ===========================================================

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  // Sync mobile bottom nav
  document.querySelectorAll('.mbn-btn[data-tab]').forEach(b => b.classList.remove('active'));

  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.getElementById(`panel-${tabName}`)?.classList.add('active');
  document.getElementById(`mbn-${tabName}`)?.classList.add('active');

  if (tabName === 'analytics') renderAnalytics();
  if (tabName === 'settings')  renderSettings();
  if (tabName === 'expenses')  renderExpensesTab();
}

// ===========================================================
//  23. THEME
// ===========================================================

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-toggle')?.querySelector('.theme-icon') &&
    (document.getElementById('theme-toggle').querySelector('.theme-icon').textContent =
      theme === 'dark' ? '☀️' : '🌙');
  // Update browser chrome colour (Android + iOS)
  const themeColorMeta = document.getElementById('theme-color-meta');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0c0906' : '#e8deca');
  }
}

// ===========================================================
//  24. EXPORT / IMPORT
// ===========================================================

function exportJSON() {
  const data = JSON.stringify({ months: state.months, categories: state.categories, categoryBudgets: state.categoryBudgets }, null, 2);
  downloadFile('budget-tracker-export.json', 'application/json', data);
  showToast('Exported JSON.', 'success');
}

function exportCSV() {
  const rows = [['Date','Category','Sub-category','Amount','Note','Recurring']];
  const data = getMonthData(state.currentMonth);
  data.expenses.forEach(e => {
    rows.push([e.date, e.category, e.subCategory||'', e.amount, e.note||'', e.recurring ? 'Yes' : 'No']);
  });
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(`expenses-${state.currentMonth}.csv`, 'text/csv', csv);
  showToast('Exported CSV.', 'success');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.months)          state.months          = parsed.months;
      if (parsed.categories)      state.categories      = parsed.categories;
      if (parsed.categoryBudgets) state.categoryBudgets = parsed.categoryBudgets;
      saveData();
      renderAll();
      showToast('Data imported successfully.', 'success');
    } catch(err) {
      showToast('Import failed: invalid JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function clearAllData() {
  showConfirm('This will permanently delete ALL your budget data. This cannot be undone.', () => {
    localStorage.removeItem(LS_KEY_DATA);
    localStorage.removeItem(LS_KEY_PREFS);
    location.reload();
  }, 'Clear All Data');
}

// ===========================================================
//  25. TOAST NOTIFICATIONS
// ===========================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 260);
  }, 3000);
}

// ===========================================================
//  26. UTILITY
// ===========================================================

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ===========================================================
//  27. RENDER ALL
// ===========================================================

function renderAll() {
  renderMonthBar();
  renderBudgetHero();
  renderMetricsStrip();
  renderInsights();
  renderCategoryAnalysis();
  renderHeatmap();
  renderMonthSummary();
  renderExpensesTab();
  populateCategoryDropdowns();

  // Re-render analytics if that tab is visible
  const analyticsPanel = document.getElementById('panel-analytics');
  if (analyticsPanel && analyticsPanel.classList.contains('active')) {
    renderAnalytics();
  }

  // Re-render settings if visible
  const settingsPanel = document.getElementById('panel-settings');
  if (settingsPanel && settingsPanel.classList.contains('active')) {
    renderSettings();
  }
}

// ===========================================================
//  27b. CATEGORY EDIT MODAL
// ===========================================================

let editingCatOrigName = null;
let editingSubCats     = [];

function openCategoryEditModal(catName) {
  const cat = state.categories.find(c => c.name === catName);
  if (!cat) return;
  editingCatOrigName = catName;
  editingSubCats     = [...(cat.subCategories || [])];
  document.getElementById('edit-cat-name').value = catName;
  document.getElementById('new-subcat-input').value = '';
  renderEditSubcatsList();
  showModal('cat-edit-modal-overlay');
  setTimeout(() => document.getElementById('edit-cat-name').focus(), 80);
}

function renderEditSubcatsList() {
  const list = document.getElementById('subcat-edit-list');
  if (!editingSubCats.length) {
    list.innerHTML = '<p style="font-size:0.8rem;color:var(--text-3);padding:8px 0">No sub-categories yet. Add one below.</p>';
    return;
  }
  list.innerHTML = editingSubCats.map((sub, i) => `
    <div class="subcat-edit-item" data-i="${i}">
      <input type="text" class="text-input subcat-inp"
             value="${escHtml(sub)}" data-i="${i}"
             aria-label="Sub-category ${i + 1}" />
      <button class="subcat-del-btn" data-i="${i}" aria-label="Remove sub-category">✕</button>
    </div>`).join('');

  list.querySelectorAll('.subcat-inp').forEach(inp => {
    inp.addEventListener('input', () => {
      editingSubCats[parseInt(inp.dataset.i, 10)] = inp.value;
    });
  });

  list.querySelectorAll('.subcat-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingSubCats.splice(parseInt(btn.dataset.i, 10), 1);
      renderEditSubcatsList();
    });
  });
}

function saveCategoryEdit() {
  const newName = document.getElementById('edit-cat-name').value.trim();
  if (!newName) { showToast('Category name cannot be empty.', 'warn'); return; }

  const duplicate = state.categories.find(
    c => c.name.toLowerCase() === newName.toLowerCase() && c.name !== editingCatOrigName
  );
  if (duplicate) { showToast('A category with that name already exists.', 'warn'); return; }

  const cleanedSubs = editingSubCats.map(s => s.trim()).filter(Boolean);

  // Propagate rename across all expenses
  if (newName !== editingCatOrigName) {
    Object.values(state.months).forEach(monthData => {
      (monthData.expenses || []).forEach(e => {
        if (e.category === editingCatOrigName) e.category = newName;
      });
    });
    if (state.categoryBudgets[editingCatOrigName] !== undefined) {
      state.categoryBudgets[newName] = state.categoryBudgets[editingCatOrigName];
      delete state.categoryBudgets[editingCatOrigName];
    }
  }

  const cat = state.categories.find(c => c.name === editingCatOrigName);
  if (cat) { cat.name = newName; cat.subCategories = cleanedSubs; }

  saveData();
  renderAll();
  hideModal('cat-edit-modal-overlay');
  showToast('Category updated.', 'success');
}

// ===========================================================
//  28. EVENT LISTENERS
// ===========================================================

function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Mobile bottom nav
  document.querySelectorAll('.mbn-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('mbn-add-btn')?.addEventListener('click', openAddExpenseModal);

  // Theme toggle — ripple transition from button centre
  document.getElementById('theme-toggle').addEventListener('click', function () {
    const next = state.theme === 'dark' ? 'light' : 'dark';

    // Position of the toggle button centre
    const btn  = document.getElementById('theme-toggle');
    const rect = btn.getBoundingClientRect();
    const x    = Math.round(rect.left + rect.width  / 2);
    const y    = Math.round(rect.top  + rect.height / 2);

    // Max radius: distance from button to the farthest page corner
    const endR = Math.hypot(
      Math.max(x, window.innerWidth  - x),
      Math.max(y, window.innerHeight - y)
    );

    function doAfterTheme() {
      const analyticsActive = document.getElementById('panel-analytics')?.classList.contains('active');
      if (analyticsActive) renderAnalytics();
      renderBudgetDonut(
        calcTotalSpent(state.currentMonth) / (parseFloat(getCurrentMonthData().budget) || 1) * 100,
        parseFloat(getCurrentMonthData().budget) || 0,
        calcTotalSpent(state.currentMonth)
      );
    }

    // View Transitions API (Chrome 111+, Edge 111+, Safari 18+)
    if (!document.startViewTransition) {
      applyTheme(next);
      saveData();
      doAfterTheme();
      return;
    }

    const vt = document.startViewTransition(() => {
      applyTheme(next);
      saveData();
    });

    vt.ready.then(() => {
      // Animate the NEW snapshot expanding as a circle from the button
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endR}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration:      820,
          easing:        'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });

    vt.finished.then(doAfterTheme);
  });

  // Month navigation
  document.getElementById('prev-month').addEventListener('click', () => navigateMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => navigateMonth(1));
  document.getElementById('go-to-today').addEventListener('click', () => {
    state.currentMonth = todayMonthKey();
    saveData();
    renderAll();
  });

  // Add expense button (nav + FAB both open the modal)
  document.getElementById('add-expense-btn').addEventListener('click', openAddExpenseModal);
  document.getElementById('fab-add-expense').addEventListener('click', openAddExpenseModal);

  // ── CATEGORY EDIT ──
  document.getElementById('save-cat-edit-btn').addEventListener('click',   saveCategoryEdit);
  document.getElementById('cancel-cat-edit-btn').addEventListener('click', () => hideModal('cat-edit-modal-overlay'));
  setupModalClose('cat-edit-modal-overlay', ['cat-edit-modal-close']);

  document.getElementById('add-subcat-btn').addEventListener('click', () => {
    const inp = document.getElementById('new-subcat-input');
    const val = inp.value.trim();
    if (!val) { showToast('Enter a sub-category name.', 'warn'); return; }
    if (editingSubCats.includes(val)) { showToast('Sub-category already exists.', 'warn'); return; }
    editingSubCats.push(val);
    renderEditSubcatsList();
    inp.value = '';
    inp.focus();
  });

  document.getElementById('new-subcat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('add-subcat-btn').click(); }
  });

  // Expense form
  document.getElementById('expense-form').addEventListener('submit', handleExpenseFormSubmit);
  document.getElementById('cancel-expense-btn').addEventListener('click', () => hideModal('expense-modal-overlay'));
  document.getElementById('expense-date').addEventListener('change', updateRecHint);
  document.getElementById('expense-amount').addEventListener('input', updateRecHint);
  document.getElementById('expense-category').addEventListener('change', updateSubcategoryDatalist);

  // Budget
  document.getElementById('edit-budget-btn').addEventListener('click', openBudgetModal);
  document.getElementById('budget-form').addEventListener('submit', handleBudgetFormSubmit);
  document.getElementById('cancel-budget-btn').addEventListener('click', () => hideModal('budget-modal-overlay'));

  // Category budget limits
  document.getElementById('manage-cat-budgets-btn').addEventListener('click', openCatBudgetModal);
  document.getElementById('save-cat-budgets-btn').addEventListener('click', saveCatBudgets);
  document.getElementById('cancel-cat-budget-btn').addEventListener('click', () => hideModal('cat-budget-modal-overlay'));

  // Filters
  document.getElementById('search-input').addEventListener('input', e => {
    activeFilter.search = e.target.value.trim();
    renderExpensesTab();
  });
  document.getElementById('filter-category').addEventListener('change', e => {
    activeFilter.category = e.target.value;
    activeCatFilter = e.target.value;
    renderCategoryAnalysis();
    renderExpensesTab();
  });
  document.getElementById('sort-select').addEventListener('change', e => {
    activeFilter.sort = e.target.value;
    renderExpensesTab();
  });
  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    activeFilter = { category: '', search: '', sort: 'date-desc' };
    activeCatFilter = '';
    document.getElementById('search-input').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('sort-select').value = 'date-desc';
    renderCategoryAnalysis();
    renderExpensesTab();
  });

  // Confirm dialog
  document.getElementById('confirm-ok').addEventListener('click', () => {
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    hideModal('confirm-overlay');
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    confirmCallback = null;
    hideModal('confirm-overlay');
  });

  // Settings: add category
  document.getElementById('add-category-btn').addEventListener('click', () => {
    const input = document.getElementById('new-category-input');
    const name = input.value.trim();
    if (!name) { showToast('Enter a category name.', 'warn'); return; }
    if (state.categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('Category already exists.', 'warn'); return;
    }
    state.categories.push({ name, subCategories: [] });
    saveData();
    renderSettings();
    populateCategoryDropdowns();
    input.value = '';
    showToast('Category added.', 'success');
  });

  // Settings: currency
  document.getElementById('save-currency-btn').addEventListener('click', () => {
    const val = document.getElementById('currency-symbol').value.trim();
    if (!val) { showToast('Enter a currency symbol.', 'warn'); return; }
    state.currency = val;
    saveData();
    renderAll();
    showToast('Currency updated.', 'success');
  });

  // Settings: recurring
  document.getElementById('apply-recurring-btn').addEventListener('click', applyRecurringToCurrentMonth);

  // Data management
  document.getElementById('export-json-btn').addEventListener('click', exportJSON);
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) { importJSON(file); e.target.value = ''; }
  });
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);

  // Modal close via overlay click / close buttons
  setupModalClose('expense-modal-overlay',    ['expense-modal-close']);
  setupModalClose('budget-modal-overlay',     ['budget-modal-close']);
  setupModalClose('cat-budget-modal-overlay', ['cat-budget-modal-close']);
  setupModalClose('confirm-overlay',          []);

  // Keyboard: Escape closes top modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['expense-modal-overlay','budget-modal-overlay','cat-budget-modal-overlay','confirm-overlay'].forEach(id => {
        if (!document.getElementById(id).classList.contains('hidden')) {
          hideModal(id);
        }
      });
    }
  });
}

// ===========================================================
//  29. INIT
// ===========================================================

function init() {
  loadData();
  applyTheme(state.theme);
  populateCategoryDropdowns();
  setupEventListeners();
  renderAll();

  // Guard: if no current month key set, default to today
  if (!state.currentMonth) {
    state.currentMonth = todayMonthKey();
  }

  // Daily auto-refresh every minute (updates recommendations)
  setInterval(() => {
    renderBudgetHero();
    renderMetricsStrip();
  }, 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
