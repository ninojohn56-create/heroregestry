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
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
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

// Threat Tiers: Solo Leveling Hunter Ranks (S-Rank, A-Rank, B-Rank, C-Rank, D-Rank, E-Rank, National)
define('THREAT_TIERS', [
    0 => ['code' => 'National', 'name' => 'National-Level Hunter', 'desc' => 'Supreme authority, Calamity Gate subjugator'],
    1 => ['code' => 'S-Rank',   'name' => 'S-Rank Hunter',         'desc' => 'National strategic deterrent, Red Gate & Calamity raid commander'],
    2 => ['code' => 'A-Rank',   'name' => 'A-Rank Hunter',         'desc' => 'High-tier strike team leader, high-difficulty Gate subjugator'],
    3 => ['code' => 'B-Rank',   'name' => 'B-Rank Hunter',         'desc' => 'Elite raid party combatant, mid-to-high Gate specialist'],
    4 => ['code' => 'C-Rank',   'name' => 'C-Rank Hunter',         'desc' => 'Standard dungeon raid combatant, municipal security'],
    5 => ['code' => 'D-Rank',   'name' => 'D-Rank Hunter',         'desc' => 'Low-level dungeon clearer, basic resource harvesting'],
    6 => ['code' => 'E-Rank',   'name' => 'E-Rank Hunter',         'desc' => 'Lowest Awakened tier, support and perimeter duties']
]);

// Document storage directory
define('DIR_DOCUMENTS', DATA_DIR . '/documents');

require_once __DIR__ . '/workflow.php';

// Hero Registration Workflow Statuses
define('REGISTRATION_STATUSES', [
    'Draft',
    'Submitted',
    'Under Review',
    'Returned for Correction',
    'Verified',
    'Approved',
    'Licensed',
    'Suspended',
    'Rejected',
    'Revoked'
]);

// Document Types
define('DOCUMENT_TYPES_REQUIRED', ['Official ID']);
define('DOCUMENT_TYPES_OPTIONAL', ['Hero Certification', 'Training Certificate', 'Authorization Document', 'Guild Affiliation Record', 'Other Supporting Documents']);

// Hunter Combat Class & Power Specialization
define('POWER_TYPES', [
    'Fighter',
    'Mage',
    'Tank',
    'Assassin',
    'Ranger',
    'Healer',
    'Enhanced Strength',
    'Technomancy',
    'Energy Projection'
]);

// Municipal Sectors — San Francisco, Agusan del Sur Jurisdiction
define('MUNICIPAL_SECTORS', [
    'Sector 1 - Poblacion Central Commercial Grid',
    'Sector 2 - Hubang Highway & Logistics Corridor',
    'Sector 3 - Karaos & Borbon Uplands District',
    'Sector 4 - Bitan-agan & Lapinigan River Basin',
    'Sector 5 - Caimpugan Peatland Sanctuary & Marsh Shield'
]);

// Third-Party Tactical Integrations
define('OPENWEATHER_API_KEY', getenv('OPENWEATHER_API_KEY') ?: '');
define('OPENWEATHER_BACKUP_KEY', getenv('OPENWEATHER_BACKUP_KEY') ?: '');

