# NovaPulse — Asana-Style Collaborative Workspace

A real-time, collaborative project management platform featuring **Asana's signature interface**, WebSockets live synchronization, dual-mode database engine (Supabase PostgreSQL & SQLite fallback), interactive task inspector drawer, OKR goals, executive portfolios, and rich celebratory micro-interactions.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Usman3660/CodeAlpha-NovaPulse-Workspace
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your `.env` file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

### 4. Start the application
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🔑 Environment Variables & Keys

> [!IMPORTANT]
> The `.env` file contains sensitive passwords and secrets and is ignored by `.gitignore`. **Never commit your `.env` file to GitHub.**

### Required Variables:
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Local web server port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `JWT_SECRET` | Secret key for JWT token signing | `your_secret_key_min_32_chars` |
| `DATABASE_URL` | Supabase / PostgreSQL URI | `postgresql://postgres...` |
| `SUPABASE_URL` | Supabase Project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | Supabase Anonymous Key | `eyJhbGciOi...` |

### 🗄️ Automatic SQLite Fallback
If `DATABASE_URL` is omitted or Supabase is temporarily unreachable, NovaPulse **automatically falls back to local SQLite** (`db/novapulse.sqlite`). This allows anyone to clone and run the app out-of-the-box with zero database setup required!

---

## 👥 Demo Personas (1-Click Login)

The system comes pre-seeded with 3 collaborative personas:
- **Usman** (`usman@example.com` / `password123`) — Product Lead
- **Ali** (`ali@example.com` / `password123`) — Full-Stack Developer
- **Ahmad** (`ahmad@example.com` / `password123`) — UI/UX Designer

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), Modern HTML5, Responsive CSS3, Lucide Icons, Three.js 3D Background, Canvas Confetti.
- **Backend**: Node.js, Express.js, Socket.IO (Real-time sync), Helmet & Rate-Limiter security.
- **Database**: Dual-engine with **Supabase (PostgreSQL)** connection pooler & **SQLite3** local fallback.
