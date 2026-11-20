# Fieldnotes Journal — Blog Publishing System

> A modern, full-stack digital editorial magazine and content management system crafted with React 19, TypeScript, Tailwind CSS, Node.js, Express, and MySQL.

---

## 1. Project Overview & Features

**Fieldnotes Journal** is a high-performance publishing platform designed for long-form essays, critical reviews, craft explorations, and community discussions. It provides three distinct, seamlessly integrated environments:

1. **Public Reading Experience:**
   - Contemporary editorial magazine layout featuring Playfair Display and Inter typography.
   - Comprehensive article archive with real-time keyword search, category pills, tag badges, and sorting (Latest vs. Most Appreciated).
   - Single article reading experience with reading time indicators, author biographies, social sharing, user like interactions, and moderated reader discussions.
   - Curated topic collections (`/categories`, `/tags`) and responsive category banners.
   - Informational pages (`/about`, `/contact`), contact inquiry submission form, and custom branded 404 recovery page.
   - Zero-flicker adaptive Light (`#F8F7F3` Paper) and Dark (`#171B19` Deep Forest) themes with an inline anti-FOUC engine.

2. **Creator Desk (Author Workspace — `/dashboard`):**
   - Real-time author metrics: published count, pending review queue, active drafts, and reader appreciation (likes).
   - Story management with status filtering (`DRAFT`, `PENDING`, `APPROVED`, `REJECTED`).
   - Dedicated drafting and editing studio (`/dashboard/posts/new`, `/dashboard/posts/:id/edit`) with excerpt composition, category selection, multi-tag association, featured artwork upload, and custom SEO metadata.
   - One-click submission to the editorial review board.
   - "My Comments" hub tracking user discussion activity across all journal articles.
   - Profile governance for author avatar, biography, and password security.

3. **Admin Control Center (`/admin`):**
   - Live publication command center with database-backed metrics, recent submissions, top-performing articles, user registrations, and reader activity.
   - Story moderation queue: approve articles directly to the live site or reject drafts with mandatory, actionable editorial feedback.
   - Taxonomy management: category and tag CRUD tables with cover artwork uploads and live story counters.
   - Reader comment moderation: approve, reject, or permanently delete discussion comments.
   - Member management: inspect user profiles, publication ratios, appreciation counts, and manage roles (`USER` / `ADMIN`) and account statuses (`ACTIVE` / `DISABLED`).
   - Contact inquiries inbox: read and manage incoming reader inquiries.
   - Media library: asset grid with image previews, file sizes, uploader attribution, and deletion controls.
   - SEO metadata registry: manage title tags, descriptions, keywords, and canonical URLs for system routes and dynamic records.
   - System settings: manage site branding, contact emails, pagination limits, and registration/moderation toggles.

---

## 2. Technology Stack

| Layer | Technologies | Key Packages & Specifications |
|---|---|---|
| **Frontend Framework** | React 19, TypeScript 5.8 | `react` 19.0.0, `react-dom` 19.0.0, `@types/react` |
| **Routing & Client State** | React Router v7 | `react-router-dom` 7.18.5 |
| **Styling & Design System** | Tailwind CSS 3.4, PostCSS, Lucide | `tailwindcss` 3.4.17, `lucide-react` 0.468.0, custom tokens |
| **Bundler & Dev Server** | Vite 6 | `vite` 6.2.6, `@vitejs/plugin-react` 4.4.1 |
| **Alerts & Modals** | SweetAlert2 | `sweetalert2` 11.26.25, custom editorial light & dark themes |
| **HTTP Client** | Axios | `axios` 1.8.4 (with CSRF / credentials support) |
| **Backend Runtime** | Node.js (LTS), Express 5 | `express` 5.1.0, `@types/express` 5.0.1 |
| **Type Safety & Validation** | TypeScript 5.8, Zod | `zod` 4.6.7, `tsx` 4.19.3 |
| **Database Engine** | MySQL 8.0+ / MariaDB 10.11+ | Direct `mysql2/promise` 3.14.1 with parameterized queries |
| **Authentication & Crypto** | JWT, Bcrypt, Argon2 | `jsonwebtoken` 9.0.2, `bcryptjs` 3.0.3, `argon2` 0.44.0 |
| **Security & Middleware** | Helmet, CORS, Cookie-Parser | `helmet` 8.1.0, `cors` 2.8.5, `cookie-parser` 1.4.7, `express-rate-limit` 8.1.0 |
| **File Handling** | Multer, File-Type | `multer` 2.0.2, `file-type` 21.0.0 |
| **Logging** | Pino | `pino` 9.7.0, `pino-http` 10.4.0 |

---

## 3. Prerequisites & Requirements

Before setting up the project locally, ensure your system has the following software installed:

- **Node.js:** `>= 20.x LTS` or `>= 22.x LTS` (Active LTS recommended)
- **npm:** `>= 10.x` (bundled with Node.js)
- **MySQL Server:** `>= 8.0` (or MariaDB `>= 10.11`) running locally on port `3306`

Verify your installed versions:
```sh
node --version
npm --version
mysql --version
```

