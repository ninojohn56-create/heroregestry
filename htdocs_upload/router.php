<?php
declare(strict_types=1);

// Global Security Headers
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-XSS-Protection: 1; mode=block');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.tailwindcss.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://*.arcgisonline.com https://services.arcgisonline.com https://unpkg.com https://images.unsplash.com; connect-src 'self' https://api.openweathermap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://*.arcgisonline.com; frame-ancestors 'self';");
header("Permissions-Policy: camera=(self), microphone=(), geolocation=()");

$rawUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

// Normalize legacy or direct /public/ asset paths so all client links resolve to /frontend/
if (str_starts_with($rawUri, '/public/')) {
    $rawUri = substr($rawUri, 7);
    if ($rawUri === '' || $rawUri[0] !== '/') {
        $rawUri = '/' . $rawUri;
    }
}

// 1. Strict Security Perimeter: Deny direct access to dotfiles, backend internals, or sensitive files
if (
    preg_match('#(^|/)\.#', $rawUri) ||
    str_starts_with($rawUri, '/backend') ||
    str_starts_with($rawUri, '/tests') ||
    str_starts_with($rawUri, '/scratch') ||
    str_starts_with($rawUri, '/docs') ||
    str_starts_with($rawUri, '/unused') ||
    preg_match('#/(Dockerfile|docker-compose\.ya?ml|nginx\.conf|share\.(sh|bat|ps1)|start\.(sh|bat|ps1)|deploy\.sh|php\.ini)$#i', $rawUri)
) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=UTF-8');
    exit("403 Forbidden: Access Denied\n");
}

// 2. Static assets in frontend directory (css, js, images, fonts)
$frontendDir = realpath(__DIR__ . '/frontend');
if ($frontendDir !== false) {
    $filePath = $frontendDir . $rawUri;
    $realFilePath = realpath($filePath);

    // Traversal defense: ensure target resolves strictly within public directory
    if ($realFilePath !== false) {
        if (!str_starts_with($realFilePath, $frontendDir . DIRECTORY_SEPARATOR) && $realFilePath !== $frontendDir) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=UTF-8');
            exit("403 Forbidden: Traversal Denied\n");
        }

        if (!is_dir($realFilePath)) {
            $ext = strtolower(pathinfo($realFilePath, PATHINFO_EXTENSION));
            if ($ext !== 'html' && $ext !== 'php') {
                if (isset($_SERVER['DOCUMENT_ROOT']) && realpath($_SERVER['DOCUMENT_ROOT']) === $frontendDir) {
                    return false;
                }
                $mimes = [
                    'css'   => 'text/css; charset=UTF-8',
                    'js'    => 'application/javascript; charset=UTF-8',
                    'json'  => 'application/json; charset=UTF-8',
                    'jpg'   => 'image/jpeg',
                    'jpeg'  => 'image/jpeg',
                    'png'   => 'image/png',
                    'gif'   => 'image/gif',
                    'svg'   => 'image/svg+xml',
                    'webp'  => 'image/webp',
                    'ico'   => 'image/x-icon',
                    'woff2' => 'font/woff2',
                    'woff'  => 'font/woff',
                    'ttf'   => 'font/ttf'
                ];
                header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
                header('Content-Length: ' . (string)filesize($realFilePath));
                readfile($realFilePath);
                exit;
            }
        }
    }
}

$uri = rtrim($rawUri, '/');
// Normalize .html and .php extensions so bookmarks, direct file links, and DirectoryIndex resolve cleanly
$uri = preg_replace('/\.(html|php)$/i', '', $uri);
if (empty($uri)) {
    $uri = '/';
}

require_once __DIR__ . '/backend/auth.php';

// 1. API Route forwarding
if (strpos($uri, '/api') === 0) {
    require __DIR__ . '/backend/api.php';
    exit;
}

AuthService::initSession();
AuthService::seedUsers();

// 2. Logout route
if ($uri === '/logout') {
    AuthService::logout();
    header('Location: /login');
    exit;
}

// 3. Login route (always public)
if ($uri === '/login') {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/login.html');
    exit;
}

// 4. Registration route (public — unauthenticated heroes can self-register)
if ($uri === '/register') {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/register.html');
    exit;
}

// Helper: redirect unauthenticated users to login with target deep-link
function requireLogin(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    $target = $_SERVER['REQUEST_URI'] ?? '';
    $redirParam = (!empty($target) && $target !== '/' && $target !== '/login') ? '?redirect=' . urlencode($target) : '';
    header('Location: /login' . $redirParam);
    exit;
}

