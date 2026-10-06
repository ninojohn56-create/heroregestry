<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/rate_limiter.php';

AuthService::initSession();
AuthService::seedUsers();

// Enforce baseline global rate limit on all API endpoints
RateLimiter::check('global_api', 300, 60);

// Set headers for REST JSON API
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none';");

// Cross-Origin Request Validation for State-Changing Methods
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? null;
if ($requestOrigin && in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
    $originHost = parse_url($requestOrigin, PHP_URL_HOST);
    $serverHost = !empty($_SERVER['HTTP_HOST']) ? explode(':', $_SERVER['HTTP_HOST'])[0] : 'localhost';
    $appUrlHost = getenv('APP_URL') ? parse_url(getenv('APP_URL'), PHP_URL_HOST) : null;
    $allowedHosts = array_filter([$serverHost, 'localhost', '127.0.0.1', $appUrlHost]);
    if ($originHost && !in_array($originHost, $allowedHosts, true)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => "CROSS-ORIGIN SECURITY VIOLATION: Untrusted origin '{$requestOrigin}' rejected.",
            'code' => 'FORBIDDEN_ORIGIN'
        ]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function jsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $statusCode = 400, array $details = []): void {
    jsonResponse(array_merge(['success' => false, 'error' => $message], $details), $statusCode);
}

function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Parse path info
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Route normalization: handle both /api/foo and direct api.php?endpoint=foo
$endpoint = '';
if (strpos($uri, '/api/') !== false) {
    $endpoint = substr($uri, strpos($uri, '/api/') + 5);
} elseif (isset($_GET['endpoint'])) {
    $endpoint = trim($_GET['endpoint'], '/');
} else {
    $endpoint = trim($uri, '/');
}

$parts = explode('/', trim($endpoint, '/'));

