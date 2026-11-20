# Production Deployment & Operations Guide
## Blog Management System (*Fieldnotes Journal*)

This document provides complete, production-grade instructions for deploying, securing, operating, and maintaining the Blog Management System in a real-world Linux / Cloud environment.

---

## 1. System Requirements

### Hardware Recommendations
- **Minimum:** 1 vCPU, 1 GB RAM, 15 GB SSD Storage
- **Recommended:** 2 vCPU, 2–4 GB RAM, 30+ GB SSD Storage

### Software Stack
| Component | Supported Version | Notes |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS / 24.04 LTS, Debian 12, RHEL 9 | Any standard Linux distribution with systemd |
| **Node.js** | Node.js **>= 20.x LTS** or **>= 22.x LTS** | Active or Maintenance LTS release |
| **Package Manager** | npm **>= 10.x** | Bundled with Node.js LTS |
| **Database** | MySQL **>= 8.0** or MariaDB **>= 10.11** | Must support `utf8mb4` character set |
| **Web Server / Proxy** | Nginx **>= 1.22** | Acts as reverse proxy, SSL terminator, static file server |
| **Process Manager** | PM2 or systemd | For zero-downtime restarts and daemon management |

---

## 2. Environment Architecture & Variable Configuration

The application is structured as a TypeScript workspace monorepo:
- **Backend:** Express.js API listening by default on port `4000`.
- **Frontend:** React + Vite single-page application compiled to static HTML/CSS/JS in `frontend/dist`.

### Production `.env` Template
Create `.env` in the project root (`/var/www/blog/.env`) or supply environment variables through your systemd service / container environment:

```env
# ==============================================================================
# RUNTIME ENVIRONMENT
# ==============================================================================
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# ==============================================================================
# DATABASE CONNECTION
# ==============================================================================
# Replace blog_user, STRONG_PASSWORD, and database name with production credentials.
DATABASE_URL="mysql://blog_user:YOUR_STRONG_PROD_PASSWORD@127.0.0.1:3306/blog_management"

# Set to true if connecting to a managed cloud database (AWS RDS, Cloud SQL) requiring SSL/TLS.
DATABASE_SSL=false

# ==============================================================================
# DOMAIN & NETWORKING (NO LOCALHOST IN PRODUCTION)
# ==============================================================================
# Exact public URL of the website with https:// (used for sitemap.xml, robots.txt, canonical SEO)
PUBLIC_SITE_URL=https://yourdomain.com

# Comma-separated list of allowed frontend origins for CORS and CSRF origin verification
CORS_ORIGINS=https://yourdomain.com

# Enable trust proxy when running behind Nginx, Cloudflare, or AWS ALB.
# Essential for accurate client IP rate limiting and X-Forwarded-For processing.
TRUST_PROXY=1

# ==============================================================================
# AUTHENTICATION & SECURITY
# ==============================================================================
# Cryptographically random secret of at least 32 characters.
# Generate with: openssl rand -base64 36
JWT_ACCESS_SECRET=REPLACE_WITH_A_REAL_SECURE_RANDOM_SECRET_AT_LEAST_32_CHARS

ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30

# Cookie settings
# Set COOKIE_DOMAIN if the frontend and backend share subdomains (e.g., .yourdomain.com)
# COOKIE_DOMAIN=.yourdomain.com
COOKIE_SAME_SITE=lax

# ==============================================================================
# STORAGE & UPLOADS
# ==============================================================================
# Custom path for persistent uploads (optional; defaults to backend/uploads).
# UPLOAD_DIR=/var/data/blog-uploads

# ==============================================================================
# FRONTEND BUILD CONFIGURATION
# ==============================================================================
# When serving frontend and backend under the same Nginx domain, leave as /api/v1.
# If hosting backend on a dedicated subdomain, set to: https://api.yourdomain.com/api/v1
VITE_API_URL=/api/v1
```

> [!IMPORTANT]
> **Production Fail-Safe Validation:**
> The backend automatically validates environment configuration on boot. If `NODE_ENV=production` is detected, the server will **fail to start** if:
> - `PUBLIC_SITE_URL` contains `localhost` or `127.0.0.1`.
> - `CORS_ORIGINS` contains `localhost` or `127.0.0.1`.
> - `JWT_ACCESS_SECRET` contains template placeholders (`replace-with` or `example`).

---

## 3. Database Setup & Least-Privilege Permissions

### Step 1: Create Database and Production User
Log in to MySQL as root:
```bash
sudo mysql -u root -p
```

Run the following SQL statements to configure a dedicated user with minimum required privileges:
```sql
CREATE DATABASE IF NOT EXISTS blog_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'blog_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PROD_PASSWORD';

-- Grant required data manipulation and schema execution permissions:
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, REFERENCES
  ON blog_management.* TO 'blog_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

### Step 2: Apply Database Schema & Migrations
From the project root:
```bash
npm run db:setup
```
This executes `backend/database/migrations` transactionally, records executed migrations in the `schema_migrations` table, and verifies all 19 database tables.

---

## 4. Production Build Process

### Step 1: Clone Repository and Install Dependencies
```bash
# Clone to web root
sudo mkdir -p /var/www/blog
sudo chown -R $USER:$USER /var/www/blog
cd /var/www/blog

