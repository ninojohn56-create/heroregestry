<?php
declare(strict_types=1);

// Prevent direct script execution if accessed via bad routing
defined('HRS_ROOT') || define('HRS_ROOT', dirname(__DIR__));

// Load .env or .env.example file if available in project root
$envFile = file_exists(HRS_ROOT . '/.env') ? (HRS_ROOT . '/.env') : (file_exists(HRS_ROOT . '/.env.example') ? (HRS_ROOT . '/.env.example') : null);
if ($envFile && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }
            if (getenv($key) === false) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_DEBUG', filter_var(getenv('APP_DEBUG') ?: false, FILTER_VALIDATE_BOOLEAN));

define('DATA_DIR', __DIR__ . '/data');

// Master AES-256 Key for Identity Vault (in production, read from ENV or Secret Manager)
define('AES_KEY', hash('sha256', getenv('HRS_MASTER_KEY') ?: 'HRS_SECRET_VAULT_KEY_2026_HERO_SYSTEM', true));
define('AES_CIPHER', 'aes-256-cbc');

// Data file paths
define('FILE_HEROES',   DATA_DIR . '/heroes.json');
define('FILE_VAULT',    DATA_DIR . '/vault.json');
define('FILE_INCIDENTS', DATA_DIR . '/incidents.json');
define('FILE_AUDIT',    DATA_DIR . '/audit_ledger.json');
define('FILE_SETTINGS', DATA_DIR . '/settings.json');
define('FILE_PENDING',  DATA_DIR . '/pending_updates.json');
defined('FILE_USERS') || define('FILE_USERS', DATA_DIR . '/users.json');

// Threat Tiers: 0 - Cosmic, 1 - Extreme, 2 - High, 3 - Moderate, 4 - Low, 5 - Street
define('THREAT_TIERS', [
    0 => ['code' => 'Tier 0', 'name' => 'Cosmic', 'desc' => 'Reality-altering, existential threat protocol'],
    1 => ['code' => 'Tier 1', 'name' => 'Extreme', 'desc' => 'Global strategic deterrent, continental impact capability'],
    2 => ['code' => 'Tier 2', 'name' => 'High', 'desc' => 'Severe mass-casualty hazard, supervised tactical asset'],
    3 => ['code' => 'Tier 3', 'name' => 'Moderate', 'desc' => 'High-yield kinetic/thermal capabilities, state-level containment'],
    4 => ['code' => 'Tier 4', 'name' => 'Low', 'desc' => 'Superhuman strength, localized energy projection, municipal jurisdiction'],
    5 => ['code' => 'Tier 5', 'name' => 'Street', 'desc' => 'Neighborhood-scale enforcement, localized physical prowess']
]);

// Document storage directory
define('DIR_DOCUMENTS', DATA_DIR . '/documents');

// Hero Registration Workflow Statuses
define('REGISTRATION_STATUSES', [
    'Draft',
    'Submitted',
    'Under Review',
    'Returned for Correction',
    'Verified',
    'Approved',
    'Rejected'
]);

// Document Types
define('DOCUMENT_TYPES_REQUIRED', ['Official ID', 'Hero Certification']);
define('DOCUMENT_TYPES_OPTIONAL', ['Training Certificate', 'Authorization Document', 'Other Supporting Documents']);

// Power Classifications
define('POWER_TYPES', ['Kinetic', 'Thermal', 'Arcane', 'Psionic', 'Cybernetic', 'Bio-enhancement', 'Electromagnetic']);

// Municipal Sectors
define('MUNICIPAL_SECTORS', [
    'Sector 1 - Metro Downtown',
    'Sector 2 - Industrial District',
    'Sector 3 - Suburbs North',
    'Sector 4 - Coastal Wharf',
    'Sector 5 - High-Tech Valley'
]);

// Third-Party Tactical Integrations
define('OPENWEATHER_API_KEY', getenv('OPENWEATHER_API_KEY') ?: '');
define('OPENWEATHER_BACKUP_KEY', getenv('OPENWEATHER_BACKUP_KEY') ?: '');

