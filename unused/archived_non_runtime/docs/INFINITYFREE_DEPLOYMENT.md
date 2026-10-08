# InfinityFree Deployment Guide

This application is a PHP application with JSON-file storage. It is not a static website and does not use MySQL. InfinityFree can be used for a small demonstration only if the account supports this project's PHP version, extensions, rewrite rules, sessions, and writable directories. Free shared hosting is not recommended for real personal, identity, or biometric data.

## Run Locally

Requirements: PHP 8.2 or newer with `openssl`, `mbstring`, `curl`, `fileinfo`, `json`, `session`, and `gd` enabled.

From the project root:

```bash
php check_system.php
php -S 127.0.0.1:8000 router.php
```

Open `http://127.0.0.1:8000/login`. Stop the server with `Ctrl+C`.

You can also run `./start.sh` on Linux/macOS or `start.bat` / `start.ps1` on Windows. The optional `share.sh` / `share.ps1` scripts are for temporary LAN/tunnel demos, not production hosting.

## InfinityFree Compatibility Check

Before uploading, open the InfinityFree control panel and verify:

- The account offers PHP 8.2+ and the extensions listed above.
- Apache `mod_rewrite` and `.htaccess` are enabled.
- PHP sessions work over HTTPS.
- PHP can write to directories inside your account for JSON data and uploaded avatars.
- The account's upload size, execution time, and storage quotas are sufficient for your expected files.

If a required extension, rewrite rule, or writable directory is unavailable, this application will not run correctly on that account. Moving the app to a PHP host/VPS that supports the requirements is the right fix; don't weaken the authorization checks to work around hosting restrictions.

## Upload Layout

Create a site/subdomain in InfinityFree and use its File Manager or FTP. Upload the application into that site's `htdocs` directory. Keep this structure:

```text
htdocs/
  .htaccess
  router.php
  backend/
  frontend/
  check_system.php
```

Do not put the site under `htdocs/frontend`; `frontend/` is a source/assets directory, while friendly pages such as `/login` and `/admin` are routed through `router.php`.

Create these writable directories if they are missing:

```text
backend/data/
backend/data/documents/
backend/data/ratelimit/
frontend/uploads/avatars/
```

If your account includes a PHP selector, set PHP to 8.2 or newer. Upload dotfiles such as `.htaccess` and `.env` using FTP with hidden-file viewing enabled.

## Configure Secrets

Create `htdocs/.env` based on `.env.example`. Set at least:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.example
HRS_MASTER_KEY=REPLACE_WITH_A_UNIQUE_RANDOM_SECRET
```

Generate a high-entropy key locally, for example with `php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'`, and enter it directly into `.env`. Do not commit or share it. Ensure `.env.example` is not present on the server: `config.php` falls back to it when `.env` is absent. The application marks session cookies secure when HTTPS is detected. The `.htaccess` rules below deny web requests for hidden files, but this does not protect a secret from someone with access to your hosting account.

Changing `HRS_MASTER_KEY` after encrypting vault records can make existing data unreadable. Set it before first use and keep a secure offline backup.

## Apache Routing

Create `htdocs/.htaccess` with these rules. They map the browser asset URLs (`/css`, `/js`, `/img`, `/uploads`) into `frontend/`, send application routes to `router.php`, and block direct access to source/data folders.

```apache
Options -Indexes
RewriteEngine On

# Never serve source code, test fixtures, or generated project documents directly.
RewriteRule ^(backend|tests|unused)(/|$) - [F,L,NC]
RewriteCond %{THE_REQUEST} \s/+frontend(?:/|[?\s]) [NC]
RewriteRule ^frontend(?:/|$) - [F,L,NC]
RewriteRule ^(check_system\.php|deploy\.sh|Dockerfile|docker-compose\.ya?ml|nginx\.conf|php\.ini|README\.md|.*\.xlsx)$ - [F,L,NC]

# Do not expose environment files, Git metadata, or editor files.
RewriteRule (^|/)(\.|.*\.log$) - [F,L,NC]

# Existing browser asset URLs remain unchanged.
RewriteRule ^(css|js|img|uploads)/(.*)$ frontend/$1/$2 [L,NC]

# Serve real root files (including router.php); route friendly pages and API URLs.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^ router.php [QSA,L]
```

If InfinityFree rejects an `.htaccess` directive, remove only the rejected directive after checking the host's documentation. Keep directory blocking and front-controller routing. Do not add a rule that exposes `backend/` or `unused/`.

## First Launch

1. Visit `https://your-domain.example/api/health` and confirm it returns healthy JSON.
2. Visit `/login` and authenticate with an administrator account.
3. Change all sample/default passwords before allowing anyone else to access the site.
4. Verify registration, login, logout, avatar upload, and a harmless data update.
5. Confirm `backend/data/` and `frontend/uploads/avatars/` are writable by PHP.
6. Take a backup and confirm you can restore it before adding any data you care about.

The repository includes development/demo data and known sample credentials. Remove the sample users and data, replace all credentials, and never upload actual civilian identities or biometric documents to a public demo account.

## Important Hosting Limits

- InfinityFree does not run this project's Docker Compose, Nginx config, systemd service, or local PHP server command. The `.htaccess` front controller replaces those routing pieces.
- The app stores state in JSON files and relies on filesystem writes/locks. Shared free hosting may throttle or restrict those writes and does not provide database-grade durability or application-managed backups.
- The PHP built-in server and `check_system.php` are development diagnostics, not production services. Do not expose `check_system.php` publicly; the rules above deny it.
- The project loads some UI libraries and fonts from external CDNs. If the host or browser blocks them, icons/styles may be incomplete; bundle those assets locally for a production deployment.
- Before production use, prefer a host with private storage outside the document root, reliable backups, supported PHP extensions, configurable secrets, and a proper database. This is especially important for identity, account, and document data.