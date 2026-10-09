<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/crypto.php';

defined('FILE_USERS') || define('FILE_USERS', DATA_DIR . '/users.json');

class AuthService {
    /**
     * Start secure session if not already active
     */
    public static function initSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            // Configure secure session cookies
            $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
                        (getenv('APP_ENV') === 'production' && !empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
            if (!headers_sent()) {
                session_set_cookie_params([
                    'lifetime' => 86400, // 24 hours
                    'path' => '/',
                    'httponly' => true,
                    'secure' => $isSecure,
                    'samesite' => 'Lax'
                ]);
                session_start();
            } else {
                @session_start();
            }

            // Ensure all legacy vault records are safely migrated before any decryption is attempted
            if (class_exists('CryptoService')) {
                CryptoService::migrateVaultHmac();
            }
        }
    }

    /**
     * Seed default users if users.json does not exist
     */
    public static function seedUsers(): void {
        if (file_exists(FILE_USERS)) {
            return;
        }

        $users = [
            'apex' => [
                'username' => 'apex',
                'password_hash' => password_hash('hero123', PASSWORD_BCRYPT),
                'role' => 'HERO',
                'name' => 'Samuel Wright (APEX)',
                'hero_id' => 'hero_apex_01',
                'avatar' => '/img/apex.jpg',
                'clearance_level' => 1,
                'created_at' => date('c')
            ],
            'lumina' => [
                'username' => 'lumina',
                'password_hash' => password_hash('hero123', PASSWORD_BCRYPT),
                'role' => 'HERO',
                'name' => 'Alice Vance (LUMINA)',
                'hero_id' => 'hero_lumina_02',
                'avatar' => '/img/lumina.jpg',
                'clearance_level' => 1,
                'created_at' => date('c')
            ],
            'sarah.chen' => [
                'username' => 'sarah.chen',
                'password_hash' => password_hash('registrar123', PASSWORD_BCRYPT),
                'role' => 'REGISTRAR',
                'name' => 'Sarah Chen',
                'hero_id' => null,
                'avatar' => '/img/sarah_chen.jpg',
                'clearance_level' => 3,
                'created_at' => date('c')
            ],
            'commander' => [
                'username' => 'commander',
                'password_hash' => password_hash('admin123', PASSWORD_BCRYPT),
                'role' => 'SUPER_ADMIN',
                'name' => 'Commander Vance',
                'hero_id' => null,
                'avatar' => '/img/logo.jpg',
                'clearance_level' => 5,
                'created_at' => date('c')
            ],
            'admin' => [
                'username' => 'admin',
                'password_hash' => password_hash('admin123', PASSWORD_BCRYPT),
                'role' => 'ADMIN',
                'name' => 'Admin Officer',
                'hero_id' => null,
                'avatar' => '/img/sarah_chen.jpg',
                'clearance_level' => 4,
                'created_at' => date('c')
            ],
            'solaris' => [
                'username' => 'solaris',
                'password_hash' => password_hash('hero123', PASSWORD_BCRYPT),
                'role' => 'HERO',
                'name' => 'Elena Rostova (SOLARIS)',
                'hero_id' => 'hero_solaris_a833dd',
                'avatar' => '/img/solaris.jpg',
                'clearance_level' => 1,
                'created_at' => date('c')
            ]
        ];

        JsonStorage::write(FILE_USERS, $users);
    }

    /**
     * Ensure all registered operatives in heroes.json have a corresponding user account
     * in users.json so that passkeys can be managed and each hero can log in.
     */
    public static function syncHeroUsers(): void {
        if (!defined('FILE_HEROES') || !defined('FILE_USERS')) return;
        $heroes = JsonStorage::read(FILE_HEROES, []);
        if (empty($heroes) || !is_array($heroes)) return;

        JsonStorage::transaction(FILE_USERS, function (&$users) use ($heroes) {
            if (!is_array($users)) $users = [];
            $modified = false;

            foreach ($heroes as $hId => $h) {
                if (empty($hId) || !is_array($h)) continue;

                // Check if account already mapped by hero_id
                $existingKey = null;
                foreach ($users as $uKey => $uData) {
                    if (($uData['hero_id'] ?? '') === $hId) {
                        $existingKey = $uKey;
                        break;
                    }
                }

                if (!$existingKey) {
                    $alias = $h['alias'] ?? $hId;
                    $cleanAlias = strtolower(preg_replace('/[^a-zA-Z0-9._-]/', '', $alias));
                    if (empty($cleanAlias)) {
                        $cleanAlias = 'hero_' . strtolower(substr(md5($hId), 0, 6));
                    }

                    $candidate = $cleanAlias;
                    if (isset($users[$candidate]) && ($users[$candidate]['hero_id'] ?? '') !== $hId) {
                        $candidate = $cleanAlias . '_' . substr(md5($hId), 0, 4);
                    }

                    $displayName = $alias;
                    if (!empty($h['real_name'])) {
                        $displayName .= " ({$h['real_name']})";
                    }

                    $users[$candidate] = [
                        'username' => $candidate,
                        'password_hash' => password_hash('hero123', PASSWORD_BCRYPT),
                        'role' => 'HERO',
                        'name' => $displayName,
                        'hero_id' => $hId,
                        'avatar' => $h['avatar'] ?? '/img/apex.jpg',
                        'clearance_level' => 1,
                        'created_at' => $h['created_at'] ?? date('c'),
                        'updated_at' => date('c')
                    ];
                    $modified = true;
                }
            }
            return $modified;
        }, []);
    }

    /**
     * Authenticate user with credentials
     */
    public static function login(string $username, string $password): ?array {
        self::initSession();
        self::seedUsers();
        self::syncHeroUsers();

        $users = JsonStorage::read(FILE_USERS, []);
        $username = strtolower(trim($username));

        if (!isset($users[$username])) {
            CryptoService::appendAudit('SECURITY_GATEWAY', 'ANONYMOUS', 'LOGIN_FAILED', $username, [
                'reason' => 'User does not exist',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
            return null;
        }

        $user = $users[$username];

        // Suspension Check: Deactivated or suspended accounts cannot authenticate
        if ((isset($user['status']) && $user['status'] === 'suspended') || (isset($user['is_active']) && $user['is_active'] === false)) {
            CryptoService::appendAudit('SECURITY_GATEWAY', $user['role'] ?? 'UNKNOWN', 'LOGIN_BLOCKED_SUSPENDED', $username, [
                'reason' => 'Account is administratively suspended or deactivated',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
            return null;
        }

        if (!password_verify($password, $user['password_hash'])) {
            CryptoService::appendAudit('SECURITY_GATEWAY', 'ANONYMOUS', 'LOGIN_FAILED', $username, [
                'reason' => 'Invalid password hash',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
            return null;
        }

        // Production Defense: Prevent live production instances from exposing privileged accounts with public default passwords
        $isPrivileged = in_array($user['role'] ?? '', ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR'], true);
        $isKnownDefault = in_array($password, ['admin123', 'registrar123'], true);
        $envAllow = getenv('ALLOW_DEFAULT_ADMIN_CREDENTIALS');
        $allowDefaults = ($envAllow !== false && $envAllow !== '')
            ? filter_var($envAllow, FILTER_VALIDATE_BOOLEAN)
            : (defined('ALLOW_DEFAULT_ADMIN_CREDENTIALS') ? ALLOW_DEFAULT_ADMIN_CREDENTIALS : false);
        $isProductionStrict = (getenv('APP_ENV') === 'production' && !$allowDefaults);

        if ($isProductionStrict && $isPrivileged && $isKnownDefault) {
            CryptoService::appendAudit('SECURITY_GATEWAY', $user['role'], 'DEFAULT_CREDENTIAL_BLOCKED', $username, [
                'reason' => 'Privileged account login with public default password blocked on production instance',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
            return [
                'blocked_default_credential' => true,
                'message' => 'SECURITY POLICY: Default starter credentials cannot be used on a live production deployment. Please configure custom credentials or set ALLOW_DEFAULT_ADMIN_CREDENTIALS=true in .env.'
            ];
        }

        // Prevent session fixation attacks by regenerating session ID upon privilege elevation
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            @session_regenerate_id(true);
        }

        // Update last_login in users.json
        $loginTime = date('c');
        JsonStorage::transaction(FILE_USERS, function (&$users) use ($username, $loginTime) {
            if (isset($users[$username])) {
                $users[$username]['last_login'] = $loginTime;
            }
            return true;
        }, []);

        // Set session
        $_SESSION['user_id'] = $username;
        $_SESSION['role'] = $user['role'];
        $_SESSION['hero_id'] = $user['hero_id'];
        $_SESSION['name'] = $user['name'];
        $_SESSION['avatar'] = $user['avatar'];
        $_SESSION['clearance_level'] = $user['clearance_level'];
        $_SESSION['logged_in_at'] = time();
        $_SESSION['last_activity'] = time();
        $_SESSION['last_login'] = $loginTime;

        // Audit log
        CryptoService::appendAudit($user['name'], $user['role'], 'USER_AUTHENTICATED', $username, [
            'role' => $user['role'],
            'clearance_level' => $user['clearance_level']
        ]);

        return self::getCurrentUser();
    }

    /**
     * Validate password security policy
     */
    public static function validatePasswordPolicy(string $password): ?string {
        if (strlen($password) < 6) {
            return "Passkey must be at least 6 characters long.";
        }
        if (strlen($password) > 128) {
            return "Passkey exceeds maximum allowable length of 128 characters.";
        }
        return null;
    }

    /**
     * Terminate current session
     */
    /**
     * Clear and destroy active session cookies securely
     */
    public static function destroySessionCookies(): void {
        $_SESSION = [];
        if (ini_get("session.use_cookies") && !headers_sent()) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        if (session_status() === PHP_SESSION_ACTIVE) {
            @session_destroy();
        }
    }

    /**
     * Terminate current session
     */
    public static function logout(): void {
        self::initSession();
        $currentUser = self::getCurrentUser();
        if ($currentUser) {
            CryptoService::appendAudit($currentUser['name'], $currentUser['role'], 'USER_LOGOUT', $currentUser['username'], []);
        }
        self::destroySessionCookies();
    }

    /**
     * Get currently logged-in user profile
     */
    public static function getCurrentUser(): ?array {
        self::initSession();
        if (empty($_SESSION['user_id'])) {
            return null;
        }

        $username = $_SESSION['user_id'];

        // Enforce maximum absolute session duration (default: 86400s / 24h)
        $maxLifetime = (int)(getenv('SESSION_LIFETIME') ?: 86400);
        if (!empty($_SESSION['logged_in_at']) && (time() - (int)$_SESSION['logged_in_at']) > $maxLifetime) {
            CryptoService::appendAudit('SECURITY_GATEWAY', $_SESSION['role'] ?? 'ANONYMOUS', 'SESSION_EXPIRED_MAX_LIFETIME', $username, [
                'reason' => 'Session exceeded maximum allowable duration'
            ]);
            self::destroySessionCookies();
            return null;
        }

        // Enforce idle timeout (default: 1800s / 30m of user inactivity)
        $idleTimeout = (int)(getenv('SESSION_IDLE_TIMEOUT') ?: 1800);
        if (!empty($_SESSION['last_activity']) && (time() - (int)$_SESSION['last_activity']) > $idleTimeout) {
            CryptoService::appendAudit('SECURITY_GATEWAY', $_SESSION['role'] ?? 'ANONYMOUS', 'SESSION_EXPIRED_IDLE', $username, [
                'reason' => 'Session expired due to inactivity'
            ]);
            self::destroySessionCookies();
            return null;
        }
        $_SESSION['last_activity'] = time();

        if (defined('FILE_USERS') && file_exists(FILE_USERS)) {
            $users = JsonStorage::read(FILE_USERS, []);
            $userData = $users[$username] ?? null;

            if (!$userData || (isset($userData['status']) && $userData['status'] === 'suspended') || (isset($userData['is_active']) && $userData['is_active'] === false)) {
                // Immediate session revocation for suspended/inactive/deleted account
                CryptoService::appendAudit('SECURITY_GATEWAY', $_SESSION['role'] ?? 'ANONYMOUS', 'SESSION_REVOKED_SUSPENDED', $username, [
                    'reason' => 'Account is suspended, inactive, or removed from authority registry'
                ]);
                self::destroySessionCookies();
                return null;
            }

            // Sync role or clearance if updated administratively
            if (isset($userData['role'])) {
                $_SESSION['role'] = $userData['role'];
            }
            if (isset($userData['clearance_level'])) {
                $_SESSION['clearance_level'] = $userData['clearance_level'];
            }
        }

        return [
            'username' => $_SESSION['user_id'],
            'role' => $_SESSION['role'],
            'name' => $_SESSION['name'],
            'hero_id' => $_SESSION['hero_id'],
            'avatar' => $_SESSION['avatar'] ?? '/img/sarah_chen.jpg',
            'clearance_level' => $_SESSION['clearance_level'] ?? 1,
            'last_login' => $_SESSION['last_login'] ?? null
        ];
    }

    /**
     * Assert authentication or terminate with 401 Unauthorized
     */
    public static function requireAuth(): array {
        $user = self::getCurrentUser();
        if (!$user) {
            http_response_code(401);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'success' => false,
                'error' => 'AUTHENTICATION REQUIRED: Active security clearance credentials required.',
                'code' => 'UNAUTHORIZED'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }
        return $user;
    }

    /**
     * Assert role membership or throw 403
     */
    public static function requireRole(array|string $roles): array {
        $user = self::requireAuth();
        $allowed = is_array($roles) ? $roles : [$roles];

        $userRole = $user['role'];
        $hasAccess = in_array($userRole, $allowed, true) ||
                     $userRole === 'SUPER_ADMIN' ||
                     ($userRole === 'ADMIN' && (in_array('REGISTRAR', $allowed, true) || in_array('ASSESSOR', $allowed, true) || in_array('HERO', $allowed, true))) ||
                     ($userRole === 'REGISTRAR' && in_array('ASSESSOR', $allowed, true)) ||
                     ($userRole === 'ASSESSOR' && in_array('REGISTRAR', $allowed, true));

        if (!$hasAccess) {
            http_response_code(403);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'success' => false,
                'error' => 'ACCESS DENIED: Insufficient security clearance.',
                'required_roles' => $allowed,
                'your_role' => $user['role'],
                'code' => 'FORBIDDEN'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }

        return $user;
    }
}
