# Web Development — A Complete Lecture Using the Xen Budget Tracker

> **Who this is for:** Someone on Ubuntu 24.04 LTS with zero coding knowledge, who has already hosted this project on Railway + PostgreSQL, and wants to deeply understand how it all works.

---

## Table of Contents

1. [The Big Picture — What Are We Even Looking At?](#1-the-big-picture)
2. [Project Structure — Every File Explained](#2-project-structure)
3. [HTML — The Skeleton of a Webpage](#3-html)
4. [CSS — Making Things Look Good](#4-css)
5. [JavaScript — Making Things Actually Work](#5-javascript)
6. [Node.js and the Backend (server.js)](#6-nodejs-and-the-backend)
7. [PostgreSQL — The Database](#7-postgresql)
8. [The Connection Flow — How Everything Talks to Each Other](#8-the-connection-flow)
9. [Authentication — How Login Works](#9-authentication)
10. [APIs — The Language Between Frontend and Backend](#10-apis)
11. [Railway and Deployment — How It Goes Live](#11-railway-and-deployment)
12. [Every File, Explained Line by Line](#12-every-file-line-by-line)
13. [How a Full User Journey Works (End to End)](#13-end-to-end-journey)

---

## 1. The Big Picture

Before we look at a single line of code, you need to understand the mental model of **how a web application works**.

### What happens when you open a website?

Imagine you're ordering food at a restaurant.

- **You (the customer)** = your web browser (Chrome, Firefox, etc.)
- **The menu** = the HTML + CSS (what you see and can interact with)
- **The waiter** = JavaScript (takes your request, carries messages back and forth)
- **The kitchen** = the server (does the real work: calculations, reading from database)
- **The fridge / pantry** = the database (where all the data is permanently stored)

When you visit `https://your-app.railway.app`:

1. Your browser asks Railway: "Please give me this website"
2. Railway's server (`server.js`) sends back `index.html`
3. Your browser reads the HTML, sees it needs CSS and JS files too, and asks for those
4. Now your browser has everything — it renders (draws) the page
5. When you click "Add Expense," JavaScript sends a message to the server
6. The server stores the expense in PostgreSQL
7. The server replies "done!" and JavaScript updates what you see — without reloading the page

This pattern has a name: **Full Stack Web Application**. "Full stack" means it has both a frontend (what users see) and a backend (the server + database).

### The Three Worlds of Web Development

```
FRONTEND (runs in your browser)          BACKEND (runs on Railway's server)
─────────────────────────────           ────────────────────────────────────
index.html   ← structure                server.js   ← handles all requests
style.css    ← appearance               package.json ← lists what's installed
auth.js      ← login/logout logic       schema.sql  ← defines database tables
app.js       ← budget tracker logic
                    ↑ ↓
            They talk via HTTP requests
            (like texting back and forth)
                                                        ↕
                                              PostgreSQL Database
                                        (permanently stores all data)
```

### Why do we need a server at all?

Good question. Why not just put everything in the browser?

Because the browser is **temporary**. When you close the tab, everything in JavaScript memory is gone. You need something that:

- Runs 24/7 (even when your laptop is off)
- Stores data permanently (the database)
- Can handle multiple users (each person sees only their own data)
- Handles security (passwords must never be stored in the browser)

That's what the server + database combination does.

---

## 2. Project Structure

Here is every file in the project and what it does:

```
xen-budget-tracker/
│
├── server.js           ← THE BRAIN — the Node.js backend server
├── package.json        ← "Shopping list" of software this project needs
├── schema.sql          ← Blueprint for the database tables
├── railway.toml        ← Instructions for Railway on how to run this
├── .env                ← Secret settings (passwords, database address)
├── .gitignore          ← Tells Git what files NOT to upload to GitHub
│
└── public/             ← Everything in here is sent to the browser
    ├── index.html      ← The one HTML page (this is a Single Page App)
    ├── css/
    │   └── style.css   ← All the visual styling
    └── js/
        ├── auth.js     ← Login/signup/logout logic
        └── app.js      ← All budget tracker logic + charts
```

### Why is there only ONE HTML file?

This project is what's called a **Single Page Application (SPA)**. Instead of having separate pages (`login.html`, `dashboard.html`, `settings.html`), there is one file that shows and hides different sections using JavaScript.

Look at `index.html` — you'll find:
- A `div` with `id="authScreen"` — the login/signup screen
- A `div` with `id="appScreen"` — the main budget dashboard

When you log in, JavaScript does: `authScreen.style.display = 'none'` and `appScreen.style.display = ''`. The page never actually reloads — it just hides one thing and shows another. This is instant and feels like a real app.

### The `public/` folder — a critical concept

In `server.js` there's this line:

```javascript
app.use(express.static(path.join(__dirname, 'public')));
```

This tells the server: "Anything inside the `public/` folder — just send it directly to whoever asks for it."

So when your browser asks for `/css/style.css`, the server doesn't have to do anything clever — it just finds the file at `public/css/style.css` and sends it. This is called **serving static files**.

The files **outside** `public/` (like `server.js` itself) are **never** sent to the browser. They only run on the server. This is a security boundary — your secret database password in `.env` stays on the server and never reaches the browser.

---

## 3. HTML

### What is HTML?

HTML stands for **HyperText Markup Language**. It's not a programming language — it's a way to **describe the structure of a document** using tags.

Think of HTML as a blueprint for a building. It says "put a wall here, a window there, a door here." It doesn't say what colour the wall is (that's CSS) or what happens when you press a button (that's JavaScript).

### The Anatomy of an HTML Tag

```html
<div class="auth-box glass" id="loginForm">
  Content goes here
</div>
```

- `<div>` — the **opening tag**. `div` stands for "division" — it's a generic box/container.
- `class="auth-box glass"` — an **attribute**. Classes are labels you put on elements so CSS can style them.
- `id="loginForm"` — another attribute. IDs are **unique names** for elements so JavaScript can find them.
- `</div>` — the **closing tag**. Everything between opening and closing tag is the content.

### The Structure of `index.html`

Every HTML file has the same skeleton:

```html
<!DOCTYPE html>               ← Tells the browser: "this is HTML5"
<html lang="en">              ← Root of the document
  <head>                      ← Invisible metadata (title, CSS links, etc.)
    <meta charset="UTF-8">    ← Character encoding (supports emojis, ₹, etc.)
    <meta name="viewport"...> ← Makes it work on phones
    <title>Xen Budget Tracker</title>
    <link rel="stylesheet" href="/css/style.css">  ← Load CSS
  </head>
  <body>                      ← Everything visible goes here
    <!-- All the actual content -->
    <script src="/js/auth.js"></script>  ← Load JavaScript (at the END)
    <script src="/js/app.js"></script>
  </body>
</html>
```

**Why are the `<script>` tags at the END of `<body>`?**

Because the browser reads HTML top to bottom. If you put the script at the top, it runs before the HTML elements exist — so when JS tries to find `document.getElementById('loginForm')`, that element doesn't exist yet and you get an error. By putting scripts last, you guarantee all HTML elements exist before JS runs.

### Important HTML Elements Used in This Project

**`<div>` — generic container**
```html
<div class="glass budget-panel">
  <!-- panel content -->
</div>
```
`div` elements are invisible rectangles that group other elements together for layout and styling.

**`<input>` — text/number/date fields**
```html
<input type="email" class="neon-input" id="loginEmail" placeholder="you@example.com">
<input type="number" id="expAmount" placeholder="0.00" min="0">
<input type="date" id="expDate">
```
The `type` attribute changes the keyboard on mobile and adds built-in validation.

**`<button>` — clickable buttons**
```html
<button class="btn btn-primary" onclick="doLogin()">ACCESS SYSTEM</button>
```
The `onclick` attribute is one way to attach JavaScript to a button click.

**`<select>` and `<option>` — dropdowns**
```html
<select class="neon-input" id="expCategory">
  <!-- Options are added here by JavaScript dynamically -->
</select>
```
This dropdown for categories is filled with options by JavaScript when you open the expense modal.

**`<canvas>` — a drawing surface**
```html
<canvas id="lineChart"></canvas>
<canvas id="bgCanvas"></canvas>
```
This is a blank rectangle that JavaScript can draw on — pixels, lines, shapes, charts, animations. The spending chart and the animated background particles are both drawn on `<canvas>` elements.

**`<label>` — describes an input**
```html
<label>Email</label>
<input type="email" id="loginEmail">
```
Labels describe what an input field is for. Good for accessibility.

### Classes vs IDs — When to Use Which

| | Class | ID |
|---|---|---|
| Syntax | `class="name"` | `id="name"` |
| Uniqueness | Can use on many elements | Must be unique on the page |
| CSS targeting | `.name { }` | `#name { }` |
| JS targeting | `document.querySelectorAll('.name')` | `document.getElementById('name')` |
| Use case | Styling groups of similar elements | Finding one specific element |

In this project, `class` is used heavily for styling (e.g., every panel has `class="glass"`), and `id` is used heavily by JavaScript to find specific elements (e.g., `document.getElementById('loginEmail').value`).

### Comments in HTML

```html
<!-- This is a comment — the browser ignores it, it's just for humans -->
<!-- ═══════════════════ AUTH SCREEN ═════════════════════ -->
```

Comments help organise large HTML files.

---

## 4. CSS

### What is CSS?

CSS stands for **Cascading Style Sheets**. It controls how HTML elements look — colours, fonts, sizes, positions, animations.

If HTML is the blueprint of a building, CSS is the interior design — paint colours, furniture style, lighting.

### The Basic Syntax

```css
selector {
  property: value;
  property: value;
}
```

For example:
```css
.auth-title {
  font-size: 28px;
  color: #00d4ff;
  font-weight: bold;
}
```

This says: "Find every element with class `auth-title` and give it those three styles."

### Selectors — How CSS Finds Elements

```css
div { }           /* Every div */
.glass { }        /* Every element with class "glass" */
#loginEmail { }   /* The element with id "loginEmail" */
.glass .btn { }   /* A .btn that is INSIDE a .glass element */
```

### CSS Variables — Reusable Values

This project defines colours at the top of `style.css`:

```css
:root {
  --neon-blue: #00d4ff;
  --neon-purple: #b347ff;
  --bg-void: #020408;
  --safe: #00ff88;
  --warning: #ff8c00;
  --danger: #ff2244;
}
```

`:root` means "the very top of the document." Variables are defined with `--` prefix. Then they're used everywhere:

```css
.auth-title {
  color: var(--neon-blue);
}
.remaining-amount.safe {
  color: var(--safe);
}
```

Why is this brilliant? If you want to change the blue colour used throughout the whole app, you only change it in ONE place — the variable definition. Without variables, you'd have to find-and-replace dozens of places.

### The Box Model — The Most Important CSS Concept

Every HTML element is a rectangle. That rectangle has layers:

```
┌─────────────────────────────────────┐ ← margin (space OUTSIDE the element)
│  ┌───────────────────────────────┐  │
│  │  border (the visible edge)    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ padding (space inside)  │  │  │
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │  CONTENT (text,   │  │  │  │
│  │  │  │  images, etc.)    │  │  │  │
│  │  │  └───────────────────┘  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

```css
.auth-box {
  padding: 40px;          /* Space inside the box, between border and content */
  margin: 20px;           /* Space outside the box, between it and neighbours */
  border: 1px solid #333; /* The visible edge */
  width: 420px;           /* Width of the content area */
}
```

### Flexbox — Modern Layout

Before Flexbox, making elements sit next to each other horizontally was famously painful. Flexbox solves this elegantly.

```css
.auth-tabs {
  display: flex;           /* Turn on flexbox */
  gap: 10px;               /* Space between children */
  justify-content: center; /* Centre children horizontally */
  align-items: center;     /* Centre children vertically */
}
```

When a parent has `display: flex`, its direct children automatically arrange themselves in a row (left to right by default).

In this project, flexbox is used for:
- The header (badge on left, user email on right)
- The grid of panels (Budget Control | Budget Usage | Analytics)
- The input row (input field + buttons side by side)
- Almost every panel interior

### Positioning — Getting Elements Where You Want

```css
/* Default — in the normal document flow */
position: static;

/* Relative to where it would normally be */
position: relative;
top: 10px; /* Move 10px down from its normal position */

/* Removed from flow, placed relative to its nearest positioned ancestor */
position: absolute;
top: 0;
right: 0;

/* Stays fixed to the viewport (doesn't scroll) */
position: fixed;
top: 0;
left: 0;
```

The animated particle background uses `position: fixed` — it always covers the whole screen, even when you scroll.

The corner decorations (`.corner-tl`, `.corner-tr`, etc.) use `position: absolute` — placed at exact corners of their parent panel.

### The `glass` Class — The Signature Look

```css
.glass {
  background: var(--bg-panel);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  position: relative;
}
```

`backdrop-filter: blur(10px)` is what gives that frosted glass effect — it blurs whatever is behind the element. The animated particles behind the panels look blurred through the glass.

### CSS Animations and Transitions

**Transitions** — smooth changes when properties change:
```css
.btn {
  transition: all 0.2s ease;
}
.btn:hover {
  background: var(--neon-blue);
  transform: translateY(-1px); /* Slight lift on hover */
}
```

When the mouse hovers over a button, instead of instantly changing, CSS smoothly transitions over 0.2 seconds.

**The `@keyframes` animation:**
```css
@keyframes glow-pulse {
  0%   { box-shadow: 0 0 5px var(--neon-blue); }
  50%  { box-shadow: 0 0 20px var(--neon-blue); }
  100% { box-shadow: 0 0 5px var(--neon-blue); }
}

.status-dot {
  animation: glow-pulse 2s ease-in-out infinite;
}
```

This defines a "glow pulse" animation and applies it to the status dot — the green/orange/red dot next to "SYSTEM NOMINAL."

### Responsive Design — The `viewport` Meta Tag

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

This tells the browser on phones: "Don't try to zoom out — use the real screen width." Without this, mobile browsers pretend to be a 980px wide screen and zoom out, making everything tiny.

### Media Queries — Different Styles for Different Screens

```css
@media (max-width: 768px) {
  .grid-top {
    grid-template-columns: 1fr; /* Stack panels vertically on small screens */
  }
}
```

If the screen is 768px wide or less (i.e., a phone), the three panels stack vertically instead of sitting side by side.

### CSS Grid — The Page Layout

```css
.grid-top {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 20px;
}
```

This creates a row with three columns. `1fr` means "1 fraction of available space." So columns 1 and 2 are equal width, and column 3 is 1.4x wider (for the Analytics panel).

---

## 5. JavaScript

### What is JavaScript?

JavaScript (JS) is the **programming language of the browser**. While HTML describes structure and CSS describes appearance, JavaScript describes **behaviour** — what happens when you click, what happens after a timer, how the page changes dynamically.

JavaScript can:
- Read and modify HTML elements
- React to events (clicks, key presses, form submissions)
- Send messages to the server (without reloading the page)
- Do calculations, string manipulation, logic
- Draw on `<canvas>` elements (charts, animations)

### Variables — Storing Data

```javascript
let budget = 0;           // Can be changed later
const NEON_COLORS = [...] // Cannot be changed (constant)
var oldStyle = 'avoid';   // Old style — use let/const instead
```

**In this project's `app.js`:**
```javascript
let state = {
  budget: 0,
  expenses: [],
  categories: [],
};
```

`state` is an **object** that holds all the data currently shown on screen. When you add an expense, the expense is added to `state.expenses`, then the UI is re-rendered from state. This is the core pattern: **state drives the UI**.

### Functions — Reusable Blocks of Code

```javascript
function fmtCurrency(n) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  return (n < 0 ? '-₹' : '₹') + str;
}
```

A function takes inputs (called **parameters**, here `n` for number), does something with them, and optionally returns a result. Here, `fmtCurrency(1500)` returns `"₹1,500.00"`.

**Calling a function:**
```javascript
document.getElementById('totalBudgetStat').textContent = fmtCurrency(state.budget);
```

### The DOM — What JavaScript Actually Manipulates

**DOM** stands for **Document Object Model**. When the browser reads HTML, it turns it into a tree of objects (the DOM). JavaScript can then read and modify this tree.

```javascript
// Find an element by its id
const emailInput = document.getElementById('loginEmail');

// Read its value
const emailValue = emailInput.value; // What the user typed

// Change its text
document.getElementById('statusText').textContent = 'SYSTEM NOMINAL';

// Show or hide an element
document.getElementById('authScreen').style.display = 'none';   // hide
document.getElementById('appScreen').style.display = '';         // show

// Add or remove CSS classes
element.classList.add('active');
element.classList.remove('active');
element.classList.toggle('active'); // add if not there, remove if there
```

### Events — Reacting to User Actions

Events are things that happen — a click, a keypress, a page load, etc.

**Method 1: `onclick` in HTML (used in this project for simplicity):**
```html
<button onclick="doLogin()">ACCESS SYSTEM</button>
```

**Method 2: `addEventListener` in JS (more modern and flexible):**
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
  if (e.key === 'Escape') closeModal();
});
```

This listens on the whole document — whenever any key is pressed, this function runs. This is how pressing `N` opens the "Add Expense" modal, and `Escape` closes it.

### Async/Await — Waiting for Things Without Freezing

Talking to a server takes time (milliseconds to seconds). If JavaScript just waited, the whole browser would freeze and become unresponsive. JavaScript solves this with **asynchronous** code.

```javascript
async function doLogin() {
  // Mark this function as async — it can pause and resume

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  // Send the login request to the server
  // `await` means: "pause here until we get a response, but don't freeze the browser"
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  // Now we have the response
  const data = await response.json(); // Parse the JSON

  if (response.ok) {
    onAuthSuccess(data.user); // Login worked!
  } else {
    showError(data.error); // Something went wrong
  }
}
```

**`fetch()`** is the built-in browser function for making HTTP requests to servers. It returns a **Promise** — a value that will exist *in the future*. `await` waits for that promise to complete.

**`try/catch` — Handling Errors:**
```javascript
async function loadCategories() {
  try {
    const data = await api('GET', '/api/categories');
    state.categories = data;
  } catch (err) {
    console.error(err);
    showNotif('Failed to load categories', 'error');
  }
}
```

If anything goes wrong (network error, server error), the code jumps to `catch`. Without this, errors crash the whole page.

### Arrays — Lists of Data

```javascript
let expenses = [];         // Empty list
expenses.push(newExpense); // Add to the end

// Loop through every expense
expenses.forEach(exp => {
  console.log(exp.amount);
});

// Create a new array from an existing one (filtering)
const foodExpenses = expenses.filter(e => e.categoryName === 'Food');

// Calculate a total
const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
```

`reduce()` is one of the most powerful array methods. It collapses a list down to a single value (here, a sum).

### Objects — Collections of Related Data

```javascript
const expense = {
  id: 42,
  amount: 500,
  description: 'Lunch',
  date: '2024-01-15',
  categoryName: 'Food',
  categoryColor: '#00d4ff',
};

// Access properties with dot notation
console.log(expense.amount); // 500
console.log(expense.categoryName); // 'Food'

// Or bracket notation (useful when property name is a variable)
const field = 'amount';
console.log(expense[field]); // 500
```

### Template Literals — String Building

```javascript
// Old way (ugly)
const msg = 'Budget set to ' + fmtCurrency(val);

// Template literal (modern, clean)
const msg = `Budget set to ${fmtCurrency(val)}`;

// Multi-line HTML generation
const html = `
  <div class="tx-item">
    <div class="tx-cat">${exp.categoryName}</div>
    <div class="tx-amount">${fmtCurrency(exp.amount)}</div>
    <button onclick="deleteExpense(${exp.id})">✕</button>
  </div>
`;
element.innerHTML = html;
```

Template literals (backtick strings with `${}`) are used extensively in `app.js` to generate HTML dynamically — for example, rendering each transaction row or each category item.

### Arrow Functions — Short Function Syntax

```javascript
// Traditional function
function double(x) { return x * 2; }

// Arrow function — same thing, shorter syntax
const double = x => x * 2;

// Arrow function with multiple statements
const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
```

Arrow functions are used everywhere in modern JavaScript. In this project:
```javascript
state.expenses.reduce((s, e) => s + e.amount, 0)
state.expenses.filter(e => e.id !== id)
```

### `requestAnimationFrame` — Smooth Animations

```javascript
function animateNum(el, from, to, format, duration = 500) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1); // 0 to 1 (progress)
    const ease = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;   // Easing curve
    const val = from + (to - from) * ease;           // Interpolated value
    el.textContent = format(val);
    if (p < 1) requestAnimationFrame(tick); // Keep going until done
  }
  requestAnimationFrame(tick);
}
```

`requestAnimationFrame` asks the browser: "Call this function before the next screen repaint." This gives you ~60 calls per second, perfectly synced with the screen refresh rate — smooth animations without `setInterval`.

This is used to animate the numbers (budget, spent, remaining) smoothly changing when you add an expense.

### The Canvas API — Drawing Charts

```javascript
const canvas = document.getElementById('lineChart');
const ctx = canvas.getContext('2d'); // Get the drawing context

// Draw a line
ctx.beginPath();
ctx.moveTo(100, 50);   // Move to (x=100, y=50)
ctx.lineTo(200, 150);  // Draw line to (x=200, y=150)
ctx.strokeStyle = '#00d4ff'; // Line color
ctx.lineWidth = 2;
ctx.stroke(); // Actually draw it

// Draw a filled rectangle
ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
ctx.fillRect(x, y, width, height);

// Draw a circle
ctx.beginPath();
ctx.arc(80, 80, 60, 0, Math.PI * 2); // (centerX, centerY, radius, startAngle, endAngle)
ctx.fill();
```

The coordinate system: `(0, 0)` is the **top-left** corner. X increases to the right, Y increases **downward**. This trips up many beginners.

The spending trend line chart, category bar chart, pie chart, and the animated particle background are all drawn this way — raw canvas drawing commands.

---

## 6. Node.js and the Backend

### What is Node.js?

JavaScript was originally designed to run only in browsers. **Node.js** is a runtime that lets JavaScript run on a server (outside the browser).

So the same language — JavaScript — is used both in the browser (`auth.js`, `app.js`) and on the server (`server.js`). This is one reason Node.js became popular: developers only need to learn one language.

### What is Express?

Express is a **web framework** for Node.js. It makes it easy to:
- Listen for HTTP requests (GET, POST, DELETE, etc.)
- Route requests to the right handler
- Send back responses

Without Express, you'd have to handle all of this manually with Node's built-in `http` module — very tedious.

```javascript
const express = require('express');
const app = express();

// Tell Express: when someone makes a GET request to '/api/categories'...
app.get('/api/categories', requireAuth, async (req, res) => {
  // ...run this function. req = request info, res = response object
  const result = await pool.query('SELECT * FROM categories WHERE user_id = $1', [req.user.id]);
  res.json(result.rows); // Send the result as JSON
});

// Start listening on port 3000
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### HTTP Methods — The Verbs of the Web

When a browser or JavaScript code makes a request, it specifies a **method** (also called a "verb"):

| Method | Meaning | Example in this project |
|--------|---------|------------------------|
| `GET` | Retrieve data | "Give me all my expenses" |
| `POST` | Create something new | "Add this new expense" |
| `PUT` | Replace something | "Update this month's budget" |
| `PATCH` | Partially update | "Rename this category" |
| `DELETE` | Remove something | "Delete this expense" |

These are the same methods you see in `server.js`:
```javascript
app.get('/api/expenses', ...)    // Get all expenses
app.post('/api/expenses', ...)   // Add a new expense
app.delete('/api/expenses/:id', ...)  // Delete expense by id
```

### The `package.json` File

```json
{
  "name": "xen-budget-tracker",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cookie-parser": "^1.4.6"
  }
}
```

This file does several things:

**`scripts`** — shortcuts for terminal commands. `npm start` runs `node server.js`. `npm run dev` runs `nodemon server.js` (nodemon automatically restarts the server when you change a file — great for development).

**`dependencies`** — the libraries this project depends on. Each one adds specific capabilities:

| Package | What it does |
|---------|-------------|
| `express` | Web framework (routing, request/response handling) |
| `pg` | PostgreSQL client (talks to the database) |
| `bcryptjs` | Password hashing (never store passwords in plain text!) |
| `jsonwebtoken` | Creates and verifies JWT tokens (authentication) |
| `cookie-parser` | Reads cookies from requests |

When you run `npm install`, Node downloads all of these from the internet into a `node_modules` folder. This folder can be huge (hundreds of MB) which is why it's in `.gitignore` — no need to upload it to GitHub when anyone can re-download it with `npm install`.

### Middleware — Functions That Run on Every Request

```javascript
app.use(express.json());        // Parse JSON request bodies
app.use(cookieParser());        // Parse cookies
app.use(express.static('public')); // Serve static files
```

**Middleware** are functions that run *before* your actual route handlers. They prepare the request. Think of them as security guards and receptionists at an office entrance.

`express.json()` — without this, when JavaScript sends `{ email: 'a@b.com', password: '123' }`, the server would receive it as raw text. This middleware converts it to a JavaScript object you can use as `req.body.email`.

`cookieParser()` — parses cookie strings and makes them available as `req.cookies.token`.

### The `requireAuth` Middleware

```javascript
function requireAuth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next(); // Continue to the actual route handler
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expired' });
  }
}
```

This is a custom middleware that checks if the user is logged in. It's passed as a second argument to protected routes:

```javascript
app.get('/api/categories', requireAuth, async (req, res) => { ... });
//                         ^^^^^^^^^^^
//                         Only runs if requireAuth calls next()
```

If you're not logged in (no token), it immediately returns a 401 error. If you are logged in, it adds `req.user` (with your id and email) to the request, and calls `next()` to continue.

### HTTP Status Codes

Every response has a **status code**:

| Code | Meaning |
|------|---------|
| 200 | OK — success |
| 201 | Created — new resource created (used after POST) |
| 400 | Bad Request — you sent invalid data |
| 401 | Unauthorized — not logged in |
| 404 | Not Found |
| 409 | Conflict — e.g., email already registered |
| 500 | Internal Server Error — something crashed on the server |

In JavaScript, `response.ok` is true if the status is 200-299.

### The `.env` File — Secrets and Configuration

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=change-this-to-a-long-random-string
NODE_ENV=development
PORT=3000
```

These are **environment variables** — settings that can differ between environments (your laptop vs Railway's server).

In `server.js`, they're accessed as:
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000; // Use 3000 if PORT isn't set
```

**Why not just put them in the code?**

Because:
1. They change between environments (different database on Railway than on your laptop)
2. Secrets (like `JWT_SECRET` and your database password) should NEVER be in code that you upload to GitHub. Anyone could find them.

The `.gitignore` file contains `.env` — this means Git will never upload this file to GitHub.

On Railway, you set these as "Variables" in the project settings — Railway injects them automatically when it runs your server.

---

## 7. PostgreSQL

### What is a Database?

A database is a **permanent, organised store of data**. Unlike JavaScript variables (which vanish when the server restarts), a database remembers everything.

PostgreSQL (often called "Postgres") is a powerful open-source **relational database** — it stores data in **tables**, like spreadsheets, with rows and columns.

### Tables and SQL

SQL (Structured Query Language) is the language you use to talk to a relational database.

#### The Four Tables in This Project

**`users`** — Stores every registered account:
```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,   -- Auto-incrementing unique number
  email         TEXT UNIQUE NOT NULL, -- Can't be blank, must be unique
  password_hash TEXT NOT NULL,        -- The HASHED password (not the real one!)
  created_at    TIMESTAMPTZ DEFAULT NOW() -- Auto-set to current time
);
```

**`categories`** — Expense categories per user:
```sql
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ^^ Foreign key: must match an id in the users table
  -- ON DELETE CASCADE: if the user is deleted, delete their categories too
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#00d4ff',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(user_id, name)  -- One user can't have two categories with the same name
);
```

**`budgets`** — Monthly budget per user:
```sql
CREATE TABLE budgets (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount  NUMERIC(12,2) NOT NULL DEFAULT 0, -- Up to 12 digits, 2 decimal places
  month   INTEGER NOT NULL, -- 1-12
  year    INTEGER NOT NULL,
  UNIQUE(user_id, month, year) -- One budget per user per month
);
```

**`expenses`** — Individual expenses:
```sql
CREATE TABLE expenses (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  -- ^^ If the category is deleted, don't delete the expense — just set category to NULL
  amount       NUMERIC(12,2) NOT NULL,
  description  TEXT DEFAULT '',
  expense_date DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### SQL Queries — The Four Essential Operations

**SELECT — Reading data:**
```sql
SELECT id, name, color FROM categories
WHERE user_id = 5
ORDER BY sort_order;
```
"Give me the id, name, and color from all categories belonging to user 5, sorted by sort_order."

**INSERT — Adding data:**
```sql
INSERT INTO expenses (user_id, amount, description, category_id, expense_date)
VALUES (5, 500.00, 'Lunch', 3, '2024-01-15')
RETURNING id;
```
"Add this new expense and give me back the id it was assigned."

**UPDATE — Changing data:**
```sql
UPDATE categories
SET name = 'Transportation', color = '#ff0000'
WHERE id = 7 AND user_id = 5;
```
"Change the name and color of category 7 — but only if it belongs to user 5 (security!)."

**DELETE — Removing data:**
```sql
DELETE FROM expenses
WHERE id = 42 AND user_id = 5
RETURNING id;
```
"Delete expense 42 — but only if it belongs to user 5."

### JOINs — Combining Tables

```sql
SELECT e.id, e.amount, e.description, e.expense_date,
       e.category_id, c.name as category_name, c.color as category_color
FROM expenses e
LEFT JOIN categories c ON e.category_id = c.id
WHERE e.user_id = 5
ORDER BY e.expense_date DESC;
```

This gets all expenses **along with** their category name and colour in one query. Without `JOIN`, you'd have to run a separate query for each expense to get its category — very slow.

`LEFT JOIN` means: include the expense even if `category_id` is NULL (if the expense has no category, or if the category was deleted — it's still included but `category_name` will be NULL).

### Parameterised Queries — SQL Injection Prevention

```javascript
// DANGEROUS — never do this:
const query = `SELECT * FROM users WHERE email = '${email}'`;

// SAFE — always do this:
const query = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

**SQL injection** is a famous attack. If a user types `' OR 1=1 --` as their email, a naive query could return all users. By using `$1` placeholders (and passing the actual value separately), PostgreSQL handles all the escaping — the email is always treated as data, never as SQL code.

All queries in `server.js` use this safe pattern.

### UPSERT — Insert or Update

```sql
INSERT INTO budgets (user_id, amount, month, year)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, month, year)
DO UPDATE SET amount = $2, updated_at = NOW();
```

"Insert this budget. But if there's already a budget for this user+month+year (conflict on the UNIQUE constraint), then update it instead."

This is called an **upsert** (update + insert). It's used when setting a monthly budget — you either create it for the first time, or update it if it already exists.

### Database Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
```

An index is like a book's index — it makes looking things up much faster. Without the index on `(user_id, expense_date)`, to find all expenses for user 5 in January, PostgreSQL would scan every single row. With the index, it jumps directly to the right rows.

---

## 8. The Connection Flow

Let's trace every connection in this project — who talks to who, and how.

### The Big Picture of Connections

```
Browser                          Railway Server (server.js)          PostgreSQL
  │                                      │                               │
  │  ① GET https://yourapp.railway.app   │                               │
  │──────────────────────────────────►   │                               │
  │                                      │                               │
  │  ② index.html (the HTML file)        │                               │
  │  ◄─────────────────────────────────  │                               │
  │                                      │                               │
  │  ③ GET /css/style.css                │                               │
  │──────────────────────────────────►   │                               │
  │  ④ style.css file                    │                               │
  │  ◄─────────────────────────────────  │                               │
  │                                      │                               │
  │  ⑤ GET /js/auth.js, GET /js/app.js  │                               │
  │──────────────────────────────────►   │                               │
  │  ⑥ auth.js and app.js files         │                               │
  │  ◄─────────────────────────────────  │                               │
  │                                      │                               │
  │  [Page renders — user sees login]    │                               │
  │                                      │                               │
  │  ⑦ GET /api/auth/me (is logged in?) │                               │
  │──────────────────────────────────►   │                               │
  │                                      │  SELECT * FROM users...       │
  │                                      │──────────────────────────►    │
  │                                      │  { id: 5, email: '...' }      │
  │                                      │  ◄─────────────────────────   │
  │  ⑧ { user: { id: 5, email: '...' }} │                               │
  │  ◄─────────────────────────────────  │                               │
  │                                      │                               │
  │  [Show dashboard, load data]         │                               │
```

### Connection 1: Browser ↔ Server (HTTP)

All communication between the browser and server uses **HTTP** (HyperText Transfer Protocol). Every conversation is:

1. **Request:** Browser → Server (includes: method, URL, headers, optional body)
2. **Response:** Server → Browser (includes: status code, headers, body)

These are short-lived connections — each request/response pair is complete on its own. The server doesn't maintain a permanent open connection to every browser (unlike a phone call). This is called **stateless** — each request must include all necessary information.

### Connection 2: Server ↔ Database (TCP)

The server connects to PostgreSQL using a **connection pool** (`pg.Pool`):

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
```

A **connection pool** maintains several open database connections and reuses them. Opening a new database connection is slow (milliseconds), so pools keep a few connections open and ready. When a request comes in, the server grabs a connection from the pool, uses it, then returns it.

`DATABASE_URL` is a connection string like:
```
postgresql://username:password@host.railway.internal:5432/railway
```

This specifies everything PostgreSQL needs to connect: protocol, username, password, host (the server address), port, and database name.

### The Railway Internal Network

On Railway, your Node.js service and PostgreSQL database run in the **same private network**. This means:
- They can talk to each other very fast (sub-millisecond latency)
- The database is NOT exposed to the internet — only your Node.js server can reach it
- You access your server from the internet, and your server accesses the database internally

This is the correct and secure setup.

---

## 9. Authentication

### The Problem: HTTP is Stateless

Every HTTP request is independent. The server doesn't remember previous requests. So after you log in once, how does the server know you're logged in for the *next* request?

The answer: **cookies and tokens**.

### Step 1: Login — Creating a Token

```javascript
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Find the user in the database
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // 2. Check the password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // 3. Create a JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email }, // Payload (data inside the token)
    JWT_SECRET,                          // Secret key
    { expiresIn: '7d' }                  // Expires in 7 days
  );

  // 4. Set the token as a cookie
  res.cookie('token', token, {
    httpOnly: true,  // JavaScript can't read this cookie (XSS protection)
    secure: true,    // Only sent over HTTPS
    sameSite: 'lax', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });

  res.json({ user: { id: user.id, email: user.email } });
});
```

### Password Hashing — Why You Never Store Plain Passwords

```javascript
// When signing up — store a HASH, never the password itself
const hash = await bcrypt.hash(password, 12);
// Store hash in database — looks like: "$2b$12$K1Gq7rFM8..."

// When logging in — compare input against the stored hash
const valid = await bcrypt.compare(inputPassword, storedHash);
```

**Hashing** is a one-way transformation. You can't reverse a hash back to the original password. So if someone steals your database, they get `$2b$12$K1Gq7rFM8...` — useless without knowing the original password.

`bcrypt` is specifically designed for passwords — it's intentionally slow (the `12` is the "cost factor"), making brute-force attacks take years.

### JWT — JSON Web Tokens

A **JWT** (pronounced "jot") is a compact, self-contained token. It looks like:

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6NSwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIn0.abc123xyz
```

It has three parts separated by dots:
1. **Header** — algorithm used (base64 encoded)
2. **Payload** — the data (`{ id: 5, email: 'test@test.com' }`) (base64 encoded)
3. **Signature** — proves it wasn't tampered with

The server creates the token using its secret key. When the browser sends this token back, the server can **verify** it using the same secret — confirming "yes, I created this, it's authentic." It also reads the payload (`id`, `email`) without needing a database lookup.

### Cookies — How the Token Travels

A **cookie** is a small piece of data the server tells the browser to store, and the browser automatically sends back on every future request to the same domain.

```
Server → Browser: "Please store this cookie: token=eyJ..."
Browser: [stores cookie]
Browser → Server: [every future request includes Cookie: token=eyJ...]
```

`httpOnly: true` means JavaScript in the browser cannot read this cookie. This protects against **XSS attacks** (where malicious JavaScript tries to steal your session).

### Checking Auth on Every Protected Request

```javascript
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    // req.user is now { id: 5, email: 'test@test.com', iat: ..., exp: ... }
    next(); // All good — proceed to the actual route
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expired' });
  }
}
```

`jwt.verify()` does two things at once:
1. Checks the signature (proves the server created this token, not someone forging it)
2. Checks expiry (tokens over 7 days old are rejected)

If both pass, the user's info is available as `req.user` in every route handler.

### The Session Check on Page Load

In `auth.js`, the very first thing that runs:

```javascript
async function checkSession() {
  const res = await fetch('/api/auth/me');
  if (res.ok) {
    const data = await res.json();
    onAuthSuccess(data.user); // User is already logged in — show dashboard
  }
  // else: stay on login screen
}

checkSession(); // Runs immediately when the page loads
```

When you refresh the page, the browser still has the cookie. This function checks if that cookie is still valid. If yes, it skips the login screen entirely and goes straight to the dashboard. This is why you don't have to log in every time you visit the site.

---

## 10. APIs

### What is an API?

**API** stands for **Application Programming Interface**. It's a set of defined ways for different programs to communicate.

In web development, when people say "API," they usually mean a **REST API** — a server that responds to HTTP requests with JSON data. Your browser's JavaScript (frontend) communicates with the Node.js server (backend) through this API.

Think of it like a restaurant menu. The menu (API documentation) tells you exactly what you can order (endpoints), what information you need to provide (parameters), and what you'll get back (response format). You don't need to know how the kitchen (database) works — you just follow the menu.

### This Project's API — All Endpoints

**Auth endpoints (no login required):**

| Method | URL | Body | Response | Purpose |
|--------|-----|------|----------|---------|
| POST | `/api/auth/signup` | `{ email, password }` | `{ user }` | Create account |
| POST | `/api/auth/login` | `{ email, password }` | `{ user }` | Log in |
| POST | `/api/auth/logout` | (none) | `{ ok: true }` | Log out |
| GET | `/api/auth/me` | (none) | `{ user }` | Check if logged in |

**Data endpoints (login required):**

| Method | URL | Body | Response | Purpose |
|--------|-----|------|----------|---------|
| GET | `/api/categories` | (none) | `[{ id, name, color }]` | Get all categories |
| POST | `/api/categories` | `{ name, color }` | `{ id, name, color }` | Add category |
| PATCH | `/api/categories/:id` | `{ name?, color? }` | `{ id, name, color }` | Rename/recolor category |
| DELETE | `/api/categories/:id` | (none) | `{ ok: true }` | Delete category |
| GET | `/api/budget?month=&year=` | (none) | `{ amount, month, year }` | Get monthly budget |
| PUT | `/api/budget` | `{ amount, month, year }` | `{ amount, month, year }` | Set monthly budget |
| GET | `/api/expenses?month=&year=` | (none) | `[{ id, amount, ... }]` | Get expenses |
| POST | `/api/expenses` | `{ amount, categoryId, date, description }` | `{ id, amount, ... }` | Add expense |
| DELETE | `/api/expenses/:id` | (none) | `{ ok: true }` | Delete expense |

### The `api()` Helper Function in `app.js`

```javascript
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // Include cookies
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);

  if (res.status === 401) {
    doLogout(); // Session expired — log out automatically
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
```

This wrapper around `fetch()`:
1. Always includes cookies (`credentials: 'same-origin'`) — so the JWT token goes along
2. Always serialises the body as JSON
3. Handles 401 (not logged in) by logging out and redirecting to login screen
4. Throws an error if the server replied with an error status — so callers can use try/catch

Usage is clean:
```javascript
const categories = await api('GET', '/api/categories');
const newCat = await api('POST', '/api/categories', { name: 'Food', color: '#00d4ff' });
await api('DELETE', `/api/categories/${id}`);
```

### JSON — The Language of APIs

**JSON** (JavaScript Object Notation) is the universal format for API data. It looks like JavaScript objects:

```json
{
  "id": 42,
  "amount": 500.00,
  "description": "Lunch",
  "date": "2024-01-15",
  "categoryName": "Food",
  "categoryColor": "#00d4ff"
}
```

- Keys must be strings with double quotes
- Values can be strings, numbers, booleans, arrays, objects, or null
- No trailing commas allowed

On the server: `res.json(data)` converts a JavaScript object to JSON and sends it.
In the browser: `response.json()` parses the JSON back into a JavaScript object.

### URL Parameters

`:id` in a route like `/api/expenses/:id` is a **URL parameter**:

```javascript
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  const id = req.params.id; // "42" if URL was /api/expenses/42
  // ...
});
```

`?month=1&year=2024` in a URL are **query string parameters**:

```javascript
// URL: /api/expenses?month=1&year=2024
app.get('/api/expenses', requireAuth, async (req, res) => {
  const month = req.query.month; // "1"
  const year = req.query.year;   // "2024"
  // ...
});
```

---

## 11. Railway and Deployment

### What is Railway?

Railway is a cloud hosting platform. Instead of managing your own server, Railway:
- Runs your Node.js app 24/7 on their computers
- Gives you a PostgreSQL database
- Gives you a public URL (`https://yourapp.railway.app`)
- Automatically restarts your app if it crashes
- Lets you see logs (console output from your server)

### The `railway.toml` File

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

- `nixpacks` — Railway's build system. It detects your project is Node.js (from `package.json`) and knows how to build it.
- `startCommand = "node server.js"` — After building, run this command to start the server.
- `healthcheckPath = "/health"` — Railway periodically requests `/health`. If it doesn't get a 200 response, it considers the app unhealthy and restarts it.
- `restartPolicyType = "on_failure"` — Automatically restart if the app crashes.

### The `/health` Endpoint

```javascript
app.get('/health', (req, res) => res.json({ status: 'ok' }));
```

This is a tiny endpoint that Railway pings every minute. If it works, the app is healthy. Simple but essential.

### `initDB()` — Auto-Creating Tables

```javascript
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (...);
    CREATE TABLE IF NOT EXISTS categories (...);
    CREATE TABLE IF NOT EXISTS budgets (...);
    CREATE TABLE IF NOT EXISTS expenses (...);
  `);
}

app.listen(PORT, async () => {
  console.log(`Running on port ${PORT}`);
  await initDB(); // Create tables if they don't exist yet
});
```

`CREATE TABLE IF NOT EXISTS` means: "Create this table, but only if it doesn't already exist." So you can safely run this every time the server starts — it won't destroy existing data.

This is called **auto-migration** — the app creates its own database structure when it first starts up. This is why you didn't have to manually run `schema.sql` — `server.js` does it automatically.

### Environment Variables on Railway

In the Railway dashboard, you set:
- `DATABASE_URL` — Railway provides this automatically when you add a PostgreSQL plugin
- `JWT_SECRET` — you set this yourself (a long random string)
- `NODE_ENV` — set to `production`

Railway injects these into the server process as environment variables. Your code accesses them with `process.env.JWT_SECRET`.

---

## 12. Every File, Line by Line

### `server.js` — The Complete Backend

```javascript
'use strict'; // Enable strict mode — catches common mistakes
```

**Strict mode** disables some accidentally dangerous JavaScript features. Always use it.

```javascript
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
```

`require()` is Node.js's way of importing code from other files or installed packages. `path` is a built-in Node.js module for working with file paths.

```javascript
const app = express();
const PORT = process.env.PORT || 3000;
```

`process.env.PORT` — Railway sets this automatically. `|| 3000` means "use 3000 if PORT isn't set." This is the **fallback** pattern.

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```

Creates the PostgreSQL connection pool. On Railway (production), SSL is required. Locally (development), you probably don't have SSL — so it's disabled.

**The DEFAULT_CATEGORIES:**
```javascript
const DEFAULT_CATEGORIES = [
  { name: 'Food',          color: '#00d4ff' },
  { name: 'Transport',     color: '#b347ff' },
  { name: 'Subscriptions', color: '#00fff5' },
  { name: 'Shopping',      color: '#ff2d9b' },
  { name: 'Misc',          color: '#00ff88' },
];
```

When you create a new account, the signup handler inserts these five categories automatically. That's why new users see pre-populated categories.

**The signup transaction:**
```javascript
const client = await pool.connect(); // Get a dedicated connection from pool
try {
  await client.query('BEGIN'); // Start a transaction

  // ... check if email exists ...
  // ... create user ...
  // ... create default categories ...

  await client.query('COMMIT'); // All succeeded — save everything
} catch (err) {
  await client.query('ROLLBACK'); // Something failed — undo everything
  throw err;
} finally {
  client.release(); // Always return the connection to the pool
}
```

A **transaction** is an all-or-nothing operation. Either the user is created AND all 5 categories are created, or NOTHING happens. Without this, you could have a user with no categories if something crashed halfway through.

**The catch-all route:**
```javascript
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

This must be the LAST route defined. It catches any GET request that didn't match a previous route. Since this is a Single Page Application, when someone navigates directly to `https://yourapp.com/settings`, the server should still return `index.html` and let JavaScript handle the routing. Without this, you'd get a 404 for any URL other than `/`.

### `public/index.html` — The Single Page

The HTML file has three main sections:

**The auth screen** — shown when not logged in:
```html
<div id="authScreen" class="auth-screen">
  <!-- Login and signup forms -->
</div>
```

**The app screen** — shown when logged in (hidden by default):
```html
<div id="appScreen" class="app-wrapper" style="display:none">
  <!-- Header, budget panels, charts, categories, transactions -->
</div>
```

**The expense modal** — hidden by default, shown when you click "Add Expense":
```html
<div class="modal-overlay" id="modalOverlay" onclick="handleOverlayClick(event)">
  <div class="modal">
    <!-- Form fields for amount, description, category, date -->
  </div>
</div>
```

`onclick="handleOverlayClick(event)"` on the overlay — clicking the dark area outside the modal calls this function. The function checks if you clicked the overlay itself (not the modal inside):
```javascript
function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}
```

**The canvas elements:**
```html
<canvas id="bgCanvas"></canvas>  <!-- Animated particles background -->
<canvas id="lineChart"></canvas> <!-- Spending trend chart -->
<canvas id="pieCanvas"></canvas> <!-- Category pie chart -->
```

**Script tags:**
```html
<script src="/js/auth.js"></script>
<script src="/js/app.js"></script>
```

Order matters. `auth.js` loads first — it defines `doLogin()`, `doLogout()`, `onAuthSuccess()`, and `checkSession()`. Then `app.js` loads — it defines `initApp()` and `resetAppState()` which `auth.js` calls (`if (typeof initApp === 'function') initApp()`).

### `public/js/auth.js` — Login Logic

This file handles everything related to authentication from the frontend:

- `switchTab('login'/'signup')` — toggles between login and signup forms by showing/hiding divs and adding/removing the `active` class on tab buttons
- `doLogin()` — reads email/password from inputs, sends POST to `/api/auth/login`, shows errors or calls `onAuthSuccess()`
- `doSignup()` — validates passwords match, sends POST to `/api/auth/signup`
- `doLogout()` — sends POST to `/api/auth/logout`, shows auth screen, calls `resetAppState()` to clear budget/expense data
- `onAuthSuccess(user)` — called after both login and signup succeeds. Hides auth screen, shows app screen, displays the user's email in the header, calls `initApp()`
- `checkSession()` — called immediately on page load. Asks the server "am I logged in?" and if yes, goes straight to the app

The keyboard shortcut at the bottom:
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (/* on auth screen */) {
      const isLogin = document.getElementById('loginForm').style.display !== 'none';
      if (isLogin) doLogin();
      else doSignup();
    }
  }
});
```
Pressing Enter on the auth screen submits whichever form is visible.

### `public/js/app.js` — The Full Budget App

**The state object** is the heart of this file:
```javascript
let state = {
  budget: 0,
  expenses: [],
  categories: [],
};
```

Every time data changes, the state is updated, then `updateAll()` is called to re-render the entire UI from state. This is predictable and simple.

**`initApp()`** — called after login:
```javascript
async function initApp() {
  initBackground(); // Start the particle animation
  updateHeader();   // Set month, days left, today's date

  await Promise.all([loadCategories(), loadBudget(), loadExpenses()]);
  // ^ Load all three in PARALLEL (faster than sequential)

  updateAll(false);             // Render UI with loaded data
  setTimeout(() => updateCharts(), 100); // Draw charts slightly later (let layout settle)
}
```

`Promise.all()` starts all three fetches simultaneously and waits until ALL complete. If done sequentially, they'd take 3× as long.

**The chart functions** use the HTML Canvas API to draw custom charts from scratch — no chart library needed. `drawLineChart()` draws daily spending vs budget, `drawCategoryBarChart()` draws bars per category, `drawPieChart()` draws the category breakdown circle.

**`initBackground()`** — the animated particles:
```javascript
const particles = [];
for (let i = 0; i < 80; i++) {
  particles.push({ x, y, vx, vy, r, alpha, color });
}

function draw() {
  // Clear canvas
  // Draw subtle grid lines
  // Move each particle (x += vx, wrap around edges)
  // Draw particle dots with glow effect
  // Draw faint lines between nearby particles
  requestAnimationFrame(draw); // Call draw() again next frame
}
draw();
```

80 particles slowly drift around. If two particles are within 100px of each other, a faint line is drawn between them — creating the constellation/network effect.

---

## 13. End-to-End Journey

Let's trace a complete user story: **A new user signs up and adds their first expense.**

### Step 1: User opens the website

1. Browser sends `GET https://yourapp.railway.app/`
2. `server.js` — no matching API route, falls to catch-all: `res.sendFile('public/index.html')`
3. Browser receives `index.html`, starts reading it
4. Encounters `<link href="/css/style.css">` — sends `GET /css/style.css`, receives the CSS
5. Encounters font links — sends requests to Google Fonts, receives font files
6. Finishes HTML body, encounters `<script src="/js/auth.js">` — fetches and runs it
7. Encounters `<script src="/js/app.js">` — fetches and runs it
8. `auth.js` immediately runs `checkSession()` — sends `GET /api/auth/me`
9. Server checks cookies — no token found — returns `401 Unauthorized`
10. `checkSession()` sees non-OK response — does nothing
11. Auth screen remains visible (it was visible by default)

### Step 2: User signs up

1. User clicks "SIGN UP" tab → `switchTab('signup')` hides login form, shows signup form
2. User fills in email and password, clicks "INITIALIZE SYSTEM"
3. `doSignup()` runs:
   - Validates email/password
   - Sends `POST /api/auth/signup` with `{ email, password }`
4. Server receives the request:
   - `express.json()` middleware parses the JSON body
   - `pool.connect()` — gets a database connection
   - `BEGIN` — starts transaction
   - Checks `SELECT id FROM users WHERE email = $1` — no result (new email)
   - `bcrypt.hash(password, 12)` — hashes the password (takes ~100ms intentionally)
   - `INSERT INTO users ...` — creates the account
   - Loops through 5 default categories, inserts each one
   - `COMMIT` — saves everything
   - `jwt.sign({ id: 5, email: '...' }, JWT_SECRET, { expiresIn: '7d' })` — creates token
   - `res.cookie('token', token, { httpOnly: true, ... })` — sets token as cookie
   - `res.json({ user: { id: 5, email: '...' } })` — sends response
5. Browser receives response. Cookie is stored automatically.
6. `doSignup()` sees `res.ok` is true, calls `onAuthSuccess(data.user)`:
   - Sets `document.getElementById('userEmail').textContent = 'user@example.com'`
   - Hides auth screen: `authScreen.style.display = 'none'`
   - Shows app screen: `appScreen.style.display = ''`
   - Calls `initApp()`

### Step 3: App loads

1. `initApp()` runs:
   - `initBackground()` — starts the particle animation (60fps)
   - `updateHeader()` — sets "March 2024", "28 DAYS LEFT", "28 MAR 2024"
   - `Promise.all([loadCategories(), loadBudget(), loadExpenses()])` — three parallel requests:
     - `GET /api/categories` → server queries database → returns 5 default categories
     - `GET /api/budget?month=3&year=2024` → no budget yet → returns `{ amount: 0 }`
     - `GET /api/expenses?month=3&year=2024` → no expenses yet → returns `[]`
   - State is now: `{ budget: 0, expenses: [], categories: [Food, Transport, ...] }`
   - `updateAll()` renders the entire UI:
     - Budget shows ₹0, spent ₹0, remaining ₹0
     - Progress bar at 0%
     - Transaction list shows "NO TRANSACTIONS THIS MONTH"
     - Category list shows 5 items
     - Charts draw "NO DATA YET"

### Step 4: User sets a budget

1. User types `10000` in the budget input, clicks "SET"
2. `setBudget()` runs:
   - Reads `parseFloat(document.getElementById('budgetInput').value)` = 10000
   - Sends `PUT /api/budget` with `{ amount: 10000, month: 3, year: 2024 }`
3. Server:
   - Runs the UPSERT — no existing budget for this month, so INSERT
   - Returns `{ amount: 10000, month: 3, year: 2024 }`
4. `setBudget()` receives response:
   - `state.budget = 10000`
   - Clears the input field
   - Calls `updateAll()` — UI re-renders with ₹10,000 budget

### Step 5: User adds an expense

1. User clicks "ADD EXPENSE"
2. `openModal()` runs:
   - Populates the category dropdown from `state.categories`
   - Sets today's date in the date field
   - Shows the modal: `modalOverlay.classList.add('active')`
   - Focuses the amount field
3. User types 500, types "Lunch", selects "Food", leaves today's date
4. Clicks "CONFIRM"
5. `addExpense()` runs:
   - Reads: amount=500, categoryId=1 (Food's id), date='2024-03-28', description='Lunch'
   - Disables the CONFIRM button (prevents double-submit)
   - Sends `POST /api/expenses` with `{ amount: 500, categoryId: 1, date: '2024-03-28', description: 'Lunch' }`
6. Server:
   - `requireAuth` checks the JWT cookie — valid, `req.user.id = 5`
   - Verifies categoryId=1 belongs to user 5 (security check)
   - `INSERT INTO expenses (user_id, amount, description, category_id, expense_date) VALUES (5, 500, 'Lunch', 1, '2024-03-28') RETURNING id, amount, description, expense_date, category_id`
   - Fetches category name and colour for the response
   - Returns the created expense object
7. `addExpense()` receives the new expense:
   - `state.expenses.push(exp)` — adds to local state
   - `closeModal()` — hides the modal
   - `updateAll()` — re-renders everything:
     - Remaining hero animates from ₹10,000 to ₹9,500
     - Progress bar moves from 0% to 5%
     - Transaction list shows the new ₹500 Lunch entry
     - Charts update
   - `showNotif('₹500.00 added to Food')` — green toast notification appears for 3 seconds

---

## Summary — What You've Learned

Here's what this project teaches you:

| Concept | Where to see it |
|---------|-----------------|
| HTML structure & semantics | `index.html` |
| CSS variables, flexbox, grid, animations | `style.css` |
| DOM manipulation | `auth.js`, `app.js` |
| Async JS, fetch, Promises | `auth.js`, `app.js` |
| State-driven UI | `state` object in `app.js` |
| Canvas drawing API | `drawLineChart()`, `drawPieChart()` in `app.js` |
| Node.js + Express | `server.js` |
| REST API design | All routes in `server.js` |
| PostgreSQL + SQL | `server.js`, `schema.sql` |
| Password hashing | bcrypt usage in `server.js` |
| JWT authentication | `requireAuth`, `setTokenCookie` in `server.js` |
| HTTP cookies | Cookie setup in `server.js`, auto-sent by browser |
| Database transactions | Signup route in `server.js` |
| SQL injection prevention | Parameterised queries (`$1`, `$2`) throughout |
| Environment variables | `.env`, `process.env` usage |
| Cloud deployment | `railway.toml`, Railway environment setup |

---

*This document was written as a complete web development lecture using the Xen Budget Tracker project as the teaching example.*