---

## 4. Local Installation & Setup

### Step 1: Install Dependencies
From the repository root directory, install all workspace packages:
```sh
npm install
```
*This command automatically installs dependencies for both `backend` and `frontend` via npm workspaces.*

---

### Step 2: Configure Environment Variables
Copy the template configuration file `.env.example` to `.env` in the repository root:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**On Linux / macOS:**
```sh
cp .env.example .env
```

Open `.env` in your editor and configure the variables for local development:
```env
NODE_ENV=development
PORT=4000

# Replace 'your_mysql_password' with your actual local MySQL password
DATABASE_URL="mysql://blog_app:your_mysql_password@localhost:3306/blog_management"
DATABASE_SSL=false

# Allowed local origin
CORS_ORIGINS=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173

# Must be at least 32 cryptographically random characters
JWT_ACCESS_SECRET="your_secure_random_secret_at_least_32_chars_long"
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30

LOG_LEVEL=info
```

> **Security Note:** Never commit `.env` files containing real passwords or secrets to Git. The `.gitignore` file is configured to exclude all `.env` files automatically.

---

### Step 3: MySQL Database Setup

1. Open your MySQL command-line client or MySQL Workbench as `root`:
   ```sh
   mysql -u root -p
   ```

2. Run the following SQL statements to create the database and dedicate a local development user:
   ```sql
   CREATE DATABASE IF NOT EXISTS blog_management
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;

   CREATE USER IF NOT EXISTS 'blog_app'@'localhost'
     IDENTIFIED BY 'your_mysql_password';

   GRANT ALL PRIVILEGES ON blog_management.* TO 'blog_app'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

3. Initialize the database schema and tables:
   ```sh
   npm run db:setup
   ```
   *This executes the database migration engine (`backend/src/database/migrate.ts`), which automatically performs a pre-migration safety backup, creates the `schema_migrations` tracking table, and provisions all 19 application tables.*

---

### Step 4: Administrator Account Bootstrap

Public registration creates normal contributor accounts (`USER`). To bootstrap your initial administrator account:

**Option A (Automated Seed Script):**
In `.env`, configure:
```env
ADMIN_EMAIL="admin@example.com"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="YourStrongAdminPassword123!"
```
Then run:
```sh
npm run db:seed
```

**Option B (Manual Registration & SQL Promotion):**
1. Start the application and navigate to `http://localhost:5173/register`.
2. Register a new account (e.g. `your_email@example.com`).
3. Promote the user directly in MySQL:
   ```sql
   USE blog_management;
   UPDATE users SET role = 'ADMIN' WHERE email = 'your_email@example.com';
   ```

---

## 5. Running the Application

Start both development servers in separate terminal windows:

### Terminal 1: Backend API Server (Port 4000)
```sh
npm run dev
```
*Output: `{"level":30,"msg":"Server listening on port 4000"}`*

### Terminal 2: Frontend Client Server (Port 5173)
```sh
npm run dev:frontend
```
*Output: `VITE v6.x.x ready in ... ms ➜ Local: http://localhost:5173/`*

---

## 6. Local URLs & Endpoints

| Service / View | URL | Description |
|---|---|---|
| **Public Website** | `http://localhost:5173/` | Digital editorial journal, article listings, categories, tags |
| **Author Desk** | `http://localhost:5173/dashboard` | Contributor workspace: story creation, drafts, comments, profile |
| **Admin Panel** | `http://localhost:5173/admin` | Editorial CMS: story moderation, taxonomy, users, media, SEO |
| **Backend API Root** | `http://localhost:4000/api/v1` | REST API base route |
| **Health Liveness** | `http://localhost:4000/api/v1/health/live` | Process liveness probe |
| **Health Readiness** | `http://localhost:4000/api/v1/health/ready` | Database connectivity readiness probe |
| **Public Sitemap** | `http://localhost:4000/sitemap.xml` | Search engine indexing sitemap |
| **Robots Policy** | `http://localhost:4000/robots.txt` | Crawler indexing policy |

---

## 7. Available NPM Scripts

### Root Workspace Scripts
| Command | Action |
|---|---|
| `npm run dev` | Starts the backend development server via `tsx watch` |
| `npm run dev:frontend` | Starts the frontend Vite development server with HMR |
| `npm run build` | Compiles backend TypeScript (`tsc -p tsconfig.json`) |
| `npm run build:frontend` | Compiles frontend TypeScript and creates production bundle in `dist/` |
| `npm run start` | Runs the compiled backend production build (`node dist/src/server.js`) |
| `npm run db:setup` | Executes database migrations and provisions tables |

### Backend Specific Scripts (`npm run <script> --prefix backend`)
| Command | Action |
|---|---|
| `npm run build --prefix backend` | Compiles backend to `backend/dist` |
| `npm run db:setup --prefix backend` | Runs migration runner |
| `npm run db:seed --prefix backend` | Seeds or rotates administrator credentials |