// Helper: send 403 access denied page
function denyAccess(string $requiredRole): void {
    http_response_code(403);
    header('Content-Type: text/html; charset=UTF-8');
    $escaped = htmlspecialchars($requiredRole, ENT_QUOTES);
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHRMS | Access Denied</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;background:var(--bg-base,#0a0d14);color:var(--text-main,#e2e8f0);text-align:center;padding:1rem;">
  <div style="font-size:1rem;font-weight:800;letter-spacing:0.1em;color:#ef4444;background:rgba(239,68,68,0.15);padding:6px 14px;border:1px solid #ef4444;border-radius:6px;">[RESTRICTED CLEARANCE]</div>
  <h1 style="font-size:1.75rem;font-weight:800;color:#ef4444;margin:0;">ACCESS DENIED</h1>
  <p style="color:#94a3b8;max-width:440px;margin:0;font-size:0.95rem;">Insufficient security clearance for this terminal.</p>
  <p style="color:#64748b;font-size:0.85rem;margin:0;font-family:var(--font-mono, monospace);">Required: {$escaped}</p>
  <div style="display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap;justify-content:center;">
    <a href="/login?redirect=%2Fadmin" style="padding:0.6rem 1.4rem;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.85rem;">Authenticate as Super Admin →</a>
    <a href="/registrar" style="padding:0.6rem 1.4rem;background:rgba(255,255,255,0.08);color:#94a3b8;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.85rem;">Return to Registrar Desk</a>
  </div>
</body>
</html>
HTML;
    exit;
}

$currentUser = AuthService::getCurrentUser();
$role = $currentUser['role'] ?? null;

// Release session lock so concurrent static/API requests run without delay
if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

// 5. HERO PORTAL (HERO, REGISTRAR, SUPER_ADMIN)
if ($uri === '/hero') {
    if (!$currentUser) {
        requireLogin();
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/hero.html');
    exit;
}

// 6. REGISTRAR DESK (REGISTRAR, ADMIN, SUPER_ADMIN)
if ($uri === '/registrar') {
    if (!$currentUser) {
        requireLogin();
    }
    if ($role !== 'REGISTRAR' && $role !== 'ADMIN' && $role !== 'SUPER_ADMIN') {
        denyAccess('REGISTRAR');
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/registrar.html');
    exit;
}

// 7. SUPER ADMIN COMMAND CENTER (SUPER_ADMIN, ADMIN)
if ($uri === '/admin') {
    if (!$currentUser) {
        requireLogin();
    }
    if ($role !== 'SUPER_ADMIN' && $role !== 'ADMIN') {
        denyAccess('SUPER_ADMIN (Clearance Level 5)');
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/admin.html');
    exit;
}

// 8. SENTINEL CHECKPOINT TERMINAL (REGISTRAR, ADMIN, SUPER_ADMIN)
if ($uri === '/sentinel') {
    if (!$currentUser) {
        requireLogin();
    }
    if ($role !== 'SUPER_ADMIN' && $role !== 'ADMIN' && $role !== 'REGISTRAR') {
        denyAccess('REGISTRAR');
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/sentinel.html');
    exit;
}

// 9. SUPERHUMAN OPERATIVE DIRECTORY — REGISTRAR ACCESS (REGISTRAR, ASSESSOR, ADMIN, SUPER_ADMIN)
if ($uri === '/registry') {
    if (!$currentUser) {
        requireLogin();
    }
    // Normal heroes cannot access the full operative directory — redirect to Hero Dashboard
    if ($role === 'HERO') {
        header('Location: /hero?denied=registry');
        exit;
    }
    // Only Registrar, Assessor, and Administrator roles retain registry directory access
    if ($role !== 'REGISTRAR' && $role !== 'ASSESSOR' && $role !== 'ADMIN' && $role !== 'SUPER_ADMIN') {
        denyAccess('REGISTRAR / ASSESSOR');
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend/registry.html');
    exit;
}

// 9. Check if matching HTML or public file exists
if (file_exists(__DIR__ . '/frontend' . $uri . '.html')) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend' . $uri . '.html');
    exit;
}
if (!empty($uri) && $uri !== '/' && file_exists(__DIR__ . '/frontend' . $uri) && !is_dir(__DIR__ . '/frontend' . $uri)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile(__DIR__ . '/frontend' . $uri);
    exit;
}

// 10. Root Gateway - Removed Image 1 (Landing Matrix)
if ($uri === '/' || $uri === '/index') {
    if (!$currentUser) {
        header('Location: /login');
        exit;
    }
    if ($role === 'SUPER_ADMIN' || $role === 'ADMIN') {
        header('Location: /admin');
        exit;
    } elseif ($role === 'REGISTRAR' || $role === 'ASSESSOR') {
        header('Location: /registrar');
        exit;
    } else {
        header('Location: /hero');
        exit;
    }
}

// 11. 404 Not Found for unmapped routes
http_response_code(404);
header('Content-Type: text/html; charset=UTF-8');
echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHRMS | 404 Not Found</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;background:var(--bg-base,#0a0d14);color:var(--text-main,#e2e8f0);">
  <div style="font-size:1.2rem;font-weight:800;letter-spacing:0.1em;color:#38bdf8;background:rgba(56,189,248,0.15);padding:6px 14px;border:1px solid #38bdf8;border-radius:4px;">[DIRECTIVE NOT FOUND]</div>
  <h1 style="font-size:2rem;font-weight:800;color:#f8fafc;margin:0;">404 — NOT FOUND</h1>
  <p style="color:#94a3b8;margin:0;">The requested terminal directive or resource does not exist.</p>
  <a href="/login" style="margin-top:1rem;padding:0.6rem 1.5rem;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Return to Security Clearance Login</a>
</body>
</html>
HTML;
exit;