# Install clean production dependencies
npm ci
```

### Step 2: Build Backend
```bash
npm run build --prefix backend
```
Compiles TypeScript into pure JavaScript in `backend/dist`.

### Step 3: Build Frontend
```bash
npm run build --prefix frontend
```
Bundles the React application into optimized static assets in `frontend/dist`.

---

## 5. Process Management (Running the Backend Service)

### Option A: Using systemd (Recommended for Standard Linux Servers)
Create a systemd service file:
```bash
sudo nano /etc/systemd/system/blog-backend.service
```

Paste the following configuration:
```ini
[Unit]
Description=Blog Management System Backend API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/blog/backend
EnvironmentFile=/var/www/blog/.env
ExecStart=/usr/bin/node dist/src/server.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=blog-backend

# Security Sandbox Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable blog-backend
sudo systemctl start blog-backend
sudo systemctl status blog-backend
```

### Option B: Using PM2
If preferred, run via PM2:
```bash
npm install -g pm2
pm2 start backend/dist/src/server.js --name "blog-api" -i max --env production
pm2 save
pm2 startup
```

---

## 6. Nginx Web Server & Reverse Proxy Configuration

Nginx serves frontend static assets, routes API traffic to the backend, delivers uploaded media with security headers, and handles SSL/TLS termination.

Create an Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/blog.conf
```

Add the following configuration (replace `yourdomain.com` with your live domain):

```nginx
# HTTP - Redirect all traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Certbot ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Production Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Global Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Uploads max file size
    client_max_body_size 10M;

    # 1. Frontend Static Single-Page Application (SPA)
    root /var/www/blog/frontend/dist;
    index index.html;

    # Long-term caching for immutable frontend static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Dynamic SEO & Crawlers (Pass to Backend)
    location = /robots.txt {
        proxy_pass http://127.0.0.1:4000/robots.txt;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:4000/sitemap.xml;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Backend API Endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # 4. Uploaded Media Directory (Secure Static Serving)
    location /uploads/ {
        alias /var/www/blog/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Content-Security-Policy "default-src 'none'" always;

        # Prevent executing any active scripts / PHP / CGI
        location ~ \.(php|pl|py|jsp|asp|sh|cgi|exe)$ {
            deny all;
        }

        try_files $uri =404;
    }
}
```

Enable the site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/blog.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. HTTPS / SSL Setup (Let's Encrypt Certbot)

Install and run Certbot:
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Obtain and automatically install certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Test automatic certificate renewal:
```bash
sudo certbot renew --dry-run
```

---

## 8. Upload Directory File System Security

Ensure the web server / Node user can write to `uploads` while preventing executable access:

```bash
# Set ownership to the service user (www-data)
sudo chown -R www-data:www-data /var/www/blog/backend/uploads

# Restrict permissions: directories 750, files 644
sudo find /var/www/blog/backend/uploads -type d -exec chmod 750 {} \;
sudo find /var/www/blog/backend/uploads -type f -exec chmod 644 {} \;
```

---

## 9. Backup and Disaster Recovery

### Database Backup (`mysqldump`)
Run an immediate online backup with single-transaction consistency:
```bash
mysqldump -u blog_user -p \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  blog_management | gzip > /var/backups/blog_db_$(date +%F_%H%M%S).sql.gz
```

### Database Restore
To restore from a backup:
```bash
gunzip < /var/backups/blog_db_2026-11-19_120000.sql.gz | mysql -u blog_user -p blog_management
```

### Media Files Backup
```bash
tar -czvf /var/backups/blog_uploads_$(date +%F).tar.gz /var/www/blog/backend/uploads
```

### Automated Daily Cron Job
Create `/etc/cron.daily/blog-backup`:
```bash
sudo nano /etc/cron.daily/blog-backup
```
Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/blog"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%F)

# Backup DB
mysqldump -u blog_user -pYOUR_STRONG_PROD_PASSWORD --single-transaction --quick blog_management | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup Uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /var/www/blog/backend uploads

# Keep last 14 days of backups
find "$BACKUP_DIR" -type f -mtime +14 -delete
```
Make executable:
```bash
sudo chmod +x /etc/cron.daily/blog-backup
```

---

## 10. Troubleshooting Common Deployment Issues

| Symptom | Probable Cause | Resolution |
| :--- | :--- | :--- |
| **502 Bad Gateway** | Node.js backend service is not running or listening on port 4000. | Check `sudo systemctl status blog-backend` and logs: `sudo journalctl -u blog-backend -n 50`. |
| **CORS Origin Denied (403)** | `CORS_ORIGINS` in `.env` does not match the browser's origin. | Verify `CORS_ORIGINS=https://yourdomain.com` (protocol and domain must match exactly). |
| **Users logged out on refresh** | Cookie not accepted because `secure: true` requires HTTPS or wrong `COOKIE_DOMAIN`. | Verify access is through `https://`. If using subdomains, set `COOKIE_DOMAIN=.yourdomain.com`. |
| **Rate Limit 429 for all users** | Nginx IP forwarding is not trusted by Express. | Ensure `TRUST_PROXY=1` is set in `.env` so Express reads `X-Forwarded-For`. |
| **Image uploads fail with 413** | Nginx rejects request exceeding body size limit. | Add `client_max_body_size 10M;` inside your Nginx server block. |
| **Database connection refused** | MySQL service stopped or credentials incorrect in `DATABASE_URL`. | Check `sudo systemctl status mysql` and test connection: `mysql -u blog_user -p blog_management`. |
| **Sitemap / Robots point to localhost** | `PUBLIC_SITE_URL` was not updated in `.env`. | Set `PUBLIC_SITE_URL=https://yourdomain.com` in `.env` and restart backend. |
