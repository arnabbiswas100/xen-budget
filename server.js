'use strict';

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'xen-dev-secret-change-in-production';
const JWT_EXPIRES = '7d';

// ─── DB ──────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expired' });
  }
}

function setTokenCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

// ─── DEFAULT CATEGORIES ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: 'Food',          color: '#00d4ff' },
  { name: 'Transport',     color: '#b347ff' },
  { name: 'Subscriptions', color: '#00fff5' },
  { name: 'Shopping',      color: '#ff2d9b' },
  { name: 'Misc',          color: '#00ff88' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const exists = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      await client.query('ROLLBACK');
      // BUG FIX: must release client before returning, otherwise pool leaks
      client.release();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const userRes = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), hash]
    );
    const user = userRes.rows[0];

    // Insert default categories
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const c = DEFAULT_CATEGORIES[i];
      await client.query(
        'INSERT INTO categories (user_id, name, color, sort_order) VALUES ($1, $2, $3, $4)',
        [user.id, c.name, c.color, i]
      );
    }

    await client.query('COMMIT');
    setTokenCookie(res, { id: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SIGNUP ERROR]', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  } finally {
    // Only release if not already released above
    try { client.release(); } catch (_) {}
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    setTokenCookie(res, { id: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/categories
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, color, sort_order FROM categories WHERE user_id = $1 ORDER BY sort_order, id',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/categories
app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await pool.query(
      'INSERT INTO categories (user_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color, sort_order',
      [req.user.id, name.trim(), color || '#00d4ff']
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/categories/:id
app.patch('/api/categories/:id', requireAuth, async (req, res) => {
  const { name, color } = req.body;
  try {
    const result = await pool.query(
      `UPDATE categories SET
        name = COALESCE($1, name),
        color = COALESCE($2, color)
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, color, sort_order`,
      [name?.trim() || null, color || null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/categories/:id
app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    // Check if category has expenses
    const check = await pool.query(
      'SELECT COUNT(*) FROM expenses WHERE category_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Cannot delete category with expenses' });
    }
    await pool.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/budget?month=&year=
app.get('/api/budget', requireAuth, async (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  const year = parseInt(req.query.year) || now.getFullYear();
  try {
    const result = await pool.query(
      'SELECT amount FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [req.user.id, month, year]
    );
    res.json({ amount: result.rows[0] ? parseFloat(result.rows[0].amount) : 0, month, year });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/budget
app.put('/api/budget', requireAuth, async (req, res) => {
  const { amount, month, year } = req.body;
  if (amount == null || amount < 0) return res.status(400).json({ error: 'Valid amount required' });
  const now = new Date();
  const m = parseInt(month) || now.getMonth() + 1;
  const y = parseInt(year) || now.getFullYear();
  try {
    await pool.query(
      `INSERT INTO budgets (user_id, amount, month, year)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, month, year)
       DO UPDATE SET amount = $2, updated_at = NOW()`,
      [req.user.id, amount, m, y]
    );
    res.json({ amount: parseFloat(amount), month: m, year: y });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/expenses?month=&year=
app.get('/api/expenses', requireAuth, async (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  const year = parseInt(req.query.year) || now.getFullYear();
  try {
    const result = await pool.query(
      `SELECT e.id, e.amount, e.description, e.expense_date as date,
              e.category_id, c.name as category_name, c.color as category_color
       FROM expenses e
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.expense_date) = $2
         AND EXTRACT(YEAR FROM e.expense_date) = $3
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [req.user.id, month, year]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      amount: parseFloat(r.amount),
      description: r.description,
      date: r.date.toISOString().split('T')[0],
      categoryId: r.category_id,
      categoryName: r.category_name || 'Uncategorized',
      categoryColor: r.category_color || '#888888',
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/expenses
app.post('/api/expenses', requireAuth, async (req, res) => {
  const { amount, description, categoryId, date } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  if (!date) return res.status(400).json({ error: 'Date required' });
  try {
    // Verify category belongs to user
    if (categoryId) {
      const catCheck = await pool.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
        [categoryId, req.user.id]
      );
      if (catCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid category' });
    }
    const result = await pool.query(
      `INSERT INTO expenses (user_id, amount, description, category_id, expense_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, amount, description, expense_date as date, category_id`,
      [req.user.id, amount, description || '', categoryId || null, date]
    );
    const row = result.rows[0];
    // Fetch category info
    let catName = 'Uncategorized', catColor = '#888888';
    if (row.category_id) {
      const cat = await pool.query('SELECT name, color FROM categories WHERE id = $1', [row.category_id]);
      if (cat.rows[0]) { catName = cat.rows[0].name; catColor = cat.rows[0].color; }
    }
    res.status(201).json({
      id: row.id,
      amount: parseFloat(row.amount),
      description: row.description,
      date: row.date.toISOString().split('T')[0],
      categoryId: row.category_id,
      categoryName: catName,
      categoryColor: catColor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── CATCH-ALL: serve index.html ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Xen Budget Tracker running on port ${PORT}`);
  // Verify database connectivity on startup
  try {
    await pool.query('SELECT 1');
    console.log('[DB] Connected to PostgreSQL successfully');
  } catch (err) {
    console.error('[DB] FAILED to connect to PostgreSQL:', err.message);
    console.error('[DB] Make sure DATABASE_URL is set in Railway environment variables');
  }
});