### Frontend Specific Scripts (`npm run <script> --prefix frontend`)
| Command | Action |
|---|---|
| `npm run build --prefix frontend` | Runs `tsc -b && vite build` |
| `npm run preview --prefix frontend` | Serves local production build on `http://localhost:4173` |

---

## 8. Roles & Permissions Matrix

| Feature / Action | Visitor (Guest) | Contributor (`USER`) | Administrator (`ADMIN`) |
|---|:---:|:---:|:---:|
| Read published articles & archives | ✅ | ✅ | ✅ |
| Submit contact inquiry | ✅ | ✅ | ✅ |
| Appreciate articles (Likes) | ❌ (requires login) | ✅ | ✅ |
| Submit discussion comments | ❌ (requires login) | ✅ (queued for review) | ✅ (auto-approved) |
| Author & save drafts | ❌ | ✅ | ✅ |
| Submit drafts for review | ❌ | ✅ | ✅ |
| Edit & delete own drafts | ❌ | ✅ | ✅ |
| Access Creator Desk (`/dashboard`) | ❌ | ✅ | ✅ |
| Access Admin CMS (`/admin`) | ❌ | ❌ (403 Forbidden) | ✅ |
| Moderate & publish stories | ❌ | ❌ | ✅ |
| Reject stories with feedback | ❌ | ❌ | ✅ |
| Manage categories & tags | ❌ | ❌ | ✅ |
| Moderate reader comments | ❌ | ❌ | ✅ |
| Manage member accounts & roles | ❌ | ❌ | ✅ |
| View contact inquiry inbox | ❌ | ❌ | ✅ |
| Manage Media Library & upload assets | ❌ | ❌ (personal only) | ✅ (global library) |
| Configure SEO metadata & settings | ❌ | ❌ | ✅ |

---

## 9. Database Backup & Restore

### Automated Pre-Migration Backups
When running `npm run db:setup`, the built-in backup engine ([backend/src/database/backup.ts](file:///d:/MOHIT/Blog/backend/src/database/backup.ts)) automatically duplicates all existing tables into a versioned database snapshot (e.g. `blog_management_backup_20261120_...`) prior to applying migrations.

### Manual Backup (Logical Dump)
To generate a full SQL dump using `mysqldump`:
```sh
mysqldump -u blog_app -p \
  --routines --triggers --single-transaction \
  blog_management > blog_management_backup.sql
```

### Manual Restore
To restore an existing SQL dump into MySQL:
```sh
mysql -u blog_app -p blog_management < blog_management_backup.sql
```

---

## 10. Troubleshooting Common Issues

### 1. `ECONNREFUSED 127.0.0.1:3306`
- **Cause:** MySQL Server service is not running.
- **Solution:**
  - On Windows: Open Services (`services.msc`), find **MySQL80**, and click **Start**. Alternatively run: `net start MySQL80`.
  - On Linux: Run `sudo systemctl start mysql`.

### 2. `ER_ACCESS_DENIED_ERROR`
- **Cause:** The username or password specified in `DATABASE_URL` is incorrect, or the user lacks permissions.
- **Solution:** Verify your `.env` connection string:
  ```
  DATABASE_URL="mysql://blog_app:YOUR_PASSWORD@localhost:3306/blog_management"
  ```
  Test connecting directly from your terminal using `mysql -u blog_app -p blog_management`.

### 3. `EADDRINUSE: address already in use :::4000` or `:::5173`
- **Cause:** Another process is already running on the backend or frontend port.
- **Solution:**
  - Check active processes:
    - Windows: `Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force`
    - Linux: `fuser -k 4000/tcp`
  - Or configure a different `PORT` in `.env`.

### 4. `JWT_ACCESS_SECRET must be at least 32 characters`
- **Cause:** Zod schema validates that `JWT_ACCESS_SECRET` contains at least 32 characters for cryptographic security.
- **Solution:** Generate a secure string:
  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Paste the resulting 64-character string into `JWT_ACCESS_SECRET` in `.env`.

### 5. Images or Uploads Return 404
- **Cause:** The image upload directory does not exist or lacks write permissions.
- **Solution:** Ensure `backend/uploads/` exists with proper write access. Verify that `Vite` proxy is routing `/uploads` to `http://localhost:4000/uploads`.

---

## 11. Production Build & Deployment

To prepare the application for production deployment:

```sh
# 1. Compile backend TypeScript
npm run build

# 2. Compile frontend assets
npm run build:frontend
```

- The backend production entry point is `backend/dist/src/server.js`.
- The frontend compiled single-page application is located in `frontend/dist`.
- For detailed production infrastructure, Nginx configuration, PM2 / systemd process management, SSL/TLS certificates, and security hardening, consult [DEPLOYMENT.md](file:///d:/MOHIT/Blog/DEPLOYMENT.md).
- For complete entity-relationship diagrams and database schema design, consult [DATABASE_ERD.md](file:///d:/MOHIT/Blog/DATABASE_ERD.md).

---

## 12. License & Colophon

- **License:** Proprietary / Private Publication System.
- **Typography:** Playfair Display (Headings) & Inter (Body).
- **Colophon:** Designed and built for Fieldnotes Journal. All rights reserved.