try {
    // -------------------------------------------------------------
    // Health Check & Liveness Probe: /api/health or /api/system/health
    // -------------------------------------------------------------
    if ($parts[0] === 'health' || $endpoint === 'health' || ($parts[0] === 'system' && ($parts[1] ?? '') === 'health')) {
        $dataWritable = is_writable(DATA_DIR);
        $vaultExists = file_exists(FILE_VAULT);
        $heroesExists = file_exists(FILE_HEROES);
        $usersExists = file_exists(FILE_USERS);
        $auditExists = file_exists(FILE_AUDIT);
        $allOk = $dataWritable && $vaultExists && $heroesExists && $usersExists;

        jsonResponse([
            'status' => $allOk ? 'healthy' : 'degraded',
            'timestamp' => date('c'),
            'app_env' => APP_ENV,
            'checks' => [
                'php_version' => PHP_VERSION,
                'data_dir_writable' => $dataWritable,
                'heroes_datastore' => $heroesExists,
                'vault_datastore' => $vaultExists,
                'users_datastore' => $usersExists,
                'audit_ledger' => $auditExists,
                'crypto_openssl' => extension_loaded('openssl'),
            ]
        ], $allOk ? 200 : 503);
    }

    // -------------------------------------------------------------
    // Auth Routes: /api/auth/login, /api/auth/logout, /api/auth/me
    // -------------------------------------------------------------
    if ($parts[0] === 'auth') {
        $action = $parts[1] ?? '';
        if ($action === 'login' && $method === 'POST') {
            RateLimiter::check('auth_login', 15, 60);
            $body = getJsonBody();
            $username = trim((string)($body['username'] ?? $body['callsign'] ?? ''));
            $password = trim((string)($body['password'] ?? $body['passkey'] ?? ''));

            $user = AuthService::login($username, $password);
            if (!$user) {
                jsonError("Authentication failed: Invalid callsign or security passkey.", 401);
            }

            RateLimiter::reset('auth_login');

            jsonResponse([
                'success' => true,
                'message' => "Security clearance Level {$user['clearance_level']} granted. Welcome, {$user['name']}.",
                'user' => $user
            ]);
        }

        if ($action === 'logout' && $method === 'POST') {
            AuthService::logout();
            jsonResponse([
                'success' => true,
                'message' => 'Session terminated. Clearance revoked.'
            ]);
        }

        if ($action === 'me' && $method === 'GET') {
            $user = AuthService::getCurrentUser();
            if (!$user) {
                jsonResponse([
                    'success' => false,
                    'authenticated' => false,
                    'user' => null
                ]);
            }
            jsonResponse([
                'success' => true,
                'authenticated' => true,
                'user' => $user
            ]);
        }

        jsonError("Unknown authentication action: {$action}", 404);
    }

    // -------------------------------------------------------------
    // Route: GET /api/notifications — Universal Notifications & Tactical Directives
    // -------------------------------------------------------------
    if ($parts[0] === 'notifications' && $method === 'GET') {
        $user = AuthService::getCurrentUser();
        $role = $user['role'] ?? 'GUEST';
        $settings = JsonStorage::read(FILE_SETTINGS, []);
        $heroes = JsonStorage::read(FILE_HEROES, []);
        $incidents = JsonStorage::read(FILE_INCIDENTS, []);
        $pendingUpdates = JsonStorage::read(FILE_PENDING, []);

        $rogueActive = (bool)($settings['rogue_broadcast_active'] ?? false);
        $rogueMsg = $settings['rogue_broadcast_message'] ?? 'EMERGENCY ROGUE DIRECTIVE: Containment alert active in municipal sectors.';
        $alertLevel = $settings['system_alert_level'] ?? 'NORMAL - GREEN';

        $notifications = [];

        // 1. Tactical Rogue Containment Broadcast (highest priority across all portals)
        if ($rogueActive) {
            $notifications[] = [
                'id' => 'rogue-containment-active',
                'type' => 'urgent',
                'tag' => '[ROGUE ALERT]',
                'title' => 'Sector Containment Alert Active',
                'message' => $rogueMsg,
                'link' => ($role === 'SUPER_ADMIN' || $role === 'ADMIN') ? '/admin' : '/hero',
                'created_at' => date('c'),
                'unread' => true
            ];
        }

        // 2. Role-specific intelligence
        if ($role === 'HERO') {
            $heroId = $user['hero_id'] ?? null;
            $currentHero = null;
            if ($heroId && isset($heroes[$heroId])) {
                $currentHero = $heroes[$heroId];
            } else {
                foreach ($heroes as $h) {
                    if (($h['username'] ?? '') === ($user['username'] ?? '') || ($h['alias'] ?? '') === ($user['name'] ?? '')) {
                        $currentHero = $h;
                        break;
                    }
                }
            }

            if ($currentHero) {
                $status = $currentHero['status'] ?? 'Submitted';
                if ($status === 'Returned for Correction') {
                    $notes = $currentHero['correction_notes'] ?? $currentHero['verification_notes'] ?? 'Assessor requested corrections to registration packet.';
                    $notifications[] = [
                        'id' => 'hero-status-correction',
                        'type' => 'warning',
                        'tag' => '[CORRECTION]',
                        'title' => 'Registration Returned for Review',
                        'message' => "Registrar Note: {$notes}",
                        'link' => '/register',
                        'created_at' => $currentHero['updated_at'] ?? date('c'),
                        'unread' => true
                    ];
                } elseif ($status === 'Under Review') {
                    $notifications[] = [
                        'id' => 'hero-status-under-review',
                        'type' => 'info',
                        'tag' => '[UNDER REVIEW]',
                        'title' => 'Registration Packet in Queue',
                        'message' => 'Registrar assessor is actively evaluating your classification and identity packet.',
                        'link' => '/hero',
                        'created_at' => $currentHero['updated_at'] ?? date('c'),
                        'unread' => false
                    ];
                } elseif ($status === 'Verified') {
                    $notifications[] = [
                        'id' => 'hero-status-verified',
                        'type' => 'info',
                        'tag' => '[VERIFIED]',
                        'title' => 'Credentials Verified',
                        'message' => 'Your superhuman classification has been validated. Awaiting final High Command accreditation.',
                        'link' => '/hero',
                        'created_at' => $currentHero['updated_at'] ?? date('c'),
                        'unread' => true
                    ];
                } elseif ($status === 'Licensed' || $status === 'Approved') {
                    $notifications[] = [
                        'id' => 'hero-status-licensed',
                        'type' => 'success',
                        'tag' => '[ACTIVE LICENSE]',
                        'title' => 'Field Licensure Active',
                        'message' => "Official License #{$currentHero['license_number']} is active and authorized for sector deployment.",
                        'link' => '/hero',
                        'created_at' => $currentHero['licensed_at'] ?? date('c'),
                        'unread' => false
                    ];
                } elseif ($status === 'Draft') {
                    $notifications[] = [
                        'id' => 'hero-status-draft',
                        'type' => 'info',
                        'tag' => '[DRAFT]',
                        'title' => 'Registration Incomplete',
                        'message' => 'Please finalize your identity upload and ability classification to submit for review.',
                        'link' => '/register',
                        'created_at' => date('c'),
                        'unread' => true
                    ];
                }

                // Check pending update for this hero
                foreach ($pendingUpdates as $p) {
                    if (($p['hero_id'] ?? '') === $currentHero['id']) {
                        $notifications[] = [
                            'id' => 'hero-pending-update',
                            'type' => 'info',
                            'tag' => '[PROFILE UPDATE]',
                            'title' => 'Profile Amendment Pending',
                            'message' => 'Your requested changes are awaiting registrar confirmation.',
                            'link' => '/hero',
                            'created_at' => $p['requested_at'] ?? date('c'),
                            'unread' => false
                        ];
                        break;
                    }
                }
            }
        } elseif ($role === 'REGISTRAR' || $role === 'ADMIN' || $role === 'SUPER_ADMIN') {
            $pendingCount = 0;
            $latestPending = null;
            foreach ($heroes as $h) {
                $st = strtolower($h['status'] ?? '');
                if ($st === 'submitted' || $st === 'under review') {
                    $pendingCount++;
                    if (!$latestPending) $latestPending = $h;
                }
            }

            if ($pendingCount > 0) {
                $alias = $latestPending['alias'] ?? 'Operative';
                $notifications[] = [
                    'id' => 'queue-pending-review',
                    'type' => 'info',
                    'tag' => '[INTAKE QUEUE]',
                    'title' => "{$pendingCount} Applicant(s) Awaiting Review",
                    'message' => "Latest applicant {$alias} requires identity & power calibration.",
                    'link' => '/registrar',
                    'created_at' => date('c'),
                    'unread' => true
                ];
            }

            if (count($pendingUpdates) > 0) {
                $notifications[] = [
                    'id' => 'queue-pending-updates',
                    'type' => 'warning',
                    'tag' => '[PROFILE AMENDMENTS]',
                    'title' => count($pendingUpdates) . ' Profile Update Request(s)',
                    'message' => 'Operative requested amendments to registered abilities or basic info.',
                    'link' => '/registrar',
                    'created_at' => date('c'),
                    'unread' => true
                ];
            }

            if (count($incidents) > 0) {
                $latestInc = end($incidents);
                $loc = $latestInc['region'] ?? $latestInc['title'] ?? 'Sector Grid';
                $notes = !empty($latestInc['notes']) ? $latestInc['notes'] : ($latestInc['title'] ?? 'Civic recovery pending');
                $notifications[] = [
                    'id' => 'incident-alert',
                    'type' => 'info',
                    'tag' => '[CIVIC RECOVERY]',
                    'title' => count($incidents) . ' Damage Claim(s) Recorded',
                    'message' => "Latest: {$loc} — {$notes}",
                    'link' => '/sentinel',
                    'created_at' => $latestInc['timestamp'] ?? $latestInc['created_at'] ?? date('c'),
                    'unread' => false
                ];
            }
        }

        $unreadCount = 0;
        foreach ($notifications as $n) {
            if (!empty($n['unread'])) $unreadCount++;
        }

        jsonResponse([
            'success' => true,
            'data' => [
                'system_alert_level' => $alertLevel,
                'rogue_broadcast_active' => $rogueActive,
                'rogue_broadcast_message' => $rogueMsg,
                'unread_count' => $unreadCount,
                'notifications' => $notifications
            ]
        ]);
    }

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // Route: GET /api/heroes — Superhuman Operative Directory (REGISTRAR / ASSESSOR / ADMIN ONLY)
    // Enforces strict role-based access: Normal heroes and unauthenticated clients are denied directory access.
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && !isset($parts[1]) && $method === 'GET') {
        $viewer = AuthService::getCurrentUser();
        $isStaff = $viewer && in_array($viewer['role'] ?? '', ['REGISTRAR', 'ASSESSOR', 'ADMIN', 'SUPER_ADMIN'], true);
        if (!$isStaff) {
            jsonError("ACCESS DENIED: The Superhuman Operative Directory is restricted to authorized Registrar, Assessor, and Administrator clearance.", 403);
        }

        AuthService::syncHeroUsers();
        $heroes = JsonStorage::read(FILE_HEROES, []);
        $list = array_values($heroes);

        // Attach decrypted real_name and gov_id from vault for authorized staff registry
        $vault = JsonStorage::read(FILE_VAULT, []);
        foreach ($list as &$h) {
            if (!empty($h['vault_id']) && (empty($h['real_name']) || !isset($h['real_name']))) {
                if (isset($vault[$h['vault_id']])) {
                    $rec = $vault[$h['vault_id']];
                    $ciphertext = base64_decode($rec['ciphertext']);
                    $iv = base64_decode($rec['iv']);
                    $decrypted = openssl_decrypt($ciphertext, AES_CIPHER, AES_KEY, OPENSSL_RAW_DATA, $iv);
                    if ($decrypted !== false) {
                        $bio = json_decode($decrypted, true);
                        if (!empty($bio['real_name'])) {
                            $h['real_name'] = $bio['real_name'];
                        } elseif (!empty($bio['full_name'])) {
                            $h['real_name'] = $bio['full_name'];
                        }
                        if (!empty($bio['gov_id']) && empty($h['gov_code'])) {
                            $h['gov_code'] = $bio['gov_id'];
                        }
                    }
                }
            }
        }
        unset($h);

        // Optional filtering
        $status = $_GET['status'] ?? null;
        $region = $_GET['region'] ?? null;
        $threat = isset($_GET['threat_tier']) && $_GET['threat_tier'] !== '' ? (int)$_GET['threat_tier'] : null;
        $search = $_GET['search'] ?? null;

        if ($status || $region || $threat !== null || $search) {
            $list = array_filter($list, function ($h) use ($status, $region, $threat, $search) {
                if ($status && strcasecmp($h['status'], $status) !== 0) return false;
                if ($region && strcasecmp($h['region'], $region) !== 0) return false;
                if ($threat !== null && (int)$h['threat_tier'] !== $threat) return false;
                if ($search) {
                    $q = strtolower($search);
                    $found = str_contains(strtolower($h['alias']), $q) ||
                             str_contains(strtolower($h['real_name'] ?? ''), $q) ||
                             str_contains(strtolower($h['primary_power']), $q) ||
                             str_contains(strtolower($h['region']), $q);
                    if (!$found) return false;
                }
                return true;
            });
            $list = array_values($list);
        }

        jsonResponse([
            'success' => true,
            'count' => count($list),
            'data' => $list
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/heroes/{id} — Operative Record (Personal Hero Profile / Staff Inspection)
    // Normal heroes can strictly view ONLY their own operative profile.
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && !isset($parts[2]) && $method === 'GET') {
        $viewer = AuthService::requireAuth();
        $heroId = $parts[1];

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero not found: {$heroId}", 404);
        }
        $heroData = $heroes[$heroId];

        $viewerRole = $viewer['role'] ?? 'HERO';
        $isStaff = in_array($viewerRole, ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR', 'ASSESSOR'], true);
        $isOwnerHero = ($viewerRole === 'HERO' && (($viewer['hero_id'] ?? '') === $heroId || ($heroData['user_id'] ?? '') === ($viewer['username'] ?? '')));

        // RBAC / IDOR defense: Operative accounts can strictly access ONLY their own service record
        if ($viewerRole === 'HERO' && !$isOwnerHero) {
            jsonError("ACCESS DENIED: Operative credentials only permit viewing your own designated service record.", 403);
        }

        // Decrypt vault data strictly for authorized staff or the operative themselves
        if (!empty($heroData['vault_id']) && ($isStaff || $isOwnerHero)) {
            $vaultData = CryptoService::decryptVault($heroData['vault_id']);
            if ($vaultData) {
                $heroData['vault_info'] = $vaultData;
                if (!isset($heroData['real_name']) || empty($heroData['real_name'])) {
                    $heroData['real_name'] = $vaultData['real_name'] ?? ($vaultData['full_name'] ?? null);
                }
            }
        }
        jsonResponse([
            'success' => true,
            'data' => $heroData
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/heroes/{id}/review — Comprehensive Review Packet (REGISTRAR / SUPER_ADMIN)
    // Automatically returns hero specs + decrypted vault identity for verification & FTF interview
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'review' && $method === 'GET') {
        $viewer = AuthService::requireRole(['ADMIN', 'SUPER_ADMIN', 'REGISTRAR']);
        $heroId = $parts[1];
        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero not found: {$heroId}", 404);
        }
        $hero = $heroes[$heroId];
        $vaultId = $hero['vault_id'] ?? null;
        $vaultData = null;
        if ($vaultId) {
            $vaultData = CryptoService::decryptVault($vaultId);
        }

        CryptoService::appendAudit($viewer['name'], $viewer['role'], 'HERO_REVIEW_PACKET_ACCESSED', $heroId, [
            'alias' => $hero['alias'],
            'vault_id' => $vaultId,
            'purpose' => 'Verification and Face-to-Face (FTF) Interview Review'
        ]);

        jsonResponse([
            'success' => true,
            'hero' => $hero,
            'vault' => $vaultData
        ]);
    }

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // Route: PUT /api/heroes/{id} — Edit all hero record information (REGISTRAR / SUPER_ADMIN)
    // Supports editing public specs, vault civilian identity, and FTF interview status
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && !isset($parts[2]) && $method === 'PUT') {
        $editor = AuthService::requireAuth();
        $heroId = $parts[1];
        $body   = getJsonBody();
        $isOwnerHero = ($editor['role'] === 'HERO');

        if ($isOwnerHero) {
            $userHeroId = $editor['hero_id'] ?? null;
            if (!$userHeroId || $userHeroId !== $heroId) {
                jsonError("ACCESS DENIED: Operatives can only edit their own profile.", 403);
            }
        }

        // Editable by all authenticated user roles (SUPER_ADMIN, ADMIN, REGISTRAR, HERO)
        $currentHeroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($currentHeroes[$heroId])) {
            jsonError("Hero {$heroId} not found.", 404);
        }
        $existingRecord = $currentHeroes[$heroId];

        // Check vault identity fields to update
        $vaultFields = [
            'real_name', 'gov_id', 'id_type', 'id_number', 'age', 'dob', 'gender',
            'contact_number', 'address', 'safehouse_address', 'handler_contact',
            'emergency_contact_name', 'emergency_contact_number', 'relationship',
            'biometric_dna_ref', 'location'
        ];
        $hasVaultEdits = false;
        $vaultPayload = [];
        foreach ($vaultFields as $vf) {
            if (array_key_exists($vf, $body)) {
                $vaultPayload[$vf] = $body[$vf];
                $hasVaultEdits = true;
            }
        }

        // Decrypt existing vault bio for change diff calculation
        $existingVaultBio = [];
        if (!empty($existingRecord['vault_id'])) {
            $existingVaultBio = CryptoService::decryptVault($existingRecord['vault_id']) ?: [];
        }

        // Compute exact before-and-after diff of changed fields
        $fieldDiff = [];
        foreach ($body as $k => $newVal) {
            if (in_array($k, ['resubmit', 'submit_draft', '_nonce', 'csrf'], true)) continue;
            $oldVal = null;
            if (in_array($k, $vaultFields, true) && array_key_exists($k, $existingVaultBio)) {
                $oldVal = $existingVaultBio[$k];
            } elseif (array_key_exists($k, $existingRecord)) {
                $oldVal = $existingRecord[$k];
            }

            $oldStr = is_array($oldVal) ? json_encode($oldVal) : (string)$oldVal;
            $newStr = is_array($newVal) ? json_encode($newVal) : (string)$newVal;

            if ($oldStr !== $newStr) {
                $fieldDiff[$k] = [
                    'field' => $k,
                    'old'   => is_scalar($oldVal) ? (string)$oldVal : (is_array($oldVal) ? json_encode($oldVal) : ''),
                    'new'   => is_scalar($newVal) ? (string)$newVal : (is_array($newVal) ? json_encode($newVal) : '')
                ];
            }
        }

        $updatedVault = null;

        $updated = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $body, $hasVaultEdits, $vaultPayload, &$updatedVault, $isOwnerHero) {
            if (!isset($heroes[$heroId])) return false;
            $h = &$heroes[$heroId];

            // Editable applicant fields across registration target categories
            $editableFields = [
                'alias', 'real_name', 'email', 'role_tag', 'hero_classification',
                'primary_power', 'primary_level', 'primary_pct',
                'secondary_power', 'secondary_powers', 'secondary_level', 'secondary_pct',
                'power_description', 'abilities', 'skills', 'strengths', 'limitations_weaknesses', 'weaknesses',
                'combat_style', 'training_experience',
                'id_type', 'id_number', 'gov_code',
                'region', 'gear_manifest',
                'mentor', 'sidekicks', 'emergency_contacts',
                'emergency_contact_name', 'emergency_contact_number', 'relationship',
                'contact_number', 'address', 'safehouse_address', 'gender', 'dob', 'age',
                'biometric_dna_ref', 'registration_step',
                'avatar', 'profile_picture', 'coordinates'
            ];

            // Security Boundary: Administrative & Security classification fields can NEVER be modified by operatives
            $staffOnlyFields = [
                'threat_tier', 'threat_class', 'threat_tier_label', 'license_number',
                'assessment_notes', 'combat_rating', 'power_control_level', 'power_level',
                'badge_color', 'audit_flag', 'status', 'verification_status', 'verified_by',
                'verification_date', 'verification_notes', 'revocation_reason',
                'revocation_confidential', 'revoked_at', 'revoked_by', 'correction_notes'
            ];

            if (!$isOwnerHero) {
                $editableFields = array_merge($editableFields, $staffOnlyFields);
            }

            foreach ($editableFields as $f) {
                if (array_key_exists($f, $body)) {
                    $h[$f] = $body[$f];
                }
            }

            // Sync avatar alias
            if (isset($body['avatar']) || isset($body['profile_picture'])) {
                $av = trim((string)($body['avatar'] ?? $body['profile_picture']));
                $h['avatar'] = $av;
                $h['profile_picture'] = $av;
            }

            // Sync secondary powers alias
            if (isset($body['secondary_powers'])) {
                $h['secondary_power'] = trim((string)$body['secondary_powers']);
            }
            if (isset($body['limitations_weaknesses'])) {
                $h['weaknesses'] = trim((string)$body['limitations_weaknesses']);
            }

            // Handle resubmission trigger from hero with state transition validation
            if (!empty($body['resubmit'])) {
                RegistrationWorkflow::assertValidTransition($h['status'] ?? 'Draft', 'Submitted', $isOwnerHero ? 'HERO' : 'STAFF');
                $h['status'] = 'Submitted';
                $h['resubmitted_at'] = date('c');
                $h['badge_color'] = 'yellow';
            }

            // Handle draft submission trigger from hero with state transition validation
            if (!empty($body['submit_draft'])) {
                RegistrationWorkflow::assertValidTransition($h['status'] ?? 'Draft', 'Submitted', $isOwnerHero ? 'HERO' : 'STAFF');
                $h['status'] = 'Submitted';
                $h['submitted_at'] = date('c');
                $h['badge_color'] = 'yellow';
            }

            if (isset($body['id_number']) && !empty($body['id_number'])) {
                $h['id_number'] = trim((string)$body['id_number']);
                $h['gov_code'] = $h['id_number'];
            } elseif (isset($body['gov_id']) && !empty($body['gov_id'])) {
                $h['gov_code'] = trim((string)$body['gov_id']);
                $h['id_number'] = $h['gov_code'];
            }

            if (isset($body['real_name'])) {
                $h['real_name'] = trim((string)$body['real_name']);
            }

            // FTF Interview data updates (staff only)
            if (!$isOwnerHero && isset($body['ftf_interview']) && is_array($body['ftf_interview'])) {
                $h['ftf_interview'] = array_merge($h['ftf_interview'] ?? [], $body['ftf_interview']);
            }

            // Recalculate threat label if tier changed (staff only)
            if (!$isOwnerHero && isset($body['threat_tier'])) {
                $tier = max(0, min(6, (int)$body['threat_tier']));
                $h['threat_tier'] = $tier;
                $tierInfo = THREAT_TIERS[$tier] ?? THREAT_TIERS[3];
                $h['threat_tier_label'] = "{$tierInfo['name']} ({$tierInfo['code']})";
                $h['threat_class'] = $tierInfo['name'];
            }

            // Update vault if identity fields provided
            if ($hasVaultEdits) {
                $vaultId = $h['vault_id'] ?? null;
                $existingBio = $vaultId ? (CryptoService::decryptVault($vaultId) ?: []) : [];
                $mergedBio = array_merge($existingBio, $vaultPayload);
                if ($vaultId) {
                    CryptoService::updateVault($vaultId, $mergedBio);
                } else {
                    $vaultRes = CryptoService::encryptVault($mergedBio);
                    $h['vault_id'] = $vaultRes['vault_id'];
                }
                $updatedVault = $mergedBio;
                if (!empty($mergedBio['real_name'])) {
                    $h['real_name'] = $mergedBio['real_name'];
                }
            }

            $h['updated_at'] = date('c');
            return $h;
        }, []);

        if (!$updated) jsonError("Hero {$heroId} not found.", 404);

        // Keep users.json in sync outside of FILE_HEROES lock to avoid deadlock
        if (!empty($updated['real_name']) || !empty($updated['alias']) || !empty($updated['avatar'])) {
            JsonStorage::transaction(FILE_USERS, function (&$users) use ($heroId, $updated) {
                if (is_array($users)) {
                    foreach ($users as &$u) {
                        if (($u['hero_id'] ?? '') === $heroId) {
                            $rName = $updated['real_name'] ?? '';
                            $aName = $updated['alias'] ?? '';
                            if ($rName || $aName) {
                                $u['name'] = $rName ? "{$rName} ({$aName})" : $aName;
                            }
                            if (!empty($updated['avatar'])) {
                                $u['avatar'] = $updated['avatar'];
                            }
                        }
                    }
                }
            }, []);

            if (!empty($updated['avatar']) && ($editor['hero_id'] ?? '') === $heroId) {
                AuthService::initSession();
                $_SESSION['avatar'] = $updated['avatar'];
            }
        }

        // Chained Audit Ledger: Explicitly record which account made the edit and exact field diffs
        $actorStr = "{$editor['username']} ({$editor['name']})";
        CryptoService::appendAudit(
            $actorStr,
            $editor['role'],
            'HERO_PROFILE_EDITED',
            $heroId,
            [
                'account_username' => $editor['username'],
                'account_name'     => $editor['name'],
                'account_role'     => $editor['role'],
                'clearance_level'  => $editor['clearance_level'] ?? 1,
                'hero_id'          => $heroId,
                'hero_alias'       => $updated['alias'] ?? ($existingRecord['alias'] ?? $heroId),
                'fields_changed'   => array_keys($fieldDiff),
                'diff'             => $fieldDiff,
                'has_vault_edits'  => $hasVaultEdits,
                'client_ip'        => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                'user_agent'       => substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 100)
            ]
        );

        jsonResponse([
            'success' => true,
            'message' => 'Hero record and identity verification updated successfully.',
            'data' => $updated,
            'vault' => $updatedVault,
            'audit' => [
                'editor_account' => $editor['username'],
                'fields_changed' => array_keys($fieldDiff)
            ]
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/ftf-interview — Dedicated FTF Interview & Verification
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'ftf-interview' && $method === 'POST') {
        $interviewer = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroId = $parts[1];
        $body = getJsonBody();

        $status = trim($body['status'] ?? 'Passed');
        $examiner = trim($body['examiner'] ?? $interviewer['name']);
        $notes = trim($body['notes'] ?? '');
        $powerStability = trim($body['power_stability'] ?? 'Stable');
        $psychEval = trim($body['psych_eval'] ?? 'Cleared');
        $checklist = $body['checklist'] ?? [];
        $grantLicense = !empty($body['grant_license']);

        $updatedHero = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $status, $examiner, $notes, $powerStability, $psychEval, $checklist, $grantLicense) {
            if (!isset($heroes[$heroId])) return false;
            $h = &$heroes[$heroId];

            $h['ftf_interview'] = [
                'status' => $status,
                'examiner' => $examiner,
                'date' => date('c'),
                'power_stability' => $powerStability,
                'psych_eval' => $psychEval,
                'notes' => $notes,
                'checklist' => $checklist
            ];

            if ($grantLicense || $status === 'Passed') {
                $h['status'] = 'Licensed';
                $h['badge_color'] = 'green';
                if (empty($h['license_number'])) {
                    $h['license_number'] = 'HRS-LIC-2026-' . str_pad((string)mt_rand(1000, 9999), 4, '0', STR_PAD_LEFT);
                }
            } elseif ($status === 'Failed') {
                $h['status'] = 'Suspended';
                $h['badge_color'] = 'red';
            }

            $h['updated_at'] = date('c');
            return $h;
        }, []);

        if (!$updatedHero) jsonError("Hero {$heroId} not found.", 404);

        CryptoService::appendAudit($interviewer['name'], $interviewer['role'], 'FTF_INTERVIEW_VERIFIED', $heroId, [
            'status' => $status,
            'examiner' => $examiner,
            'alias' => $updatedHero['alias'],
            'licensed' => ($updatedHero['status'] === 'Licensed')
        ]);

        jsonResponse([
            'success' => true,
            'message' => "FTF interview recorded as {$status} by {$examiner}.",
            'hero' => $updatedHero
        ]);
    }

    // -------------------------------------------------------------
    // Route: DELETE /api/heroes/{id} — Hard delete (SUPER_ADMIN only)
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && !isset($parts[2]) && $method === 'DELETE') {
        $admin = AuthService::requireRole('SUPER_ADMIN');
        $heroId = $parts[1];

        $deleted = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId) {
            if (!isset($heroes[$heroId])) return null;
            $removed = $heroes[$heroId];
            unset($heroes[$heroId]);
            return $removed;
        }, []);

        if (!$deleted) jsonError("Hero {$heroId} not found.", 404);

        CryptoService::appendAudit($admin['name'], $admin['role'], 'HERO_RECORD_DELETED', $heroId, [
            'alias'  => $deleted['alias'],
            'reason' => 'Super Admin permanent deletion from Command Center'
        ]);

        jsonResponse(['success' => true, 'message' => "Hero {$deleted['alias']} permanently deleted from registry."]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/enroll-sidekick — Enroll as sidekick (REGISTRAR / SUPER_ADMIN)
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'enroll-sidekick' && $method === 'POST') {
        $editor  = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroId  = $parts[1];
        $body    = getJsonBody();
        $mentorId = trim((string)($body['mentor_hero_id'] ?? ''));
        $sidekickAlias = trim((string)($body['sidekick_alias'] ?? ''));

        if (empty($mentorId)) jsonError("mentor_hero_id is required.");

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId]))   jsonError("Sidekick hero {$heroId} not found.", 404);
        if (!isset($heroes[$mentorId])) jsonError("Mentor hero {$mentorId} not found.", 404);

        $sidekickAliasName = $heroes[$heroId]['alias'];
        $mentorAliasName   = $heroes[$mentorId]['alias'];

        // Set mentor on the sidekick and add to mentor's sidekick list
        JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $mentorId, $sidekickAliasName, $mentorAliasName) {
            $oldMentor = $heroes[$heroId]['mentor'] ?? null;
            $heroes[$heroId]['mentor']     = $mentorAliasName;
            $heroes[$heroId]['role_tag']   = 'Sidekick';
            $heroes[$heroId]['updated_at'] = date('c');

            // Remove from old mentor's sidekick list if changing mentors
            if ($oldMentor && strcasecmp($oldMentor, $mentorAliasName) !== 0) {
                foreach ($heroes as &$mHero) {
                    if (strcasecmp($mHero['alias'] ?? '', $oldMentor) === 0 && !empty($mHero['sidekicks'])) {
                        $mHero['sidekicks'] = array_values(array_filter($mHero['sidekicks'], fn($s) => strcasecmp($s, $sidekickAliasName) !== 0));
                    }
                }
                unset($mHero);
            }

            // Add sidekick alias to mentor's list (avoid duplicates)
            if (!in_array($sidekickAliasName, $heroes[$mentorId]['sidekicks'] ?? [], true)) {
                $heroes[$mentorId]['sidekicks'][] = $sidekickAliasName;
            }
        }, []);

        CryptoService::appendAudit($editor['name'], $editor['role'], 'SIDEKICK_ENROLLED', $heroId, [
            'sidekick'  => $sidekickAliasName,
            'mentor'    => $mentorAliasName,
            'mentor_id' => $mentorId
        ]);

        jsonResponse([
            'success' => true,
            'message' => "{$sidekickAliasName} enrolled as sidekick to {$mentorAliasName}."
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/promote-to-hero — Graduate Sidekick to Full Hero (REGISTRAR / SUPER_ADMIN)
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'promote-to-hero' && $method === 'POST') {
        $editor  = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroId  = $parts[1];

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) jsonError("Operative {$heroId} not found.", 404);

        $sidekickAlias = $heroes[$heroId]['alias'];
        $oldMentor = $heroes[$heroId]['mentor'] ?? null;

        JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $oldMentor, $sidekickAlias) {
            $heroes[$heroId]['role_tag'] = 'Hero';
            $heroes[$heroId]['mentor']   = null;
            $heroes[$heroId]['updated_at'] = date('c');

            // Remove from old mentor's sidekicks list if applicable
            if ($oldMentor) {
                foreach ($heroes as $mId => &$mHero) {
                    if (strcasecmp($mHero['alias'], $oldMentor) === 0 && !empty($mHero['sidekicks'])) {
                        $mHero['sidekicks'] = array_values(array_filter($mHero['sidekicks'], fn($s) => strcasecmp($s, $sidekickAlias) !== 0));
                    }
                }
            }
        }, []);

        CryptoService::appendAudit($editor['name'], $editor['role'], 'SIDEKICK_PROMOTED_TO_HERO', $heroId, [
            'operative'     => $sidekickAlias,
            'former_mentor' => $oldMentor
        ]);

        jsonResponse([
            'success' => true,
            'message' => "{$sidekickAlias} has graduated and is now registered as a Full Independent Hero!"
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/register (3-Step Onboarding)
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && ($parts[1] ?? '') === 'register' && $method === 'POST') {
        RateLimiter::check('hero_register', 15, 600);
        $body = getJsonBody();

        $isDraft = !empty($body['is_draft']);
        $realName = trim($body['real_name'] ?? '');
        $idType   = trim($body['id_type'] ?? 'National ID');
        $idNumber = trim($body['id_number'] ?? ($body['gov_id'] ?? ''));
        $govId    = $idNumber;
        $dnaRef   = trim($body['biometric_dna_ref'] ?? '');
        $dob      = trim($body['dob'] ?? '');
        $gender   = trim($body['gender'] ?? 'Unspecified');
        $contactNumber = trim($body['contact_number'] ?? '');
        $address  = trim($body['address'] ?? ($body['safehouse_address'] ?? ''));
        $email    = trim($body['email'] ?? '');
        $age      = (int)($body['age'] ?? 0);

        if (!$isDraft && (empty($realName) || empty($idNumber))) {
            jsonError("Real civilian legal name and Official ID number are mandatory for hero registration.");
        }

        // Vault the civilian identity immediately under AES-256
        $vaultPayload = [
            'real_name' => $realName,
            'gov_id' => $govId,
            'id_type' => $idType,
            'id_number' => $idNumber,
            'biometric_dna_ref' => $dnaRef,
            'dob' => $dob,
            'gender' => $gender,
            'age' => $age,
            'contact_number' => $contactNumber,
            'address' => $address,
            'emergency_contact_name' => trim($body['emergency_contact_name'] ?? ($body['emergency_contacts'][0]['name'] ?? '')),
            'emergency_contact_number' => trim($body['emergency_contact_number'] ?? ($body['emergency_contacts'][0]['phone'] ?? '')),
            'relationship' => trim($body['relationship'] ?? ($body['emergency_contacts'][0]['relation'] ?? 'Emergency Contact')),
            'handler_contact' => $body['handler_contact'] ?? $contactNumber,
            'safehouse_address' => $address
        ];
        $vaultResult = CryptoService::encryptVault($vaultPayload);

        // Hero Public Identity
        $alias = trim((string)($body['callsign'] ?? ($body['alias'] ?? ($body['hero_name'] ?? ''))));
        $primaryPower = trim((string)($body['primary_power'] ?? ''));
        $region = trim((string)($body['region'] ?? ($body['sector'] ?? 'Sector 1 - Poblacion Central Commercial Grid')));

        if (!$isDraft && (empty($alias) || empty($primaryPower))) {
            jsonError("Hero Callsign/Alias and Primary Superhuman Power are required.");
        }
        if (empty($alias)) {
            $alias = 'Hero_' . bin2hex(random_bytes(2));
        }

        $cleanAliasSlug = preg_replace('/[^a-z0-9]/', '_', strtolower($alias));
        if (empty($cleanAliasSlug)) $cleanAliasSlug = 'hero';
        $heroId = 'hero_' . $cleanAliasSlug . '_' . bin2hex(random_bytes(3));
        $registrationId = 'GHRMS-REG-' . date('Y') . '-' . strtoupper(substr(md5($heroId), 0, 6));

        $threatTier = isset($body['threat_tier']) ? max(0, min(6, (int)$body['threat_tier'])) : (isset($body['self_threat_rating']) ? max(0, min(6, (int)$body['self_threat_rating'])) : 3);
        $tierInfo = THREAT_TIERS[$threatTier] ?? THREAT_TIERS[3];

        $isSidekick = (!empty($body['role_tag']) && in_array(strtolower((string)$body['role_tag']), ['sidekick', 'apprentice'], true)) ||
                      (!empty($body['hero_classification']) && in_array(strtolower((string)$body['hero_classification']), ['sidekick', 'apprentice'], true));

        // Format Emergency Contacts structure
        $emergencyContacts = !empty($body['emergency_contacts']) ? (array)$body['emergency_contacts'] : [
            [
                'name' => trim($body['emergency_contact_name'] ?? 'Primary Emergency Contact'),
                'relation' => trim($body['relationship'] ?? 'Handler'),
                'phone' => trim($body['emergency_contact_number'] ?? '+1 (555) 019-9900')
            ]
        ];

        $initialStatus = $isDraft ? 'Draft' : 'Submitted';

        $heroRecord = [
            'id' => $heroId,
            'registration_id' => $registrationId,
            'alias' => $alias,
            'real_name' => $realName,
            'email' => $email,
            'role_tag' => $isSidekick ? 'Sidekick' : 'Hero',
            'hero_classification' => trim($body['hero_classification'] ?? ($isSidekick ? 'Sidekick / Apprentice' : 'Primary Hero')),
            'vault_id' => $vaultResult['vault_id'],

            // Hero Information
            'primary_power' => $primaryPower ?: 'TBD',
            'primary_level' => isset($body['power_level']) ? (string)$body['power_level'] : 'Level 5/10',
            'primary_pct' => 50,
            'secondary_power' => trim((string)($body['secondary_powers'] ?? ($body['secondary_power'] ?? 'None'))),
            'secondary_level' => 'Level 4/10',
            'secondary_pct' => 40,
            'power_description' => trim((string)($body['power_description'] ?? '')),
            'abilities' => trim((string)($body['abilities'] ?? '')),
            'skills' => trim((string)($body['skills'] ?? '')),
            'strengths' => trim((string)($body['strengths'] ?? '')),
            'limitations_weaknesses' => trim((string)($body['limitations_weaknesses'] ?? ($body['weaknesses'] ?? ''))),
            'combat_style' => trim((string)($body['combat_style'] ?? '')),
            'training_experience' => trim((string)($body['training_experience'] ?? '')),
            'gear_manifest' => !empty($body['gear_manifest']) ? (array)$body['gear_manifest'] : ['Standard Utility Accoutrement'],

            // Power & Threat Assessment
            'power_level' => isset($body['power_level']) ? (is_numeric($body['power_level']) ? (int)$body['power_level'] : trim((string)$body['power_level'])) : 50,
            'combat_rating' => isset($body['combat_rating']) ? (is_numeric($body['combat_rating']) ? (int)$body['combat_rating'] : trim((string)$body['combat_rating'])) : 50,
            'power_control_level' => trim((string)($body['power_control_level'] ?? 'Moderate')),
            'threat_tier' => $threatTier,
            'threat_tier_label' => "{$tierInfo['name']} ({$tierInfo['code']})",
            'assessment_notes' => trim((string)($body['assessment_notes'] ?? '')),

            // Identity Verification
            'id_type' => $idType,
            'id_number' => $idNumber,
            'gov_code' => $idNumber,
            'id_document' => null,
            'verification_status' => 'Pending',
            'verified_by' => null,
            'verification_date' => null,
            'verification_notes' => null,

            // Supporting Documents
            'supporting_documents' => [],

            // Registration Workflow
            'region' => $region,
            'status' => $initialStatus,
            'license_number' => null,
            'registration_step' => $isDraft ? 1 : 2,
            'badge_secret' => bin2hex(random_bytes(16)),
            'badge_color' => $isDraft ? 'gray' : 'yellow',
            'sidekicks' => !empty($body['sidekicks']) ? (array)$body['sidekicks'] : [],
            'mentor' => !empty($body['mentor']) ? trim($body['mentor']) : null,
            'coordinates' => [
                'lat' => (float)($body['lat'] ?? (8.5110 + (mt_rand(-30, 30) / 1000))),
                'lng' => (float)($body['lng'] ?? (125.9800 + (mt_rand(-30, 30) / 1000))),
                'grid' => 'SFADS-' . mt_rand(1000, 9999)
            ],
            'created_at' => date('c'),
            'updated_at' => date('c'),
            'submitted_at' => $isDraft ? null : date('c'),
            'correction_notes' => null,
            'rejection_reason' => null,
            'emergency_contacts' => $emergencyContacts
        ];

        // Provision user login credentials in users.json
        $callsignRaw = strtolower(trim((string)($body['callsign'] ?? ($body['username'] ?? $alias))));
        $cleanCallsign = preg_replace('/[^a-zA-Z0-9._-]/', '', $callsignRaw);
        if (empty($cleanCallsign)) {
            $cleanCallsign = 'hero_' . bin2hex(random_bytes(3));
        }

        $reservedUsernames = ['commander', 'admin', 'admin2', 'sarah.chen', 'root', 'system', 'ghrms', 'registrar', 'superadmin'];
        if (in_array(strtolower($cleanCallsign), $reservedUsernames, true)) {
            jsonError("Callsign '{$cleanCallsign}' is a reserved federal identifier. Please select an alternate callsign.", 409);
        }

        $existingUsers = JsonStorage::read(FILE_USERS, []);
        if (isset($existingUsers[strtolower($cleanCallsign)])) {
            jsonError("Callsign '{$cleanCallsign}' is already registered in the federal directory. Please choose an alternate callsign.", 409);
        }

        $rawPassword = trim((string)($body['password'] ?? 'hero123'));
        if (empty($rawPassword)) {
            $rawPassword = 'hero123';
        }

        $avatarCandidate = trim((string)($body['avatar'] ?? ($body['profile_picture'] ?? '')));
        if (!empty($avatarCandidate) && (str_starts_with($avatarCandidate, '/uploads/avatars/') || str_starts_with($avatarCandidate, '/img/'))) {
            $heroAvatar = $avatarCandidate;
        } else {
            $heroAvatar = '/img/apex.jpg';
        }

        $heroRecord['avatar'] = $heroAvatar;
        $heroRecord['profile_picture'] = $heroAvatar;

        $userDisplayName = !empty($realName) ? "{$realName} ({$alias})" : $alias;
        $newUserAccount = [
            'username' => $cleanCallsign,
            'email' => $email,
            'password_hash' => password_hash($rawPassword, PASSWORD_BCRYPT),
            'role' => 'HERO',
            'name' => $userDisplayName,
            'hero_id' => $heroId,
            'avatar' => $heroAvatar,
            'clearance_level' => 1,
            'account_status' => 'Active',
            'created_at' => date('c'),
            'last_login' => date('c')
        ];

        JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $heroRecord) {
            if (!is_array($heroes)) $heroes = [];
            $heroes[$heroId] = $heroRecord;
            return true;
        }, []);

        JsonStorage::transaction(FILE_USERS, function (&$users) use ($cleanCallsign, $newUserAccount) {
            if (!is_array($users)) $users = [];
            $users[$cleanCallsign] = $newUserAccount;
            return true;
        }, []);

        $callsign = $cleanCallsign;

        // Establish authenticated session so hero can immediately enter /hero
        AuthService::initSession();
        $_SESSION['user_id'] = $callsign;
        $_SESSION['role'] = 'HERO';
        $_SESSION['hero_id'] = $heroId;
        $_SESSION['name'] = $userDisplayName;
        $_SESSION['avatar'] = $newUserAccount['avatar'];
        $_SESSION['clearance_level'] = 1;
        $_SESSION['logged_in_at'] = time();
        $_SESSION['last_login'] = date('c');

        // Chained audit ledger event
        CryptoService::appendAudit('HERO_PORTAL', 'APPLICANT', $isDraft ? 'HERO_DRAFT_CREATED' : 'HERO_ONBOARDING_SUBMITTED', $heroId, [
            'alias' => $alias,
            'threat_tier' => $threatTier,
            'region' => $region,
            'callsign' => $callsign,
            'status' => $initialStatus,
            'vault_id' => $vaultResult['vault_id']
        ]);

        jsonResponse([
            'success' => true,
            'message' => $isDraft
                ? 'Hero registration saved as Draft. You can complete and submit your application at any time.'
                : 'Hero registration submitted successfully. Secret identity vaulted with AES-256 and operative account provisioned.',
            'redirect' => '/hero',
            'hero' => $heroRecord,
            'data' => $heroRecord,
            'user' => [
                'username' => $callsign,
                'email' => $email,
                'role' => 'HERO',
                'name' => $userDisplayName
            ]
        ], 201);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/documents — Secure Document Upload
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'documents' && !isset($parts[3]) && $method === 'POST') {
        $viewer = AuthService::requireAuth();
        $heroId = $parts[1];

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero record {$heroId} not found.", 404);
        }

        $viewerRole = $viewer['role'] ?? 'HERO';
        $isStaff = in_array($viewerRole, ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR', 'ASSESSOR'], true);
        $isOwnerHero = ($viewerRole === 'HERO' && (($viewer['hero_id'] ?? '') === $heroId || ($heroes[$heroId]['user_id'] ?? '') === ($viewer['username'] ?? '')));

        if (!$isStaff && !$isOwnerHero) {
            jsonError("ACCESS DENIED: Operatives can only upload documents to their own record.", 403);
        }

        $file = $_FILES['document'] ?? ($_FILES['file'] ?? null);
        if (!$file) {
            jsonError("No document file was uploaded. File input 'document' or 'file' is required.");
        }
        if ($file['error'] !== UPLOAD_ERR_OK) {
            jsonError("Upload error code: " . $file['error']);
        }

        if ($file['size'] > 12 * 1024 * 1024) {
            jsonError("Uploaded document exceeds the maximum permitted limit of 12MB.", 413);
        }

        $origName = basename($file['name']);
        if (str_contains($origName, "\0") || str_contains($origName, '%00')) {
            jsonError("Security violation: Null byte detected in filename.", 400);
        }

        $nameParts = explode('.', strtolower($origName));
        $dangerousExts = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'phar', 'cgi', 'pl', 'asp', 'aspx', 'jsp', 'exe', 'sh', 'bat', 'cmd', 'vbs'];
        foreach (array_slice($nameParts, 0, -1) as $part) {
            if (in_array($part, $dangerousExts, true)) {
                jsonError("Security violation: Multiple extensions or script masquerade detected in uploaded filename.", 400);
            }
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
        if (!in_array($ext, $allowedExts, true)) {
            jsonError("Prohibited file extension '.{$ext}'. Only PDF, PNG, JPG, and WEBP formats are permitted.", 415);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        $allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        if (!in_array($mime, $allowedMimes, true)) {
            jsonError("Prohibited MIME type '{$mime}'. Only authentic PDF and image documents are accepted.", 415);
        }

        $docDir = defined('DIR_DOCUMENTS') ? DIR_DOCUMENTS : (DATA_DIR . '/documents');
        if (!is_dir($docDir)) {
            mkdir($docDir, 0755, true);
        }

        $docId = 'doc_' . bin2hex(random_bytes(6));
        $safeFileName = $docId . '.' . $ext;
        $destPath = $docDir . '/' . $safeFileName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            jsonError("Failed to persist document to secure storage.", 500);
        }

        $docType = trim($_POST['document_type'] ?? 'Official ID');
        $validTypes = ['Official ID', 'Hero Certification', 'Training Certificate', 'Authorization Document', 'Other Supporting Documents'];
        if (!in_array($docType, $validTypes, true)) {
            $docType = 'Other Supporting Documents';
        }

        $expDate = !empty($_POST['expiration_date']) ? trim((string)$_POST['expiration_date']) : null;

        $docRecord = [
            'id' => $docId,
            'version' => 1,
            'document_type' => $docType,
            'original_name' => $origName,
            'file_name' => $safeFileName,
            'file_size' => (int)$file['size'],
            'mime_type' => $mime,
            'upload_date' => date('c'),
            'expiration_date' => $expDate,
            'verification_status' => 'Pending',
            'verified_by' => null,
            'verification_date' => null,
            'verification_notes' => null
        ];

        $updatedHero = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, &$docRecord, $docType, $docId) {
            if (!isset($heroes[$heroId])) return false;
            $h = &$heroes[$heroId];
            if (!isset($h['supporting_documents']) || !is_array($h['supporting_documents'])) {
                $h['supporting_documents'] = [];
            }
            $existingVersions = 0;
            foreach ($h['supporting_documents'] as $prev) {
                if (($prev['document_type'] ?? '') === $docType) {
                    $existingVersions++;
                }
            }
            $docRecord['version'] = $existingVersions + 1;
            $h['supporting_documents'][] = $docRecord;
            if ($docType === 'Official ID') {
                $h['id_document'] = $docId;
                $h['id_document_name'] = $docRecord['original_name'];
            }
            $h['updated_at'] = date('c');
            return $h;
        }, []);

        if (!$updatedHero) {
            @unlink($destPath);
            jsonError("Hero record {$heroId} not found.", 404);
        }

        CryptoService::appendAudit($viewer['name'], $viewer['role'], 'DOCUMENT_UPLOADED', $heroId, [
            'doc_id' => $docId,
            'doc_type' => $docType,
            'original_name' => $origName,
            'file_size' => $file['size']
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Document '{$origName}' successfully uploaded.",
            'data' => $docRecord,
            'document' => $docRecord,
            'supporting_documents' => $updatedHero['supporting_documents'] ?? []
        ], 201);
    }

    // -------------------------------------------------------------
    // Route: GET /api/heroes/{id}/documents/{docId} — Secure Document Download / Preview
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'documents' && isset($parts[3]) && !isset($parts[4]) && ($method === 'GET' || $method === 'HEAD')) {
        $viewer = AuthService::requireAuth();
        $heroId = $parts[1];
        $docId = $parts[3];

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero not found: {$heroId}", 404);
        }

        $viewerRole = $viewer['role'] ?? 'HERO';
        $isStaff = in_array($viewerRole, ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR', 'ASSESSOR'], true);
        $isOwnerHero = ($viewerRole === 'HERO' && (($viewer['hero_id'] ?? '') === $heroId || ($heroes[$heroId]['user_id'] ?? '') === ($viewer['username'] ?? '')));

        if (!$isStaff && !$isOwnerHero) {
            jsonError("ACCESS DENIED: Insufficient clearance to inspect private operative documentation.", 403);
        }

        $docs = $heroes[$heroId]['supporting_documents'] ?? [];
        $found = null;
        foreach ($docs as $d) {
            if ($d['id'] === $docId) {
                $found = $d;
                break;
            }
        }

        if (!$found) {
            jsonError("Document {$docId} not found in registration packet.", 404);
        }

        $docDir = defined('DIR_DOCUMENTS') ? DIR_DOCUMENTS : (DATA_DIR . '/documents');
        $filePath = realpath($docDir . '/' . $found['file_name']);
        $realDocsDir = realpath($docDir);

        if (!$filePath || !$realDocsDir || !str_starts_with($filePath, $realDocsDir . DIRECTORY_SEPARATOR) || !file_exists($filePath)) {
            jsonError("Document file missing or inaccessible on disk.", 404);
        }

        header('Content-Type: ' . ($found['mime_type'] ?? 'application/octet-stream'));
        header('Content-Length: ' . (string)filesize($filePath));
        header('Content-Disposition: inline; filename="' . addslashes($found['original_name'] ?? 'document') . '"');
        header('Cache-Control: private, max-age=3600');
        if ($method !== 'HEAD') {
            readfile($filePath);
        }
        exit;
    }

    // -------------------------------------------------------------
    // Route: DELETE /api/heroes/{id}/documents/{docId} — Secure Document Deletion
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'documents' && isset($parts[3]) && !isset($parts[4]) && $method === 'DELETE') {
        $actor = AuthService::requireAuth();
        $heroId = $parts[1];
        $docId = $parts[3];

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero record {$heroId} not found.", 404);
        }

        $actorRole = $actor['role'] ?? 'HERO';
        $isStaff = in_array($actorRole, ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR'], true);
        $isOwnerHero = ($actorRole === 'HERO' && (($actor['hero_id'] ?? '') === $heroId || ($heroes[$heroId]['user_id'] ?? '') === ($actor['username'] ?? '')));

        if (!$isStaff && !$isOwnerHero) {
            jsonError("ACCESS DENIED: Insufficient security clearance to delete operative documentation.", 403);
        }

        $docDir = defined('DIR_DOCUMENTS') ? DIR_DOCUMENTS : (DATA_DIR . '/documents');
        $deletedDoc = null;

        $updatedHero = JsonStorage::transaction(FILE_HEROES, function (&$hList) use ($heroId, $docId, $actorRole, &$deletedDoc) {
            if (!isset($hList[$heroId])) return false;
            $h = &$hList[$heroId];
            if (!isset($h['supporting_documents']) || !is_array($h['supporting_documents'])) {
                return false;
            }

            $remaining = [];
            foreach ($h['supporting_documents'] as $doc) {
                if ($doc['id'] === $docId) {
                    // Verified compliance records are legally protected and cannot be deleted while in Verified status
                    if ($doc['verification_status'] === 'Verified') {
                        return 'VERIFIED_RECORD_PROTECTED';
                    }
                    $deletedDoc = $doc;
                } else {
                    $remaining[] = $doc;
                }
            }

            if (!$deletedDoc) return false;

            $h['supporting_documents'] = $remaining;
            if (($h['id_document'] ?? '') === $docId) {
                $h['id_document'] = null;
                $h['id_document_name'] = null;
            }
            $h['updated_at'] = date('c');
            return $h;
        }, []);

        if ($updatedHero === 'VERIFIED_RECORD_PROTECTED') {
            jsonError("PROTECTED RECORD: Verified compliance documents can only be deleted or archived by an Administrator.", 403);
        }

        if (!$updatedHero || !$deletedDoc) {
            jsonError("Document {$docId} not found in registration packet.", 404);
        }

        // Delete underlying file if safe and exists
        if (!empty($deletedDoc['file_name'])) {
            $filePath = $docDir . '/' . basename($deletedDoc['file_name']);
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        CryptoService::appendAudit($actor['name'], $actor['role'], 'DOCUMENT_DELETED', $heroId, [
            'doc_id' => $docId,
            'doc_type' => $deletedDoc['document_type'] ?? 'Unknown',
            'file_name' => $deletedDoc['file_name'] ?? '',
            'original_name' => $deletedDoc['original_name'] ?? ''
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Document '{$deletedDoc['original_name']}' successfully deleted.",
            'doc_id' => $docId,
            'supporting_documents' => $updatedHero['supporting_documents'] ?? []
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/documents/{docId}/verify — Admin Document Verification
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'documents' && isset($parts[3]) && ($parts[4] ?? '') === 'verify' && $method === 'POST') {
        $actor = AuthService::requireRole(['ADMIN', 'SUPER_ADMIN', 'REGISTRAR']);
        $heroId = $parts[1];
        $docId = $parts[3];
        $body = getJsonBody();

        $status = trim((string)($body['status'] ?? 'Verified'));
        if (!in_array($status, ['Verified', 'Rejected', 'Pending'], true)) {
            $status = 'Verified';
        }
        $notes = trim((string)($body['notes'] ?? ''));

        $updatedDoc = null;

        $result = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $docId, $status, $notes, $actor, &$updatedDoc) {
            if (!isset($heroes[$heroId])) return false;
            $h = &$heroes[$heroId];
            if (!isset($h['supporting_documents']) || !is_array($h['supporting_documents'])) {
                return false;
            }

            $matched = false;
            foreach ($h['supporting_documents'] as &$doc) {
                if ($doc['id'] === $docId) {
                    $doc['verification_status'] = $status;
                    $doc['verified_by'] = $actor['name'];
                    $doc['verification_date'] = date('c');
                    $doc['verification_notes'] = $notes;
                    $updatedDoc = $doc;
                    $matched = true;

                    // If Official ID, update hero identity verification status in sync
                    if ($doc['document_type'] === 'Official ID') {
                        $h['verification_status'] = $status;
                        $h['verified_by'] = $actor['name'];
                        $h['verification_date'] = date('c');
                        $h['verification_notes'] = $notes;
                    }
                }
            }
            unset($doc);

            if (!$matched) return false;

            $h['updated_at'] = date('c');
            return $h;
        }, []);

        if (!$result || !$updatedDoc) {
            jsonError("Document {$docId} for hero {$heroId} not found.", 404);
        }

        CryptoService::appendAudit($actor['name'], $actor['role'], 'DOCUMENT_VERIFIED', $heroId, [
            'doc_id' => $docId,
            'doc_type' => $updatedDoc['document_type'],
            'new_status' => $status,
            'notes' => $notes
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Document {$updatedDoc['document_type']} marked as {$status}.",
            'document' => $updatedDoc,
            'supporting_documents' => $result['supporting_documents'] ?? []
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/upload-avatar — General / Intake Face Photo Upload
    // -------------------------------------------------------------
    if ($parts[0] === 'upload-avatar' && $method === 'POST') {
        RateLimiter::check('avatar_upload', 20, 300);
        $file = $_FILES['avatar'] ?? ($_FILES['profile_picture'] ?? ($_FILES['photo'] ?? ($_FILES['file'] ?? null)));
        $avatarUrl = null;

        if (!$file) {
            $body = getJsonBody();
            $dataUri = $body['image_data'] ?? ($body['avatar_base64'] ?? null);
            if ($dataUri && preg_match('#^data:image/(png|jpeg|jpg|webp);base64,#i', $dataUri, $matches)) {
                $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
                $binary = base64_decode(substr($dataUri, strpos($dataUri, ',') + 1));
                if (strlen($binary) > 8 * 1024 * 1024) {
                    jsonError("Uploaded face photo exceeds maximum 8MB limit.", 413);
                }
                $avatarDir = HRS_ROOT . '/public/uploads/avatars';
                if (!is_dir($avatarDir)) {
                    mkdir($avatarDir, 0777, true);
                }
                $fileName = 'face_' . bin2hex(random_bytes(8)) . '.' . $ext;
                file_put_contents($avatarDir . '/' . $fileName, $binary);
                $avatarUrl = '/uploads/avatars/' . $fileName;
            } else {
                jsonError("No face photo was provided. Upload an image file or data URI.", 400);
            }
        } else {
            if ($file['error'] !== UPLOAD_ERR_OK) {
                jsonError("Upload error code: " . $file['error'], 400);
            }
            if ($file['size'] > 8 * 1024 * 1024) {
                jsonError("Uploaded face photo exceeds maximum 8MB limit.", 413);
            }
            $origName = basename($file['name']);
            if (str_contains($origName, "\0") || str_contains($origName, '%00')) {
                jsonError("Security violation: Null byte detected in filename.", 400);
            }
            $nameParts = explode('.', strtolower($origName));
            $dangerousExts = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'phar', 'cgi', 'pl', 'asp', 'aspx', 'jsp', 'exe', 'sh', 'bat', 'cmd', 'vbs'];
            foreach (array_slice($nameParts, 0, -1) as $part) {
                if (in_array($part, $dangerousExts, true)) {
                    jsonError("Security violation: Multiple extensions or script masquerade detected in uploaded filename.", 400);
                }
            }
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
            if (!in_array($ext, $allowedExts, true)) {
                jsonError("Prohibited file extension '.{$ext}'. Only PNG, JPG, and WEBP formats are permitted.", 415);
            }
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($file['tmp_name']);
            $allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
            if (!in_array($mime, $allowedMimes, true)) {
                jsonError("Prohibited image MIME type '{$mime}'.", 415);
            }
            $avatarDir = HRS_ROOT . '/public/uploads/avatars';
            if (!is_dir($avatarDir)) {
                mkdir($avatarDir, 0777, true);
            }
            $fileName = 'face_' . bin2hex(random_bytes(8)) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
            $destPath = $avatarDir . '/' . $fileName;
            if (!move_uploaded_file($file['tmp_name'], $destPath)) {
                jsonError("Failed to store face photo file.", 500);
            }
            $avatarUrl = '/uploads/avatars/' . $fileName;
        }

        jsonResponse([
            'success' => true,
            'url' => $avatarUrl,
            'message' => 'Face profile picture uploaded successfully.'
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/avatar — Update Hero Face / Profile Picture
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'avatar' && $method === 'POST') {
        $actor = AuthService::requireAuth();
        $heroId = $parts[1];

        $isStaff = in_array($actor['role'], ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR'], true);
        $isOwnerHero = ($actor['role'] === 'HERO' && ($actor['hero_id'] ?? '') === $heroId);

        if (!$isStaff && !$isOwnerHero) {
            jsonError("Access denied: You may only update your own hero face profile picture.", 403);
        }

        $avatarUrl = null;
        $file = $_FILES['avatar'] ?? ($_FILES['profile_picture'] ?? ($_FILES['photo'] ?? ($_FILES['file'] ?? null)));

        if ($file && $file['error'] === UPLOAD_ERR_OK) {
            if ($file['size'] > 8 * 1024 * 1024) {
                jsonError("Uploaded face photo exceeds maximum 8MB limit.", 413);
            }
            $origName = basename($file['name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
            if (!in_array($ext, $allowedExts, true)) {
                jsonError("Prohibited file extension '.{$ext}'. Only PNG, JPG, and WEBP formats are permitted.", 415);
            }
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($file['tmp_name']);
            $allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
            if (!in_array($mime, $allowedMimes, true)) {
                jsonError("Prohibited image MIME type '{$mime}'.", 415);
            }
            $avatarDir = HRS_ROOT . '/public/uploads/avatars';
            if (!is_dir($avatarDir)) {
                mkdir($avatarDir, 0777, true);
            }
            $fileName = 'hero_' . $heroId . '_' . time() . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
            $destPath = $avatarDir . '/' . $fileName;
            if (!move_uploaded_file($file['tmp_name'], $destPath)) {
                jsonError("Failed to store face photo file.", 500);
            }
            $avatarUrl = '/uploads/avatars/' . $fileName;
        } else {
            $body = getJsonBody();
            $candidateUrl = trim((string)($body['avatar_url'] ?? ($body['avatar'] ?? ($body['profile_picture'] ?? ''))));
            if (!empty($candidateUrl)) {
                if (!str_starts_with($candidateUrl, '/uploads/avatars/') && !str_starts_with($candidateUrl, '/img/')) {
                    jsonError("Invalid avatar path. Avatar must point to a local system resource.", 400);
                }
                $avatarUrl = $candidateUrl;
            } elseif (!empty($body['image_data']) && preg_match('#^data:image/(png|jpeg|jpg|webp);base64,#i', $body['image_data'], $matches)) {
                $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
                $binary = base64_decode(substr($body['image_data'], strpos($body['image_data'], ',') + 1));
                if (strlen($binary) > 8 * 1024 * 1024) {
                    jsonError("Uploaded face photo exceeds maximum 8MB limit.", 413);
                }
                $avatarDir = HRS_ROOT . '/public/uploads/avatars';
                if (!is_dir($avatarDir)) {
                    mkdir($avatarDir, 0777, true);
                }
                $fileName = 'hero_' . $heroId . '_' . time() . '.' . $ext;
                file_put_contents($avatarDir . '/' . $fileName, $binary);
                $avatarUrl = '/uploads/avatars/' . $fileName;
            } else {
                jsonError("No avatar file or URL provided.", 400);
            }
        }

        // Update heroes.json
        $updatedHero = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $avatarUrl) {
            if (!isset($heroes[$heroId])) return false;
            $heroes[$heroId]['avatar'] = $avatarUrl;
            $heroes[$heroId]['profile_picture'] = $avatarUrl;
            $heroes[$heroId]['updated_at'] = date('c');
            return $heroes[$heroId];
        }, []);

        if (!$updatedHero) {
            jsonError("Hero record {$heroId} not found.", 404);
        }

        // Update users.json
        JsonStorage::transaction(FILE_USERS, function (&$users) use ($heroId, $avatarUrl) {
            if (!is_array($users)) return true;
            foreach ($users as &$u) {
                if (($u['hero_id'] ?? '') === $heroId) {
                    $u['avatar'] = $avatarUrl;
                }
            }
            return true;
        }, []);

        // Update active session if self
        if (($actor['hero_id'] ?? '') === $heroId) {
            AuthService::initSession();
            $_SESSION['avatar'] = $avatarUrl;
        }

        CryptoService::appendAudit($actor['name'], $actor['role'], 'HERO_AVATAR_UPDATED', $heroId, [
            'avatar_url' => $avatarUrl
        ]);

        jsonResponse([
            'success' => true,
            'url' => $avatarUrl,
            'message' => 'Hero face profile picture updated successfully.',
            'hero' => $updatedHero
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/heroes/{id}/badge-token
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'badge-token' && $method === 'GET') {
        $viewer = AuthService::requireRole(['HERO', 'REGISTRAR', 'SUPER_ADMIN']);
        $heroId = $parts[1];
        if ($viewer['role'] === 'HERO' && ($viewer['hero_id'] ?? '') !== $heroId) {
            jsonError("Access denied: You may only generate authentication tokens for your own operative badge.", 403);
        }
        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero not found: {$heroId}", 404);
        }

        $hero = $heroes[$heroId];
        $badgeSecret = $hero['badge_secret'] ?? 'default_secret';
        $tokenData = CryptoService::generateBadgeToken($heroId, $badgeSecret, 30);

        jsonResponse([
            'success' => true,
            'data' => array_merge($tokenData, [
                'alias' => $hero['alias'],
                'status' => $hero['status'],
                'threat_tier' => $hero['threat_tier'],
                'threat_tier_label' => $hero['threat_tier_label'],
                'badge_color' => $hero['badge_color']
            ])
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/verify-badge
    // -------------------------------------------------------------
    if ($parts[0] === 'verify-badge' && $method === 'POST') {
        RateLimiter::check('verify_badge', 30, 60);
        $body = getJsonBody();
        $token = trim((string)($body['token'] ?? ''));
        $heroId = trim((string)($body['hero_id'] ?? ''));

        // Allow verifying full QR payload string
        if (!empty($body['qr_payload'])) {
            $parsed = json_decode($body['qr_payload'], true);
            if (is_array($parsed) && !empty($parsed['hid']) && !empty($parsed['tok'])) {
                $heroId = $parsed['hid'];
                $token = $parsed['tok'];
            }
        }

        if (empty($heroId) || empty($token)) {
            jsonError("Hero ID and verification token are required.");
        }

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero record does not exist.", 404);
        }

        $hero = $heroes[$heroId];

        // Check if hero is flagged Rogue or Revoked
        if ($hero['status'] === 'Rogue' || strpos(strtolower($hero['status']), 'revoked') !== false) {
            jsonResponse([
                'success' => true,
                'valid' => false,
                'status' => 'ROGUE_ALERT',
                'badge_color' => 'red',
                'alias' => $hero['alias'],
                'hero_id' => $heroId,
                'message' => 'WARNING: Subject license is REVOKED or flagged ROGUE. Initiate municipal containment.'
            ]);
        }

        $verification = CryptoService::verifyBadgeToken($heroId, $hero['badge_secret'] ?? '', $token, 30);

        jsonResponse([
            'success' => true,
            'valid' => $verification['valid'],
            'alias' => $hero['alias'],
            'hero_id' => $heroId,
            'status' => $hero['status'],
            'threat_tier_label' => $hero['threat_tier_label'],
            'badge_color' => $hero['badge_color'],
            'details' => $verification
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/decrypt-vault — REGISTRAR / SUPER_ADMIN only
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'decrypt-vault' && $method === 'POST') {
        $actor = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroId = $parts[1];
        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) {
            jsonError("Hero not found: {$heroId}", 404);
        }

        $hero = $heroes[$heroId];
        $vaultId = $hero['vault_id'] ?? null;
        if (!$vaultId) {
            jsonError("No vaulted secret identity record linked to hero.", 404);
        }

        $bio = CryptoService::decryptVault($vaultId);
        if (!$bio) {
            jsonError("Failed to decrypt identity vault or record tampered.", 500);
        }

        // Write mandatory audit log
        CryptoService::appendAudit($actor['name'], $actor['role'], 'SECRET_BIO_DECRYPTED', $heroId, [
            'alias' => $hero['alias'],
            'vault_id' => $vaultId,
            'reason' => 'Mandatory identity verification before field license grant'
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'Vault decrypted. Access logged to audit ledger.',
            'vault_id' => $vaultId,
            'bio_data' => $bio,
            'vault_data' => $bio,
            'avatar' => $hero['avatar'] ?? ($hero['profile_picture'] ?? null),
            'alias' => $hero['alias'] ?? ''
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/assess — REGISTRAR / SUPER_ADMIN only
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'assess' && $method === 'POST') {
        $actor = AuthService::requireAuth();
        $heroId = $parts[1];
        $body = getJsonBody();
        $action = strtoupper(trim((string)($body['action'] ?? '')));

        $isStaff = in_array($actor['role'], ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR'], true);
        $isOwnerHero = ($actor['role'] === 'HERO' && ($actor['hero_id'] ?? '') === $heroId);

        $heroAllowedActions = ['RESUBMIT', 'SAVE_DRAFT', 'SUBMIT_DRAFT'];
        if (in_array($action, $heroAllowedActions, true)) {
            if (!$isStaff && !$isOwnerHero) {
                jsonError("Access denied: You can only perform this action on your own registration.", 403);
            }
        } else {
            if (!$isStaff) {
                jsonError("Access denied: Administrative clearance required for review action '{$action}'.", 403);
            }
        }

        $result = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $body, $action, $actor) {
            if (!isset($heroes[$heroId])) {
                return false;
            }

            $hero = &$heroes[$heroId];
            $auditDetails = ['action' => $action];

            if ($action === 'APPROVE_LICENSE' || $action === 'APPROVE' || $action === 'APPROVE_REGISTRATION') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Approved', $actor['role']);
                $hero['status'] = 'Approved';
                $hero['badge_color'] = 'green';
                $hero['approved_at'] = date('c');
                $hero['approved_by'] = $actor['name'] ?? 'Administrative Authority';
                $hero['revocation_reason'] = null;
                $hero['revocation_confidential'] = false;
                $hero['revoked_at'] = null;
                $hero['revoked_by'] = null;
                if (empty($hero['license_number']) || stripos($hero['license_number'], 'revoked') !== false) {
                    $hero['license_number'] = 'GHRMS-LIC-2026-' . str_pad((string)mt_rand(1000, 9999), 4, '0', STR_PAD_LEFT);
                }
                $auditDetails['license_number'] = $hero['license_number'];
                $auditDetails['status'] = 'Approved';

            } elseif ($action === 'REQUEST_CORRECTIONS') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Returned for Correction', $actor['role']);
                $notes = trim((string)($body['notes'] ?? ($body['correction_notes'] ?? 'Please correct the highlighted information in your registration packet.')));
                $hero['status'] = 'Returned for Correction';
                $hero['badge_color'] = 'yellow';
                $hero['correction_notes'] = $notes;
                $hero['correction_requested_at'] = date('c');
                $hero['correction_requested_by'] = $actor['name'] ?? 'Admin Reviewer';
                $auditDetails['status'] = 'Returned for Correction';
                $auditDetails['notes'] = $notes;

            } elseif ($action === 'RESUBMIT') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Submitted', $actor['role']);
                $hero['status'] = 'Submitted';
                $hero['badge_color'] = 'yellow';
                $hero['resubmitted_at'] = date('c');
                $auditDetails['status'] = 'Submitted';

            } elseif ($action === 'MOVE_TO_REVIEW') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Under Review', $actor['role']);
                $hero['status'] = 'Under Review';
                $hero['badge_color'] = 'yellow';
                $auditDetails['status'] = 'Under Review';

            } elseif ($action === 'VERIFY_IDENTITY') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Verified', $actor['role']);
                $notes = trim((string)($body['notes'] ?? ($body['verification_notes'] ?? 'Civilian identity and documents verified.')));
                $hero['verification_status'] = 'Verified';
                $hero['verified_by'] = $actor['name'] ?? 'Admin';
                $hero['verification_date'] = date('c');
                $hero['verification_notes'] = $notes;
                $hero['status'] = 'Verified';
                $hero['badge_color'] = 'yellow';
                $auditDetails['status'] = 'Verified';
                $auditDetails['notes'] = $notes;

            } elseif ($action === 'REJECT_REGISTRATION' || $action === 'REJECT') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Rejected', $actor['role']);
                $reason = trim((string)($body['reason'] ?? ($body['rejection_reason'] ?? 'Registration rejected by administrator.')));
                $hero['status'] = 'Rejected';
                $hero['badge_color'] = 'red';
                $hero['rejection_reason'] = $reason;
                $hero['rejected_at'] = date('c');
                $hero['rejected_by'] = $actor['name'] ?? 'Admin Reviewer';
                $auditDetails['status'] = 'Rejected';
                $auditDetails['reason'] = $reason;

            } elseif ($action === 'REVOKE_LICENSE' || $action === 'REVOKE') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Revoked', $actor['role']);
                $hero['status'] = 'Revoked';
                $hero['badge_color'] = 'red';
                $reason = trim((string)($body['reason'] ?? 'License revoked by federal directive.'));
                $isConfidential = !empty($body['confidential']);
                $hero['revocation_reason'] = $reason;
                $hero['revocation_confidential'] = $isConfidential;
                $hero['revoked_at'] = date('c');
                $hero['revoked_by'] = $actor['name'] ?? 'Registrar / Admin Desk';
                $auditDetails['revocation_reason'] = $reason;
                $auditDetails['confidential'] = $isConfidential;
                $auditDetails['status'] = 'Revoked';

            } elseif ($action === 'SUSPEND_OPERATIVE' || $action === 'SUSPEND') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Suspended', $actor['role']);
                $reason = trim((string)($body['reason'] ?? ($body['notes'] ?? 'Operative privileges temporarily suspended.')));
                $hero['status'] = 'Suspended';
                $hero['badge_color'] = 'red';
                $hero['suspended_at'] = date('c');
                $hero['suspended_by'] = $actor['name'] ?? 'Super Admin Command';
                $hero['suspension_reason'] = $reason;
                $auditDetails['status'] = 'Suspended';
                $auditDetails['reason'] = $reason;

            } elseif ($action === 'REINSTATE') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Under Review', $actor['role']);
                $notes = trim((string)($body['notes'] ?? 'Operative reinstated for active evaluation.'));
                $hero['status'] = 'Under Review';
                $hero['badge_color'] = 'yellow';
                $hero['reinstated_at'] = date('c');
                $hero['reinstated_by'] = $actor['name'] ?? 'Super Admin Command';
                $hero['reinstatement_notes'] = $notes;
                $auditDetails['status'] = 'Under Review';
                $auditDetails['notes'] = $notes;

            } elseif ($action === 'REQUEST_POWER_AUDIT') {
                RegistrationWorkflow::assertValidTransition($hero['status'] ?? 'Draft', 'Under Review', $actor['role']);
                $hero['status'] = 'Under Review';
                $hero['badge_color'] = 'yellow';
                $hero['audit_flag'] = 'Tactical Output Audit Requested';
                $auditDetails['notes'] = $body['notes'] ?? 'Standard kinetic/arcane threshold recalibration';

            } elseif ($action === 'SET_THREAT_TIER') {
                $tier = max(0, min(5, (int)($body['threat_tier'] ?? 3)));
                $tierInfo = THREAT_TIERS[$tier] ?? THREAT_TIERS[3];
                $hero['threat_tier'] = $tier;
                $hero['threat_tier_label'] = "{$tierInfo['name']} ({$tierInfo['code']})";
                $auditDetails['new_threat_tier'] = $tier;
                $auditDetails['tier_label'] = $hero['threat_tier_label'];

            } elseif ($action === 'SET_ASSESSMENT') {
                if (isset($body['power_level'])) $hero['power_level'] = trim((string)$body['power_level']);
                if (isset($body['combat_rating'])) $hero['combat_rating'] = trim((string)$body['combat_rating']);
                if (isset($body['power_control_level'])) $hero['power_control_level'] = trim((string)$body['power_control_level']);
                if (isset($body['assessment_notes'])) $hero['assessment_notes'] = trim((string)$body['assessment_notes']);
                if (isset($body['threat_tier'])) {
                    $tier = max(0, min(5, (int)$body['threat_tier']));
                    $tierInfo = THREAT_TIERS[$tier] ?? THREAT_TIERS[3];
                    $hero['threat_tier'] = $tier;
                    $hero['threat_tier_label'] = "{$tierInfo['name']} ({$tierInfo['code']})";
                }
                $auditDetails['assessment'] = [
                    'power_level' => $hero['power_level'] ?? null,
                    'combat_rating' => $hero['combat_rating'] ?? null,
                    'control_level' => $hero['power_control_level'] ?? null,
                    'threat_tier' => $hero['threat_tier'] ?? null
                ];

            } elseif ($action === 'ADD_VERIFICATION_NOTES') {
                $notes = trim((string)($body['notes'] ?? ($body['verification_notes'] ?? '')));
                $hero['verification_notes'] = $notes;
                $auditDetails['verification_notes'] = $notes;

            } elseif ($action === 'MAP_SIDEKICKS') {
                if (isset($body['sidekicks'])) {
                    $hero['sidekicks'] = array_values(array_filter((array)$body['sidekicks']));
                }
                if (isset($body['mentor'])) {
                    $hero['mentor'] = trim((string)$body['mentor']);
                }
                $auditDetails['sidekicks'] = $hero['sidekicks'];
                $auditDetails['mentor'] = $hero['mentor'];
            }

            $hero['updated_at'] = date('c');
            return $hero;
        }, []);

        if (!$result) {
            jsonError("Hero {$heroId} not found.", 404);
        }

        // Chained audit ledger
        CryptoService::appendAudit($actor['name'], $actor['role'], 'HERO_WORKFLOW_ACTION', $heroId, [
            'action' => $action,
            'alias' => $result['alias'],
            'status' => $result['status'],
            'threat_tier' => $result['threat_tier']
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Workflow action {$action} applied successfully.",
            'data' => $result,
            'hero' => $result
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/damage-report (Post-Battle Damage Drawer)
    // -------------------------------------------------------------
    if ($parts[0] === 'damage-report' && $method === 'POST') {
        $reporter = AuthService::requireAuth();
        $body = getJsonBody();

        $heroId = trim((string)($body['hero_id'] ?? ''));
        if ($reporter['role'] === 'HERO') {
            if (empty($reporter['hero_id'])) {
                jsonError("Unlinked hero profile cannot file damage reports.", 403);
            }
            // Enforce IDOR prevention: Hero can only file reports under their own registered ID
            $heroId = $reporter['hero_id'];
        } elseif (empty($heroId)) {
            $heroId = 'ghra_staff';
        }
        $powerType = trim((string)($body['power_type'] ?? 'Kinetic'));
        $severity = trim((string)($body['severity'] ?? 'Moderate'));
        $damageUsd = (int)($body['estimated_damage_usd'] ?? 50000);
        $notes = trim((string)($body['notes'] ?? 'Civic collateral recorded in battle zone.'));
        $title = trim((string)($body['title'] ?? 'Battle Damage Incident'));

        $heroes = JsonStorage::read(FILE_HEROES, []);
        $heroAlias = isset($heroes[$heroId]) ? $heroes[$heroId]['alias'] : 'Unidentified Hero';
        $region = isset($heroes[$heroId]) ? $heroes[$heroId]['region'] : MUNICIPAL_SECTORS[0];

        $incidentId = 'inc_' . date('Ymd') . '_' . bin2hex(random_bytes(3));
        $newIncident = [
            'id' => $incidentId,
            'title' => $title,
            'region' => $body['region'] ?? $region,
            'coordinates' => [
                'lat' => (float)($body['lat'] ?? 8.5110),
                'lng' => (float)($body['lng'] ?? 125.9800)
            ],
            'power_type' => $powerType,
            'severity' => $severity,
            'estimated_damage_usd' => $damageUsd,
            'reported_by_hero' => $heroId,
            'matched_hero_alias' => $heroAlias,
            'civic_recovery_status' => 'Pending Civic Recovery Dispatch',
            'photo_evidence' => $body['photo_name'] ?? 'field_capture_' . mt_rand(100, 999) . '.jpg',
            'notes' => $notes,
            'timestamp' => date('c')
        ];

        JsonStorage::transaction(FILE_INCIDENTS, function (&$incidents) use ($newIncident) {
            if (!is_array($incidents)) $incidents = [];
            array_unshift($incidents, $newIncident);
        }, []);

        // Log audit
        CryptoService::appendAudit('HERO_FIELD_DRAWER', 'HERO', 'CIVIC_DAMAGE_REPORTED', $incidentId, [
            'hero_id' => $heroId,
            'hero_alias' => $heroAlias,
            'power_type' => $powerType,
            'damage_usd' => $damageUsd
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'Post-battle damage claim registered. Municipal recovery crew notified.',
            'data' => $newIncident
        ], 201);
    }

    // =============================================================
    // PENDING HERO UPDATE WORKFLOW
    // =============================================================

    // -------------------------------------------------------------
    // Route: POST /api/heroes/{id}/request-update — HERO submits proposed edits
    // Saved to pending_updates.json, NOT applied until approved.
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'request-update' && $method === 'POST') {
        $actor  = AuthService::requireRole(['HERO', 'REGISTRAR', 'SUPER_ADMIN']);
        $heroId = $parts[1];
        $body   = getJsonBody();

        // Heroes may only update their own record
        if ($actor['role'] === 'HERO' && ($actor['hero_id'] ?? '') !== $heroId) {
            jsonError('You can only request updates to your own profile.', 403);
        }

        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (!isset($heroes[$heroId])) jsonError("Hero {$heroId} not found.", 404);

        // Fields a hero is allowed to propose changing
        $allowedFields = ['alias', 'primary_power', 'secondary_power', 'region', 'emergency_contacts', 'gear_manifest'];
        $proposed = [];
        foreach ($allowedFields as $f) {
            if (array_key_exists($f, $body)) {
                $proposed[$f] = $body[$f];
            }
        }
        if (empty($proposed)) jsonError('No editable fields provided in the request.');

        // Registrar/Admin edits apply directly — no approval queue
        if (in_array($actor['role'], ['REGISTRAR', 'ADMIN', 'SUPER_ADMIN'], true)) {
            $updated = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $proposed) {
                if (!isset($heroes[$heroId])) return false;
                foreach ($proposed as $k => $v) {
                    $heroes[$heroId][$k] = $v;
                }
                $heroes[$heroId]['updated_at'] = date('c');
                return $heroes[$heroId];
            }, []);

            CryptoService::appendAudit($actor['name'], $actor['role'], 'HERO_RECORD_EDITED', $heroId, [
                'edited_fields' => array_keys($proposed),
                'via'           => 'direct_edit'
            ]);
            jsonResponse(['success' => true, 'message' => 'Record updated immediately.', 'data' => $updated, 'requires_approval' => false]);
        }

        // HERO role: save to pending queue atomically
        $pendingId = 'upd_' . substr(md5(uniqid($heroId, true)), 0, 10);
        $pendingItem = [
            'id'          => $pendingId,
            'hero_id'     => $heroId,
            'hero_alias'  => $heroes[$heroId]['alias'],
            'hero_avatar' => $heroes[$heroId]['avatar'] ?? '',
            'submitted_by'=> $actor['name'],
            'submitted_at'=> date('c'),
            'status'      => 'PENDING',
            'proposed'    => $proposed,
            'current'     => array_intersect_key($heroes[$heroId], array_flip(array_keys($proposed)))
        ];

        JsonStorage::transaction(FILE_PENDING, function (&$pending) use ($pendingId, $pendingItem) {
            if (!is_array($pending)) $pending = [];
            $pending[$pendingId] = $pendingItem;
            return true;
        }, []);

        CryptoService::appendAudit($actor['name'], $actor['role'], 'UPDATE_REQUESTED', $heroId, [
            'pending_id'    => $pendingId,
            'fields'        => array_keys($proposed)
        ]);

        jsonResponse([
            'success'          => true,
            'message'          => 'Update request submitted. Awaiting Registrar/Admin approval.',
            'pending_id'       => $pendingId,
            'requires_approval'=> true
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/pending-updates — List all pending (REGISTRAR / SUPER_ADMIN)
    // Optional query: ?hero_id=... to filter by hero
    // -------------------------------------------------------------
    if ($parts[0] === 'pending-updates' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $pending = JsonStorage::read(FILE_PENDING, []);

        $heroFilter = $_GET['hero_id'] ?? null;
        $result = array_values(array_filter($pending, function ($upd) use ($heroFilter) {
            if ($heroFilter && $upd['hero_id'] !== $heroFilter) return false;
            return $upd['status'] === 'PENDING';   // only show unresolved
        }));

        jsonResponse(['success' => true, 'count' => count($result), 'data' => $result]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/heroes/{id}/pending-update — Hero checks own pending (HERO)
    // -------------------------------------------------------------
    if ($parts[0] === 'heroes' && isset($parts[1]) && ($parts[2] ?? '') === 'pending-update' && $method === 'GET') {
        $actor  = AuthService::requireRole(['HERO', 'REGISTRAR', 'SUPER_ADMIN']);
        $heroId = $parts[1];

        if ($actor['role'] === 'HERO' && ($actor['hero_id'] ?? '') !== $heroId) {
            jsonError('Access denied.', 403);
        }

        $pending = JsonStorage::read(FILE_PENDING, []);
        $mine = array_values(array_filter($pending, fn($u) => $u['hero_id'] === $heroId && $u['status'] === 'PENDING'));

        jsonResponse(['success' => true, 'pending' => $mine]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/pending-updates/{pendingId}/approve — REGISTRAR / SUPER_ADMIN
    // -------------------------------------------------------------
    if ($parts[0] === 'pending-updates' && isset($parts[1]) && ($parts[2] ?? '') === 'approve' && $method === 'POST') {
        $approver = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $pendingId = $parts[1];

        $pending = JsonStorage::read(FILE_PENDING, []);
        if (!isset($pending[$pendingId])) jsonError("Pending update {$pendingId} not found.", 404);
        if ($pending[$pendingId]['status'] !== 'PENDING') jsonError("Update already resolved.");

        $upd    = $pending[$pendingId];
        $heroId = $upd['hero_id'];

        // Apply changes to hero record
        $updated = JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($heroId, $upd) {
            if (!isset($heroes[$heroId])) return false;
            foreach ($upd['proposed'] as $k => $v) {
                $heroes[$heroId][$k] = $v;
            }
            $heroes[$heroId]['updated_at'] = date('c');
            return $heroes[$heroId];
        }, []);

        // Mark pending entry as approved
        JsonStorage::transaction(FILE_PENDING, function (&$pending) use ($pendingId, $approver) {
            if (isset($pending[$pendingId])) {
                $pending[$pendingId]['status']      = 'APPROVED';
                $pending[$pendingId]['resolved_by']  = $approver['name'];
                $pending[$pendingId]['resolved_at']  = date('c');
            }
        }, []);

        CryptoService::appendAudit($approver['name'], $approver['role'], 'UPDATE_APPROVED', $heroId, [
            'pending_id'    => $pendingId,
            'applied_fields'=> array_keys($upd['proposed']),
            'hero_alias'    => $upd['hero_alias']
        ]);

        jsonResponse(['success' => true, 'message' => "Changes approved and applied to {$upd['hero_alias']}.", 'data' => $updated]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/pending-updates/{pendingId}/reject — REGISTRAR / SUPER_ADMIN
    // -------------------------------------------------------------
    if ($parts[0] === 'pending-updates' && isset($parts[1]) && ($parts[2] ?? '') === 'reject' && $method === 'POST') {
        $approver = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $pendingId = $parts[1];
        $body = getJsonBody();

        $pending = JsonStorage::read(FILE_PENDING, []);
        if (!isset($pending[$pendingId])) jsonError("Pending update {$pendingId} not found.", 404);
        if ($pending[$pendingId]['status'] !== 'PENDING') jsonError("Update already resolved.");

        JsonStorage::transaction(FILE_PENDING, function (&$pending) use ($pendingId, $approver, $body) {
            if (isset($pending[$pendingId])) {
                $pending[$pendingId]['status']      = 'REJECTED';
                $pending[$pendingId]['resolved_by']  = $approver['name'];
                $pending[$pendingId]['resolved_at']  = date('c');
                $pending[$pendingId]['reject_reason']= trim((string)($body['reason'] ?? ''));
            }
        }, []);

        CryptoService::appendAudit($approver['name'], $approver['role'], 'UPDATE_REJECTED', $pending[$pendingId]['hero_id'], [
            'pending_id' => $pendingId,
            'reason'     => $body['reason'] ?? ''
        ]);

        jsonResponse(['success' => true, 'message' => "Update request {$pendingId} rejected."]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/damage-reports — REGISTRAR / SUPER_ADMIN only
    // -------------------------------------------------------------
    if ($parts[0] === 'damage-reports' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN', 'ADMIN']);
        $incidents = JsonStorage::read(FILE_INCIDENTS, []);
        jsonResponse([
            'success' => true,
            'count' => count($incidents),
            'data' => $incidents
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/damage-reports/{id}/match — REGISTRAR / SUPER_ADMIN
    // -------------------------------------------------------------
    if ($parts[0] === 'damage-reports' && isset($parts[1]) && ($parts[2] ?? '') === 'match' && $method === 'POST') {
        $actor = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $incidentId = $parts[1];
        $body = getJsonBody();
        $heroId = trim((string)($body['hero_id'] ?? ''));

        $heroes = JsonStorage::read(FILE_HEROES, []);
        $alias = isset($heroes[$heroId]) ? $heroes[$heroId]['alias'] : ($body['alias'] ?? 'Unknown');

        $updated = JsonStorage::transaction(FILE_INCIDENTS, function (&$incidents) use ($incidentId, $heroId, $alias, $body) {
            foreach ($incidents as &$inc) {
                if ($inc['id'] === $incidentId) {
                    $inc['reported_by_hero'] = $heroId ?: $inc['reported_by_hero'];
                    $inc['matched_hero_alias'] = $alias;
                    $inc['civic_recovery_status'] = $body['status'] ?? 'Signature Matched - Civic Fund Disbursed';
                    return $inc;
                }
            }
            return null;
        }, []);

        if (!$updated) {
            jsonError("Incident {$incidentId} not found.", 404);
        }

        CryptoService::appendAudit($actor['name'], $actor['role'], 'COLLATERAL_SIGNATURE_MATCHED', $incidentId, [
            'matched_hero' => $alias,
            'status' => $updated['civic_recovery_status']
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'Collateral damage claim matched against registered hero power signature.',
            'data' => $updated
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/admin/metrics — SUPER_ADMIN / REGISTRAR
    // -------------------------------------------------------------
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'metrics' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroes = JsonStorage::read(FILE_HEROES, []);
        $incidents = JsonStorage::read(FILE_INCIDENTS, []);
        $settings = JsonStorage::read(FILE_SETTINGS, []);

        $activeHeroes = 0;
        $pendingReviews = 0;
        $rogueFlags = 0;

        foreach ($heroes as $h) {
            $s = strtolower($h['status']);
            if ($s === 'licensed') $activeHeroes++;
            elseif ($s === 'under review' || $s === 'submitted') $pendingReviews++;
            elseif ($s === 'rogue' || str_contains($s, 'revoked')) $rogueFlags++;
        }

        $totalCollateral = array_sum(array_column($incidents, 'estimated_damage_usd'));

        jsonResponse([
            'success' => true,
            'data' => [
                'active_heroes' => $activeHeroes,
                'pending_reviews' => $pendingReviews,
                'open_incidents' => count($incidents),
                'rogue_flags' => $rogueFlags,
                'total_collateral_usd' => $totalCollateral,
                'system_alert_level' => $settings['system_alert_level'] ?? 'NORMAL - GREEN',
                'rogue_broadcast_active' => $settings['rogue_broadcast_active'] ?? false,
                'rogue_broadcast_message' => $settings['rogue_broadcast_message'] ?? ''
            ]
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/admin/map-data — SUPER_ADMIN / REGISTRAR
    // -------------------------------------------------------------
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'map-data' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroes = JsonStorage::read(FILE_HEROES, []);
        $incidents = JsonStorage::read(FILE_INCIDENTS, []);
        $settings = JsonStorage::read(FILE_SETTINGS, []);

        $heroBlips = [];
        foreach ($heroes as $h) {
            $heroBlips[] = [
                'id' => $h['id'],
                'alias' => $h['alias'],
                'status' => $h['status'],
                'badge_color' => $h['badge_color'],
                'threat_tier' => $h['threat_tier'],
                'threat_label' => $h['threat_tier_label'],
                'primary_power' => $h['primary_power'],
                'coordinates' => $h['coordinates']
            ];
        }

        jsonResponse([
            'success' => true,
            'data' => [
                'heroes' => $heroBlips,
                'incidents' => $incidents,
                'containment_zones' => $settings['containment_zones'] ?? []
            ]
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/admin/emergency-action — ADMIN / SUPER_ADMIN
    // -------------------------------------------------------------
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'emergency-action' && $method === 'POST') {
        $admin = AuthService::requireRole(['ADMIN', 'SUPER_ADMIN']);
        $body = getJsonBody();
        $action = trim((string)($body['action'] ?? ''));
        $targetHeroId = trim((string)($body['hero_id'] ?? ''));

        $auditLog = null;

        if ($action === 'LOCKOUT') {
            if (empty($targetHeroId)) {
                jsonError("Hero ID required for Account Lockout.");
            }
            JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($targetHeroId) {
                if (isset($heroes[$targetHeroId])) {
                    $heroes[$targetHeroId]['status'] = 'Locked Out';
                    $heroes[$targetHeroId]['badge_color'] = 'red';
                }
            });
            $auditLog = CryptoService::appendAudit($admin['name'], $admin['role'], 'EMERGENCY_ACCOUNT_LOCKOUT', $targetHeroId, [
                'reason' => $body['reason'] ?? 'Immediate command center security lockout'
            ]);
        } elseif ($action === 'REVOKE_LICENSE') {
            if (empty($targetHeroId)) {
                jsonError("Hero ID required for License Revocation.");
            }
            $reason = trim((string)($body['reason'] ?? 'Subject license revoked by Super Admin override'));
            $isConfidential = !empty($body['confidential']);
            JsonStorage::transaction(FILE_HEROES, function (&$heroes) use ($targetHeroId, $reason, $isConfidential) {
                if (isset($heroes[$targetHeroId])) {
                    $heroes[$targetHeroId]['status'] = 'Revoked';
                    $heroes[$targetHeroId]['badge_color'] = 'red';
                    $heroes[$targetHeroId]['revocation_reason'] = $reason;
                    $heroes[$targetHeroId]['revocation_confidential'] = $isConfidential;
                    $heroes[$targetHeroId]['revoked_at'] = date('c');
                    $heroes[$targetHeroId]['revoked_by'] = 'Super Admin High Command';
                    $heroes[$targetHeroId]['license_number'] = 'HRS-REVOKED-' . date('Ymd');
                }
            });
            $auditLog = CryptoService::appendAudit($admin['name'], $admin['role'], 'EMERGENCY_LICENSE_REVOCATION', $targetHeroId, [
                'reason' => $reason,
                'confidential' => $isConfidential
            ]);
        } elseif ($action === 'TOGGLE_ROGUE_BROADCAST' || $action === 'broadcast_containment_alert' || $action === 'clear_containment_alert') {
            $newStatus = false;
            $msg = $body['message'] ?? 'EMERGENCY ROGUE DIRECTIVE: All field heroes report to sector coordination.';
            JsonStorage::transaction(FILE_SETTINGS, function (&$settings) use (&$newStatus, $msg, $action) {
                if ($action === 'broadcast_containment_alert') {
                    $settings['rogue_broadcast_active'] = true;
                } elseif ($action === 'clear_containment_alert') {
                    $settings['rogue_broadcast_active'] = false;
                } else {
                    $settings['rogue_broadcast_active'] = !($settings['rogue_broadcast_active'] ?? false);
                }
                $settings['rogue_broadcast_message'] = $msg;
                $newStatus = $settings['rogue_broadcast_active'];
            });

            $auditLog = CryptoService::appendAudit($admin['name'], $admin['role'], 'ROGUE_BROADCAST_TOGGLE', 'GLOBAL_NETWORK', [
                'broadcast_active' => $newStatus,
                'message' => $msg
            ]);
        } else {
            jsonError("Unknown emergency action: {$action}");
        }

        jsonResponse([
            'success' => true,
            'message' => "Emergency command [{$action}] executed and committed to audit ledger.",
            'audit_entry' => $auditLog
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/admin/users — List registered accounts (SUPER_ADMIN / ADMIN)
    // -------------------------------------------------------------
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'users' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'ADMIN', 'SUPER_ADMIN']);
        AuthService::syncHeroUsers();
        $users = JsonStorage::read(FILE_USERS, []);
        $safeUsers = [];
        foreach ($users as $uKey => $uData) {
            $safeUsers[] = [
                'username' => $uData['username'] ?? $uKey,
                'role' => $uData['role'] ?? 'HERO',
                'name' => $uData['name'] ?? $uKey,
                'hero_id' => $uData['hero_id'] ?? null,
                'avatar' => $uData['avatar'] ?? '/img/sarah_chen.jpg',
                'clearance_level' => $uData['clearance_level'] ?? 1,
                'created_at' => $uData['created_at'] ?? date('c')
            ];
        }
        jsonResponse([
            'success' => true,
            'count' => count($safeUsers),
            'users' => $safeUsers,
            'data' => $safeUsers
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/admin/users — Provision new Operative or Admin account (SUPER_ADMIN / ADMIN)
    // -------------------------------------------------------------
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'users' && $method === 'POST') {
        $admin = AuthService::requireRole(['ADMIN', 'SUPER_ADMIN']);
        $body = getJsonBody();

        $rawUsername = trim((string)($body['username'] ?? ''));
        $username = strtolower(preg_replace('/[^a-zA-Z0-9._-]/', '', $rawUsername));
        $password = trim((string)($body['password'] ?? ''));
        $name = trim((string)($body['name'] ?? ''));
        $role = strtoupper(trim((string)($body['role'] ?? ($admin['role'] === 'ADMIN' ? 'HERO' : 'SUPER_ADMIN'))));

        if (empty($username) || strlen($username) < 3) {
            jsonError("Callsign/Username must be at least 3 valid alphanumeric characters.", 400);
        }
        if (empty($password) || strlen($password) < 4) {
            jsonError("Security passkey must be at least 4 characters.", 400);
        }
        if (empty($name)) {
            $name = ucfirst($username);
        }

        $validRoles = ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR', 'HERO'];
        if (!in_array($role, $validRoles, true)) {
            jsonError("Invalid security role specified. Must be SUPER_ADMIN, ADMIN, REGISTRAR, or HERO.", 400);
        }

        // Privilege Escalation Prevention: Standard ADMIN cannot provision SUPER_ADMIN or ADMIN accounts
        if ($admin['role'] === 'ADMIN' && in_array($role, ['SUPER_ADMIN', 'ADMIN'], true)) {
            CryptoService::appendAudit($admin['name'], $admin['role'], 'UNAUTHORIZED_PROVISION_BLOCKED', $username, [
                'attempted_role' => $role,
                'reason' => 'Standard Admin attempted to provision elevated administrative role'
            ]);
            jsonError("ACCESS DENIED: Standard Admins cannot provision elevated administrative accounts.", 403);
        }

        $clearanceLevel = ($role === 'SUPER_ADMIN') ? 5 : (($role === 'ADMIN') ? 4 : (($role === 'REGISTRAR') ? 3 : 1));
        $avatar = ($role === 'SUPER_ADMIN') ? '/img/logo.jpg' : (($role === 'ADMIN') ? '/img/sarah_chen.jpg' : (($role === 'REGISTRAR') ? '/img/sarah_chen.jpg' : '/img/apex.jpg'));

        $createdUser = null;

        $success = JsonStorage::transaction(FILE_USERS, function (&$users) use ($username, $password, $name, $role, $clearanceLevel, $avatar, &$createdUser) {
            if (!is_array($users)) {
                $users = [];
            }
            if (isset($users[$username])) {
                return false; // User already exists
            }

            $newUser = [
                'username' => $username,
                'password_hash' => password_hash($password, PASSWORD_BCRYPT),
                'role' => $role,
                'name' => $name,
                'hero_id' => null,
                'avatar' => $avatar,
                'clearance_level' => $clearanceLevel,
                'created_at' => date('c')
            ];

            $users[$username] = $newUser;
            $createdUser = [
                'username' => $username,
                'role' => $role,
                'name' => $name,
                'clearance_level' => $clearanceLevel,
                'avatar' => $avatar,
                'created_at' => $newUser['created_at']
            ];

            return true;
        }, []);

        if (!$success) {
            jsonError("Account creation failed: Callsign '{$username}' already exists in registry.", 409);
        }

        CryptoService::appendAudit($admin['name'], $admin['role'], 'USER_ACCOUNT_PROVISIONED', $username, [
            'new_role' => $role,
            'clearance_level' => $clearanceLevel,
            'display_name' => $name
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Successfully provisioned {$role} account for '{$name}' ({$username}).",
            'user' => $createdUser
        ], 201);
    }

    // Route: DELETE /api/admin/users/{username} — Delete User Account (SUPER_ADMIN only)
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'users' && isset($parts[2]) && !isset($parts[3]) && $method === 'DELETE') {
        $admin = AuthService::requireRole('SUPER_ADMIN');
        $targetUser = strtolower(trim($parts[2]));

        if ($targetUser === 'commander') {
            jsonError("Cannot delete root Super Admin account 'commander'.", 403);
        }
        if ($targetUser === strtolower($admin['username'])) {
            jsonError("Cannot delete your own currently active account.", 400);
        }

        $deleted = JsonStorage::transaction(FILE_USERS, function (&$users) use ($targetUser) {
            if (!is_array($users) || !isset($users[$targetUser])) {
                return false;
            }
            unset($users[$targetUser]);
            return true;
        }, []);

        if (!$deleted) {
            jsonError("Account '{$targetUser}' not found.", 404);
        }

        CryptoService::appendAudit($admin['name'], $admin['role'], 'USER_ACCOUNT_DELETED', $targetUser, []);

        jsonResponse([
            'success' => true,
            'message' => "Account '{$targetUser}' successfully removed from system."
        ]);
    }

    // Route: PUT /api/admin/users/{username}/status — Suspend or Activate Account (SUPER_ADMIN / ADMIN)
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'users' && isset($parts[2]) && ($parts[3] ?? '') === 'status' && $method === 'PUT') {
        $actor = AuthService::requireRole(['ADMIN', 'SUPER_ADMIN']);
        $targetUser = strtolower(trim(rawurldecode($parts[2])));
        $body = getJsonBody();
        $newStatus = strtolower(trim((string)($body['status'] ?? 'active')));

        if (!in_array($newStatus, ['active', 'suspended'], true)) {
            jsonError("Invalid status. Allowed values: 'active', 'suspended'.", 400);
        }

        if ($targetUser === 'commander' && $newStatus === 'suspended') {
            jsonError("Root Super Admin account 'commander' cannot be suspended.", 403);
        }
        if ($targetUser === strtolower($actor['username']) && $newStatus === 'suspended') {
            jsonError("You cannot suspend your own active account.", 400);
        }

        $users = JsonStorage::read(FILE_USERS, []);
        if (!isset($users[$targetUser])) {
            jsonError("Account '{$targetUser}' not found.", 404);
        }

        // Standard Admin cannot suspend SUPER_ADMIN accounts
        $targetRole = $users[$targetUser]['role'] ?? 'HERO';
        if ($actor['role'] === 'ADMIN' && in_array($targetRole, ['SUPER_ADMIN', 'ADMIN'], true)) {
            jsonError("ACCESS DENIED: Standard Admins cannot alter status of administrative accounts.", 403);
        }

        $updated = JsonStorage::transaction(FILE_USERS, function (&$uList) use ($targetUser, $newStatus) {
            if (!isset($uList[$targetUser])) return false;
            $uList[$targetUser]['status'] = $newStatus;
            $uList[$targetUser]['is_active'] = ($newStatus === 'active');
            $uList[$targetUser]['updated_at'] = date('c');
            return $uList[$targetUser];
        }, []);

        CryptoService::appendAudit($actor['name'], $actor['role'], 'USER_STATUS_CHANGED', $targetUser, [
            'new_status' => $newStatus,
            'target_role' => $targetRole
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Account '{$targetUser}' status successfully set to '{$newStatus}'.",
            'user' => [
                'username' => $targetUser,
                'status' => $newStatus,
                'is_active' => ($newStatus === 'active')
            ]
        ]);
    }

    // Route: PUT /api/admin/users/{username}/reset-password — Reset User Passkey (SUPER_ADMIN, ADMIN, or REGISTRAR for heroes)
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'users' && isset($parts[2]) && ($parts[3] ?? '') === 'reset-password' && $method === 'PUT') {
        $actor = AuthService::requireRole(['REGISTRAR', 'ADMIN', 'SUPER_ADMIN']);
        $targetInput = strtolower(trim(rawurldecode($parts[2])));
        $body = getJsonBody();
        $newPass = trim((string)($body['new_password'] ?? $body['password'] ?? ''));

        if (strlen($newPass) < 4) {
            jsonError("Passkey must be at least 4 characters long.", 400);
        }

        $users = JsonStorage::read(FILE_USERS, []);
        $targetUser = $targetInput;
        $targetInputClean = preg_replace('/[^a-z0-9]/', '', $targetInput);

        // 1. Direct match or case-insensitive key search in users
        if (!isset($users[$targetUser])) {
            foreach ($users as $uKey => $uData) {
                if (strtolower($uKey) === $targetInput || strtolower($uData['username'] ?? '') === $targetInput) {
                    $targetUser = $uKey;
                    break;
                }
            }
        }

        // 2. Search users by hero_id or normalized username
        if (!isset($users[$targetUser])) {
            foreach ($users as $uKey => $uData) {
                $uHeroId = strtolower($uData['hero_id'] ?? '');
                $uNameClean = preg_replace('/[^a-z0-9]/', '', strtolower($uData['username'] ?? $uKey));
                if ($uHeroId === $targetInput || (!empty($uHeroId) && preg_replace('/[^a-z0-9]/', '', $uHeroId) === $targetInputClean) || (!empty($uNameClean) && $uNameClean === $targetInputClean)) {
                    $targetUser = $uKey;
                    break;
                }
            }
        }

        // 3. If still not found, check if target corresponds to a registered hero in heroes.json
        if (!isset($users[$targetUser])) {
            $heroes = JsonStorage::read(FILE_HEROES, []);
            $matchedHero = null;
            foreach ($heroes as $h) {
                $hId = strtolower($h['id'] ?? '');
                $hAlias = strtolower($h['alias'] ?? '');
                $hAliasClean = preg_replace('/[^a-z0-9]/', '', $hAlias);
                $hIdClean = preg_replace('/[^a-z0-9]/', '', $hId);

                if ($hId === $targetInput || $hAlias === $targetInput ||
                    (!empty($hAliasClean) && $hAliasClean === $targetInputClean) ||
                    (!empty($hIdClean) && ($hIdClean === $targetInputClean || str_contains($hIdClean, $targetInputClean)))) {
                    $matchedHero = $h;
                    break;
                }
            }

            if ($matchedHero) {
                $targetUsername = strtolower(preg_replace('/[^a-zA-Z0-9._-]/', '', $matchedHero['alias'] ?? $targetInput));
                if (empty($targetUsername)) {
                    $targetUsername = 'hero_' . strtolower(substr(md5($matchedHero['id'] ?? uniqid()), 0, 6));
                }

                $newHeroUser = [
                    'username' => $targetUsername,
                    'password_hash' => password_hash($newPass, PASSWORD_BCRYPT),
                    'role' => 'HERO',
                    'name' => ($matchedHero['alias'] ?? $targetUsername) . (!empty($matchedHero['real_name']) ? " ({$matchedHero['real_name']})" : ''),
                    'hero_id' => $matchedHero['id'] ?? null,
                    'avatar' => $matchedHero['avatar'] ?? '/img/apex.jpg',
                    'clearance_level' => 1,
                    'created_at' => date('c'),
                    'updated_at' => date('c')
                ];

                JsonStorage::transaction(FILE_USERS, function (&$uList) use ($targetUsername, $newHeroUser) {
                    if (!is_array($uList)) $uList = [];
                    $uList[$targetUsername] = $newHeroUser;
                    return true;
                }, []);

                CryptoService::appendAudit($actor['name'], $actor['role'], 'HERO_PASSKEY_INITIALIZED', $targetUsername, [
                    'hero_id' => $matchedHero['id'] ?? null,
                    'hero_alias' => $matchedHero['alias'] ?? $targetUsername,
                    'target_role' => 'HERO',
                    'managed_by_role' => $actor['role']
                ]);

                jsonResponse([
                    'success' => true,
                    'message' => "Security passkey for hero '{$targetUsername}' successfully initialized and provisioned.",
                    'username' => $targetUsername
                ]);
            }

            jsonError("Account '{$targetInput}' not found in personnel registry.", 404);
        }

        $targetRole = $users[$targetUser]['role'] ?? 'HERO';

        // Privilege Boundary Enforcement:
        // 1. Standard Admin handles day-to-day password changes for regular users (HERO, REGISTRAR),
        // but is strictly blocked from resetting SUPER_ADMIN credentials.
        if ($actor['role'] === 'ADMIN' && $targetRole === 'SUPER_ADMIN') {
            CryptoService::appendAudit($actor['name'], $actor['role'], 'UNAUTHORIZED_PASSKEY_RESET_BLOCKED', $targetUser, [
                'reason' => 'Standard Admin attempted to reset Super Admin passkey',
                'target_role' => $targetRole
            ]);
            jsonError("ACCESS DENIED: Standard Admins cannot modify or reset Super Admin credentials.", 403);
        }

        // 2. Registrar can only reset Hero operative accounts
        if ($actor['role'] === 'REGISTRAR' && $targetRole !== 'HERO') {
            CryptoService::appendAudit($actor['name'], $actor['role'], 'UNAUTHORIZED_REGISTRAR_RESET_BLOCKED', $targetUser, [
                'reason' => 'Registrar attempted to reset administrative passkey',
                'target_role' => $targetRole
            ]);
            jsonError("ACCESS DENIED: Registrars can only reset passwords for Hero operatives.", 403);
        }

        $updated = JsonStorage::transaction(FILE_USERS, function (&$users) use ($targetUser, $newPass) {
            if (!is_array($users) || !isset($users[$targetUser])) {
                return false;
            }
            $users[$targetUser]['password_hash'] = password_hash($newPass, PASSWORD_BCRYPT);
            $users[$targetUser]['updated_at'] = date('c');
            return true;
        }, []);

        if (!$updated) {
            jsonError("Account '{$targetUser}' not found.", 404);
        }

        CryptoService::appendAudit($actor['name'], $actor['role'], 'USER_PASSKEY_RESET', $targetUser, [
            'target_role' => $targetRole,
            'managed_by_role' => $actor['role']
        ]);

        jsonResponse([
            'success' => true,
            'message' => "Security passkey for '{$targetUser}' successfully updated.",
            'username' => $targetUser
        ]);
    }

    // Route: GET /api/admin/export/heroes — Export heroes registry as JSON or CSV
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'export' && ($parts[2] ?? '') === 'heroes' && $method === 'GET') {
        $actor = AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $heroes = JsonStorage::read(FILE_HEROES, []);
        $format = strtolower($_GET['format'] ?? 'json');

        if ($format === 'csv') {
            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="ghrms_heroes_' . date('Ymd_His') . '.csv"');
            $out = fopen('php://output', 'w');

            // Defensive CSV Cell Sanitizer: Neutralize formula execution in spreadsheet software (CWE-1236)
            $sanitizeCell = static function ($val): string {
                $str = (string)($val ?? '');
                if (strlen($str) > 0 && in_array($str[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
                    return "'" . $str;
                }
                return $str;
            };

            fputcsv($out, ['ID', 'Alias', 'Real Name', 'Role', 'Status', 'License Number', 'Threat Tier', 'Primary Power', 'Region']);
            foreach ($heroes as $h) {
                fputcsv($out, [
                    $sanitizeCell($h['id'] ?? ''),
                    $sanitizeCell($h['alias'] ?? ''),
                    $sanitizeCell($h['real_name'] ?? ''),
                    $sanitizeCell($h['role_tag'] ?? 'Hero'),
                    $sanitizeCell($h['status'] ?? ''),
                    $sanitizeCell($h['license_number'] ?? ''),
                    $sanitizeCell($h['threat_tier_label'] ?? ($h['threat_tier'] ?? '')),
                    $sanitizeCell($h['primary_power'] ?? ''),
                    $sanitizeCell($h['region'] ?? '')
                ]);
            }
            fclose($out);

            CryptoService::appendAudit($actor['name'], $actor['role'], 'HERO_REGISTRY_EXPORTED', 'EXPORT_CSV', [
                'format' => 'csv',
                'record_count' => count($heroes)
            ]);
            exit;
        }

        CryptoService::appendAudit($actor['name'], $actor['role'], 'HERO_REGISTRY_EXPORTED', 'EXPORT_JSON', [
            'format' => 'json',
            'record_count' => count($heroes)
        ]);

        header('Content-Type: application/json; charset=UTF-8');
        header('Content-Disposition: attachment; filename="ghrms_heroes_' . date('Ymd_His') . '.json"');
        echo json_encode([
            'success' => true,
            'export_timestamp' => date('c'),
            'count' => count($heroes),
            'total_records' => count($heroes),
            'data' => array_values($heroes)
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Route: GET /api/admin/export/audit — Export chained audit ledger
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'export' && ($parts[2] ?? '') === 'audit' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $ledger = JsonStorage::read(FILE_AUDIT, []);
        $verification = CryptoService::verifyAuditChain();

        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="ghrms_audit_ledger_' . date('Ymd_His') . '.json"');
        echo json_encode([
            'success' => true,
            'export_timestamp' => date('c'),
            'integrity_verified' => $verification['valid'],
            'chain_valid' => $verification['valid'],
            'count' => count($ledger),
            'entry_count' => count($ledger),
            'total_entries' => count($ledger),
            'verification' => $verification,
            'ledger' => $ledger
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Route: GET /api/sentinel/export — Export checkpoint scan log
    if ($parts[0] === 'sentinel' && ($parts[1] ?? '') === 'export' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'ADMIN', 'SUPER_ADMIN']);
        $ledger = JsonStorage::read(FILE_AUDIT, []);
        $sentinelScans = array_filter($ledger, function ($entry) {
            return strpos($entry['action'] ?? '', 'SENTINEL_') === 0;
        });

        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="sentinel_checkpoint_log_' . date('Ymd_His') . '.json"');
        echo json_encode([
            'success' => true,
            'export_timestamp' => date('c'),
            'total_scans' => count($sentinelScans),
            'scans' => array_values(array_reverse($sentinelScans))
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Route: POST /api/admin/system/reset-data — Restore Factory Canon Data (SUPER_ADMIN only)
    if ($parts[0] === 'admin' && ($parts[1] ?? '') === 'system' && ($parts[2] ?? '') === 'reset-data' && $method === 'POST') {
        $admin = AuthService::requireRole('SUPER_ADMIN');
        $body = getJsonBody();
        if (($body['confirm'] ?? '') !== 'CONFIRM_FACTORY_RESET') {
            jsonError("Action requires explicit confirmation payload: {'confirm': 'CONFIRM_FACTORY_RESET'}.", 400);
        }
        require_once __DIR__ . '/seed.php';
        $seedResult = seedGHRMSData();

        CryptoService::appendAudit($admin['name'], $admin['role'], 'SYSTEM_FACTORY_RESET', 'GHRMS_DATA', [
            'timestamp' => date('c'),
            'heroes_restored' => $seedResult['heroes'] ?? 0
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'System successfully restored to baseline factory canon data.',
            'stats' => $seedResult,
            'details' => $seedResult
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/audit-ledger — REGISTRAR / SUPER_ADMIN only
    // -------------------------------------------------------------
    if ($parts[0] === 'audit-ledger' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'SUPER_ADMIN']);
        $ledger = JsonStorage::read(FILE_AUDIT, []);
        $verification = CryptoService::verifyAuditChain();

        jsonResponse([
            'success' => true,
            'chain_valid' => $verification['valid'],
            'total_entries' => count($ledger),
            'verification' => $verification,
            'data' => array_reverse($ledger) // Newest first
        ]);
    }

    // Route: GET /api/tactical-weather — OpenWeatherMap Tactical Meteorological Telemetry
    // -------------------------------------------------------------
    if ($parts[0] === 'tactical-weather' && $method === 'GET') {
        $lat = isset($_GET['lat']) ? (float)$_GET['lat'] : 8.5110;
        $lon = isset($_GET['lon']) ? (float)$_GET['lon'] : 125.9800;
        $heroId = $_GET['hero_id'] ?? null;

        if ($heroId) {
            $heroes = JsonStorage::read(FILE_HEROES, []);
            foreach ($heroes as $h) {
                if ($h['id'] === $heroId && !empty($h['coordinates'])) {
                    $lat = (float)($h['coordinates']['lat'] ?? $lat);
                    $lon = (float)($h['coordinates']['lng'] ?? $lon);
                    break;
                }
            }
        }

        $cacheKey = 'owm_tactical_' . round($lat, 2) . '_' . round($lon, 2);
        $cacheFile = sys_get_temp_dir() . '/' . $cacheKey . '.json';
        $cachedData = null;

        if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 300)) {
            $cachedData = json_decode((string)file_get_contents($cacheFile), true);
        }

        $activeKey = OPENWEATHER_API_KEY;
        if (!$cachedData) {
            $apiKey = OPENWEATHER_API_KEY;
            $url = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&appid={$apiKey}&units=metric";
            
            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 4,
                    'user_agent' => 'GHRMS-Tactical-Radar/2.0',
                    'ignore_errors' => true
                ]
            ]);

            $raw = @file_get_contents($url, false, $ctx);
            if ($raw !== false) {
                $owmData = json_decode($raw, true);
                if (!empty($owmData['main'])) {
                    $cachedData = $owmData;
                    $activeKey = $apiKey;
                    @file_put_contents($cacheFile, json_encode($owmData));
                }
            }

            // If user's key is newly created and still activating on OWM servers (401), use backup key
            if (!$cachedData && defined('OPENWEATHER_BACKUP_KEY') && OPENWEATHER_BACKUP_KEY !== $apiKey) {
                $backupKey = OPENWEATHER_BACKUP_KEY;
                $urlBackup = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&appid={$backupKey}&units=metric";
                $rawBackup = @file_get_contents($urlBackup, false, $ctx);
                if ($rawBackup !== false) {
                    $owmBackup = json_decode($rawBackup, true);
                    if (!empty($owmBackup['main'])) {
                        $cachedData = $owmBackup;
                        $activeKey = $backupKey;
                        @file_put_contents($cacheFile, json_encode($owmBackup));
                    }
                }
            }
        }

        if (!$cachedData) {
            // Fallback nominal telemetry if offline
            $cachedData = [
                'name' => 'San Francisco, Agusan del Sur',
                'main' => ['temp' => 19.5, 'feels_like' => 19.0, 'humidity' => 55, 'pressure' => 1022],
                'wind' => ['speed' => 3.6, 'deg' => 80],
                'visibility' => 10000,
                'weather' => [['main' => 'Clear', 'description' => 'clear tactical sky', 'icon' => '01d']],
                'clouds' => ['all' => 15]
            ];
        }

        // Calculate Tactical Flight & Hazard Clearance
        $windSpeed = (float)($cachedData['wind']['speed'] ?? 0);
        $visibility = (int)($cachedData['visibility'] ?? 10000);
        $weatherMain = $cachedData['weather'][0]['main'] ?? 'Clear';
        $flightClearance = 'OPTIMAL';
        $hazardLevel = 'NOMINAL';

        if ($windSpeed > 15 || $visibility < 2000 || in_array($weatherMain, ['Thunderstorm', 'Tornado', 'Squall'])) {
            $flightClearance = 'RESTRICTED (HIGH SHEAR)';
            $hazardLevel = 'CRITICAL ATMOSPHERIC';
        } elseif ($windSpeed > 8 || $visibility < 5000 || in_array($weatherMain, ['Rain', 'Snow'])) {
            $flightClearance = 'ADVISORY (STABILIZERS REQ)';
            $hazardLevel = 'ELEVATED METEOROLOGICAL';
        }

        jsonResponse([
            'success' => true,
            'source' => 'OpenWeatherMap.org Tactical API v2.5',
            'api_key_configured' => !empty(OPENWEATHER_API_KEY),
            'sector_name' => $cachedData['name'] ?? 'San Francisco, Agusan del Sur',
            'coordinates' => ['lat' => $lat, 'lon' => $lon],
            'tactical_eval' => [
                'flight_clearance' => $flightClearance,
                'atmospheric_hazard' => $hazardLevel,
                'aerial_deployment_safe' => ($flightClearance === 'OPTIMAL')
            ],
            'telemetry' => [
                'temperature' => round((float)($cachedData['main']['temp'] ?? 20), 1),
                'feels_like'  => round((float)($cachedData['main']['feels_like'] ?? 20), 1),
                'humidity'    => (int)($cachedData['main']['humidity'] ?? 50),
                'pressure'    => (int)($cachedData['main']['pressure'] ?? 1013),
                'visibility'  => $visibility,
                'wind_speed'  => $windSpeed,
                'wind_deg'    => (int)($cachedData['wind']['deg'] ?? 0),
                'cloud_cover' => (int)($cachedData['clouds']['all'] ?? 0),
                'condition'   => $cachedData['weather'][0]['description'] ?? 'Clear',
                'icon'        => $cachedData['weather'][0]['icon'] ?? '01d'
            ],
            'tile_layers' => [
                'clouds'        => "https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=" . $activeKey,
                'precipitation' => "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=" . $activeKey,
                'wind'          => "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=" . $activeKey,
                'temp'          => "https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=" . $activeKey
            ],
            'api_key' => OPENWEATHER_API_KEY,
            'active_tile_key' => $activeKey,
            'key_source' => '.env / .env.example'
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/sentinel/scan — Law Enforcement Checkpoint Scan
    // -------------------------------------------------------------
    if ($parts[0] === 'sentinel' && ($parts[1] ?? '') === 'scan' && $method === 'POST') {
        RateLimiter::check('sentinel_scan', 60, 60);
        $officerUser = AuthService::getCurrentUser();
        if (!$officerUser) {
            $officerUser = [
                'name' => 'Ofc. Valdez',
                'role' => 'LAW_ENFORCEMENT',
                'username' => 'unit_402'
            ];
        }
        $body = getJsonBody();
        $rawQuery = trim((string)($body['qr_input'] ?? $body['payload'] ?? $body['query'] ?? $body['qr'] ?? $body['scan'] ?? $body['id'] ?? $body['hero_id'] ?? ''));
        $checkpoint = trim((string)($body['checkpoint'] ?? $body['checkpoint_id'] ?? 'CHECKPOINT-01 // SECTOR 1 METRO'));
        $officer = trim((string)($body['officer'] ?? ($officerUser['name'] . ' (' . ($officerUser['role'] ?? 'OFFICER') . ')')));
        $token = trim((string)($body['token'] ?? $body['pin'] ?? ''));

        // Strip surrounding quotes or brackets if present
        $cleanId = $rawQuery;
        if ((str_starts_with($cleanId, '"') && str_ends_with($cleanId, '"')) ||
            (str_starts_with($cleanId, "'") && str_ends_with($cleanId, "'"))) {
            $cleanId = substr($cleanId, 1, -1);
        }

        // 1. Parse JSON payload (e.g. {"hid":"hero_lumina_02", "tok":"123456"})
        $trimmedJson = trim($cleanId);
        if (str_starts_with($trimmedJson, '{') && str_ends_with($trimmedJson, '}')) {
            $json = json_decode($trimmedJson, true);
            if (is_array($json)) {
                if (!empty($json['hid'])) $cleanId = trim((string)$json['hid']);
                elseif (!empty($json['id'])) $cleanId = trim((string)$json['id']);
                elseif (!empty($json['hero_id'])) $cleanId = trim((string)$json['hero_id']);
                if (!empty($json['tok'])) $token = trim((string)$json['tok']);
            }
        }

        // 2. Parse URI protocol: GHRMS://HERO/{id_or_code}
        if (preg_match('/GHRMS:\/\/HERO\/([a-zA-Z0-9_\-\.]+)/i', $cleanId, $m)) {
            $cleanId = $m[1];
        }
        // 3. Parse web URL query parameter: ?id=..., ?hero_id=..., ?scan=...
        elseif (preg_match('/[?&](?:id|hero_id|scan)=([a-zA-Z0-9_\-\.]+)/i', $cleanId, $m)) {
            $cleanId = $m[1];
        }
        // 4. Parse URL path format: /hero/{id}
        elseif (preg_match('/\/hero\/([a-zA-Z0-9_\-]+)/i', $cleanId, $m)) {
            $cleanId = $m[1];
        }

        $cleanId = trim($cleanId);

        if (empty($cleanId)) {
            jsonError("Operative QR code or ID parameter is required for scanning.");
        }

        $heroes = JsonStorage::read(FILE_HEROES, []);
        $matchedHero = null;

        // 1. Direct ID match
        if (isset($heroes[$cleanId])) {
            $matchedHero = $heroes[$cleanId];
        } else {
            $searchLower = strtolower($cleanId);

            // 2. Exact match by ID (case-insensitive)
            foreach ($heroes as $h) {
                if (strtolower($h['id'] ?? '') === $searchLower) {
                    $matchedHero = $h;
                    break;
                }
            }

            // 3. Exact match by Government Code (e.g. 9GH-8430, 9GH-8431, USA-77441122)
            if (!$matchedHero) {
                foreach ($heroes as $h) {
                    if (!empty($h['gov_code']) && strtolower(trim($h['gov_code'])) === $searchLower) {
                        $matchedHero = $h;
                        break;
                    }
                }
            }

            // 4. Exact match by License Number (e.g. GHRMS-LIC-9GH-8430, HRS-LIC-2026-5263)
            if (!$matchedHero) {
                foreach ($heroes as $h) {
                    if (!empty($h['license_number']) && strtolower(trim($h['license_number'])) === $searchLower) {
                        $matchedHero = $h;
                        break;
                    }
                }
            }

            // 5. Match by Alias (e.g. APEX, LUMINA, ATLAS)
            if (!$matchedHero) {
                $aliasCandidates = [];
                foreach ($heroes as $h) {
                    if (!empty($h['alias']) && strtolower(trim($h['alias'])) === $searchLower) {
                        $aliasCandidates[] = $h;
                    }
                }
                if (count($aliasCandidates) === 1) {
                    $matchedHero = $aliasCandidates[0];
                } elseif (count($aliasCandidates) > 1) {
                    // Pick the candidate with an active license or complete registration
                    $picked = $aliasCandidates[0];
                    foreach ($aliasCandidates as $cand) {
                        if (!empty($cand['avatar']) || !empty($cand['license_number'])) {
                            $picked = $cand;
                            break;
                        }
                    }
                    $matchedHero = $picked;
                }
            }
        }

        if (!$matchedHero) {
            // Log failed scan of unauthorized credential
            CryptoService::appendAudit('SENTINEL-CHECKPOINT', 'LAW_ENFORCEMENT', 'SENTINEL_UNREGISTERED_INTRUDER', $cleanId, [
                'checkpoint' => $checkpoint,
                'officer' => $officer,
                'query' => $rawQuery,
                'result' => 'NOT_FOUND_UNREGISTERED'
            ]);

            jsonResponse([
                'success' => false,
                'error' => 'SECURITY BREACH: Subject credential is NOT registered in federal superhuman database. Detain for identity verification.',
                'status' => 'UNREGISTERED',
                'alert_level' => 'RED',
                'message' => 'SECURITY BREACH: Subject credential is NOT registered in federal superhuman database. Detain for identity verification.',
                'queried_id' => $cleanId,
                'checkpoint' => $checkpoint,
                'timestamp' => date('c')
            ], 404);
        }

        $hId = $matchedHero['id'];
        $status = $matchedHero['status'] ?? 'Under Review';
        $statusLower = strtolower($status);
        $isRogue = (strpos($statusLower, 'rogue') !== false || strpos($statusLower, 'locked') !== false || strpos($statusLower, 'revoked') !== false || !empty($matchedHero['revoked_at']) || (!empty($matchedHero['license_number']) && strpos(strtolower($matchedHero['license_number']), 'revoked') !== false));
        $isLicensed = (strpos($statusLower, 'license') !== false && !$isRogue);

        // Determine containment directive if rogue
        $containmentDirective = null;
        $alertLevel = 'AMBER';
        if ($isRogue) {
            $alertLevel = 'RED';
            $containmentDirective = [
                'code' => 'DIRECTIVE ALPHA-CONTAINMENT',
                'power_suppression_frequency' => '728.45 MHz (Neural/Kinetic Dampener)',
                'threat_class' => $matchedHero['threat_tier_label'] ?? 'Class B',
                'action' => 'IMMEDIATE TACTICAL ARREST // DO NOT ENGAGE UNARMED // NOTIFY SECTOR COMMAND'
            ];
        } elseif ($isLicensed) {
            $alertLevel = 'GREEN';
        }

        // Secondary TOTP verification if token supplied
        $totpVerified = null;
        if (!empty($token)) {
            $totpResult = CryptoService::verifyBadgeToken($hId, $matchedHero['badge_secret'] ?? '', $token, 30);
            $totpVerified = $totpResult['valid'];
        }

        // Append to cryptographic audit ledger
        $auditAction = $isRogue ? 'SENTINEL_ROGUE_INTERCEPTED' : ($isLicensed ? 'SENTINEL_CHECKPOINT_PASSED' : 'SENTINEL_PROVISIONAL_AUDITED');
        CryptoService::appendAudit('SENTINEL-CHECKPOINT', 'LAW_ENFORCEMENT', $auditAction, $hId, [
            'checkpoint' => $checkpoint,
            'officer' => $officer,
            'status' => $status,
            'totp_verified' => $totpVerified,
            'threat' => $matchedHero['threat_tier_label'] ?? 'Unknown',
            'alias' => $matchedHero['alias'],
            'hero_id' => $hId,
            'qr_input' => $rawQuery
        ]);

        // Avatar resolution: use operative's custom avatar first
        $avatar = !empty($matchedHero['avatar']) ? $matchedHero['avatar'] : null;
        if (!$avatar) {
            $aliasUpper = strtoupper($matchedHero['alias'] ?? '');
            if (str_contains($aliasUpper, 'SOLARIS')) {
                $avatar = '/img/solaris.jpg';
            } elseif (str_contains($aliasUpper, 'LUMINA') || str_contains($aliasUpper, 'DAWN')) {
                $avatar = '/img/lumina.jpg';
            } elseif (str_contains($aliasUpper, 'AERO') || str_contains($aliasUpper, 'SCOUT') || str_contains($aliasUpper, 'BYTE')) {
                $avatar = '/img/aeroscout.jpg';
            } elseif (str_contains($aliasUpper, 'ATLAS') || str_contains($aliasUpper, 'STEEL') || str_contains($aliasUpper, 'PULSE')) {
                $avatar = '/img/atlas.jpg';
            } elseif (str_contains($aliasUpper, 'APEX')) {
                $avatar = '/img/apex.jpg';
            } else {
                // Dynamic SVG monogram badge for other operatives rather than misattributing Apex's face
                $initials = substr($aliasUpper, 0, 2);
                $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">'
                     . '<rect width="128" height="128" fill="#0f172a"/>'
                     . '<circle cx="64" cy="64" r="50" stroke="#38bdf8" stroke-width="4" fill="none"/>'
                     . '<text x="64" y="74" font-family="monospace" font-size="36" font-weight="bold" fill="#38bdf8" text-anchor="middle">' . htmlspecialchars($initials) . '</text>'
                     . '</svg>';
                $avatar = 'data:image/svg+xml;utf8,' . rawurlencode($svg);
            }
        }

        $realName = $matchedHero['real_name'] ?? null;
        if (empty($realName) && !empty($matchedHero['vault_id'])) {
            $vaultData = CryptoService::decryptVault($matchedHero['vault_id']);
            if ($vaultData && !empty($vaultData['real_name'])) {
                $realName = $vaultData['real_name'];
            }
        }
        if (empty($realName)) {
            $realName = 'Classified Operative';
        }

        $powers = array_values(array_filter([$matchedHero['primary_power'] ?? '', $matchedHero['secondary_power'] ?? '']));

        $dossier = [
            'id' => $matchedHero['id'],
            'alias' => $matchedHero['alias'],
            'real_name' => $realName,
            'avatar_url' => $avatar,
            'avatar' => $avatar,
            'role' => $matchedHero['role_tag'] ?? 'Hero',
            'role_tag' => $matchedHero['role_tag'] ?? 'Hero',
            'is_sidekick' => (strtolower($matchedHero['role_tag'] ?? '') === 'sidekick'),
            'category' => $matchedHero['role_tag'] ?? 'Hero',
            'status' => $status,
            'is_rogue' => $isRogue,
            'is_licensed' => $isLicensed,
            'threat_tier' => $matchedHero['threat_tier'] ?? 2,
            'threat_tier_label' => $matchedHero['threat_tier_label'] ?? 'B-Class',
            'powers' => $powers,
            'primary_power' => $matchedHero['primary_power'] ?? 'Kinetic',
            'secondary_power' => $matchedHero['secondary_power'] ?? 'None',
            'sector' => $matchedHero['sector'] ?? 1,
            'region' => $matchedHero['region'] ?? 'Sector 1 - Poblacion Central Commercial Grid',
            'gov_code' => $matchedHero['gov_code'] ?? '---',
            'license_number' => $matchedHero['license_number'] ?? 'PENDING-LIC-000',
            'tactical_directive' => $containmentDirective ? $containmentDirective['code'] : 'NORMAL_MONITORING',
            'containment_directive' => $containmentDirective,
            'pin_verified' => $totpVerified,
            'scanned_at' => date('c'),
            'checkpoint' => $checkpoint,
            'officer' => $officer,
            'audit_entry' => [
                'action' => $auditAction,
                'hash' => hash('sha256', $hId . microtime(true))
            ]
        ];

        jsonResponse([
            'success' => true,
            'data' => $dossier,
            'alert_level' => $alertLevel,
            'is_rogue' => $isRogue,
            'is_licensed' => $isLicensed,
            'checkpoint' => $checkpoint,
            'officer' => $officer,
            'timestamp' => date('c'),
            'totp_checked' => !empty($token),
            'totp_valid' => $totpVerified,
            'containment_directive' => $containmentDirective,
            'operative' => $dossier
        ]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/sentinel/history — Checkpoint Live Activity Feed (REGISTRAR / ADMIN / SUPER_ADMIN)
    // -------------------------------------------------------------
    if ($parts[0] === 'sentinel' && ($parts[1] ?? '') === 'history' && $method === 'GET') {
        AuthService::requireRole(['REGISTRAR', 'ADMIN', 'SUPER_ADMIN']);
        $ledger = JsonStorage::read(FILE_AUDIT, []);
        $sentinelLogs = [];

        // Filter for sentinel checkpoint events
        for ($i = count($ledger) - 1; $i >= 0 && count($sentinelLogs) < 15; $i--) {
            $entry = $ledger[$i];
            if (strpos($entry['action'], 'SENTINEL_') === 0 ||
                ($entry['actor'] ?? '') === 'SENTINEL-CHECKPOINT' ||
                strpos($entry['action'], 'BADGE') !== false) {
                $sentinelLogs[] = $entry;
            }
        }

        jsonResponse([
            'success' => true,
            'total' => count($sentinelLogs),
            'data' => $sentinelLogs
        ]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/sentinel/alert — Checkpoint Emergency Broadcast (REGISTRAR / ADMIN / SUPER_ADMIN)
    // -------------------------------------------------------------
    if ($parts[0] === 'sentinel' && ($parts[1] ?? '') === 'alert' && $method === 'POST') {
        $alertOfficer = AuthService::requireRole(['REGISTRAR', 'ADMIN', 'SUPER_ADMIN']);
        $body = getJsonBody();
        $heroId = trim((string)($body['hero_id'] ?? 'UNKNOWN'));
        $checkpoint = trim((string)($body['checkpoint'] ?? 'CHECKPOINT-01'));
        $notes = trim((string)($body['notes'] ?? 'Rogue operative intercepted at checkpoint. Immediate containment scramble ordered.'));

        CryptoService::appendAudit($alertOfficer['name'], $alertOfficer['role'], 'SENTINEL_EMERGENCY_BROADCAST', $heroId, [
            'checkpoint' => $checkpoint,
            'notes' => $notes,
            'urgency' => 'PRIORITY_ALPHA',
            'terminal' => 'SENTINEL-DISPATCH'
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'Tactical containment alert broadcasted to municipal law enforcement and GHRMS Super Admin Command Center.',
            'timestamp' => date('c'),
            'hero_id' => $heroId,
            'checkpoint' => $checkpoint
        ]);
    }

    // Unmatched API route
    jsonError("Endpoint not found: {$endpoint}", 404);

} catch (Throwable $e) {
    error_log("Unhandled GHRMS Exception: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
    if (defined('APP_DEBUG') && APP_DEBUG === true) {
        jsonError("Server error: " . $e->getMessage(), 500, ['trace' => $e->getFile() . ':' . $e->getLine()]);
    } else {
        jsonError("An internal server error occurred. Please contact the security administrator.", 500);
    }
}
