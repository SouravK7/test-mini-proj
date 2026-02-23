# COET Ground Booking System — Setup Guide

Follow these steps to set up and run the project locally.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | ≥ 18.0.0 | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | ≥ 14 | [postgresql.org/download](https://www.postgresql.org/download/) |
| **Git** | Any | [git-scm.com](https://git-scm.com/) |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/SouravK7/test-mini-proj.git
cd test-mini-proj
```

---

## Step 2 — Install Backend Dependencies

```bash
cd backend
npm install
```

This installs: `express`, `pg`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`.

---

## Step 3 — Set Up PostgreSQL Database

### 3a. Create the database

Open a terminal and run:

```bash
psql -U postgres
```

Then in the PostgreSQL prompt:

```sql
CREATE DATABASE coet_ground_booking;
\q
```

### 3b. Run the schema

This creates all tables and inserts sample data (demo users, resources, time slots):

```bash
psql -U postgres -d coet_ground_booking -f schema.sql
```

> **Note:** If your PostgreSQL user is different from `postgres`, replace it in the commands above.

---

## Step 4 — Configure Environment Variables

Create a `.env` file inside the `backend/` folder:

```bash
cp .env.example .env
```

If `.env.example` doesn't exist, create `backend/.env` manually with:

```env
# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/coet_ground_booking

# JWT Configuration
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration (comma-separated origins)
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

> ⚠️ **Replace `YOUR_PASSWORD`** with your actual PostgreSQL password.

---

## Step 5 — Start the Backend Server

```bash
cd backend
npm start
```

You should see: `🚀 Server running on http://localhost:3000`

---

## Step 6 — Start the Frontend

Open a **new terminal** in the project root and run:

```bash
# Option A: Python (comes pre-installed on macOS/Linux)
python3 -m http.server 5500

# Option B: Node.js serve
npx -y serve -l 5500 .

# Option C: Use VS Code Live Server extension (right-click index.html → Open with Live Server)
```

---

## Step 7 — Open the App

Open your browser and go to: **http://localhost:5500**

### Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@coet.edu | admin123 |
| **Faculty** | faculty@coet.edu | faculty123 |
| **Student** | user@coet.edu | user123 |

---

## Project Structure

```
test-mini-proj/
├── index.html              # Login page
├── pages/                  # All app pages (dashboard, bookings, etc.)
├── css/                    # Stylesheets
├── js/                     # Frontend JavaScript
│   ├── app.js              # Main application logic
│   ├── auth.js             # Authentication module
│   ├── theme.js            # Dark/Light mode toggle
│   └── ...
├── backend/
│   ├── server.js           # Express server
│   ├── schema.sql          # Database schema + sample data
│   ├── package.json        # Node.js dependencies
│   ├── config/             # Database configuration
│   └── .env                # Environment variables (NOT in git)
└── docs/                   # Documentation
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm start` fails with DB error | Check your `DATABASE_URL` in `.env` matches your PostgreSQL credentials |
| Login shows "Network error" | Make sure the backend is running on port 3000 |
| Pages don't load styles | Make sure you're accessing via `http://localhost:5500`, not opening files directly |
| PostgreSQL connection refused | Ensure PostgreSQL service is running: `brew services start postgresql` (macOS) or `sudo service postgresql start` (Linux) |
