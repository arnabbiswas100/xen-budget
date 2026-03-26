# Xen Budget Tracker — Full Stack
## Live Demo
https://xen-budget-production.up.railway.app/

A cyberpunk-themed budget tracker with PostgreSQL backend, JWT auth, and Railway deployment.

## Project Structure

```
xen-budget/
├── server.js           # Express API server
├── schema.sql          # PostgreSQL schema (run once)
├── package.json
├── railway.toml        # Railway deployment config
├── .env.example        # Environment variables template
└── public/
    ├── index.html      # App HTML (auth + tracker screens)
    ├── css/
    │   └── style.css   # All styles
    └── js/
        ├── auth.js     # Login / signup / logout
        └── app.js      # Budget tracker logic (API-driven)
```

## Local Development

```bash
npm install

# Set up .env (copy from .env.example and fill in values)
cp .env.example .env

# Create the DB tables (run once against your Postgres)
psql $DATABASE_URL < schema.sql

npm run dev   # uses nodemon
```

## Deploy to Railway

### 1. Create Railway project
```bash
railway login
railway init
```

### 2. Add PostgreSQL plugin
In Railway dashboard → your project → **+ New** → **Database** → **PostgreSQL**.

### 3. Set environment variables
In Railway dashboard → your service → **Variables**:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | Any long random string (32+ chars) |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Auto-set by Railway when Postgres is linked |

### 4. Run schema
In Railway dashboard → your Postgres service → **Connect** → copy the connection URL, then:
```bash
psql "your-railway-postgres-url" < schema.sql
```
Or use the Railway shell.

### 5. Deploy
```bash
railway up
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | — | Register |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/logout` | — | Logout |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/categories` | ✓ | List categories |
| POST | `/api/categories` | ✓ | Add category |
| PATCH | `/api/categories/:id` | ✓ | Rename category |
| DELETE | `/api/categories/:id` | ✓ | Delete category |
| GET | `/api/budget?month=&year=` | ✓ | Get monthly budget |
| PUT | `/api/budget` | ✓ | Set monthly budget |
| GET | `/api/expenses?month=&year=` | ✓ | List expenses |
| POST | `/api/expenses` | ✓ | Add expense |
| DELETE | `/api/expenses/:id` | ✓ | Delete expense |
