<?php
declare(strict_types=1);

/**
 * Global Hero Registration Authority Management System (GHRMS)
 * System Readiness, Security Clearance & Deployment Diagnostics Utility
 *
 * Usage:
 *   CLI: php check_system.php [--json] [--fix]
 */

define('HRS_CLI_CHECK', true);
require_once __DIR__ . '/backend/config.php';
require_once __DIR__ . '/backend/storage.php';
require_once __DIR__ . '/backend/crypto.php';

$isCli = (php_sapi_name() === 'cli');
$asJson = in_array('--json', $argv ?? [], true);
$autoFix = in_array('--fix', $argv ?? [], true);

$checks = [];
$criticalErrors = 0;
$warnings = 0;

function addCheck(string $category, string $name, bool $passed, string $message, bool $isWarning = false): void {
    global $checks, $criticalErrors, $warnings;
    $status = $passed ? 'PASS' : ($isWarning ? 'WARN' : 'FAIL');
    if (!$passed) {
        if ($isWarning) {
            $warnings++;
        } else {
            $criticalErrors++;
        }
    }
    $checks[] = [
        'category' => $category,
        'name' => $name,
        'status' => $status,
        'passed' => $passed,
        'is_warning' => $isWarning,
        'message' => $message
    ];
}

// 1. PHP Engine Check
$phpVersion = PHP_VERSION;
$phpPass = version_compare($phpVersion, '8.2.0', '>=');
addCheck(
    'Runtime Environment',
    'PHP Version (>= 8.2)',
    $phpPass,
    $phpPass ? "Active PHP {$phpVersion}" : "PHP 8.2+ required, current is {$phpVersion}"
);

// 2. Extensions Check
$requiredExtensions = [
    'openssl'  => 'AES-256 Vault Encryption & Signatures',
    'mbstring' => 'Multibyte String Processing & UTF-8 Sanitization',
    'curl'     => 'Tactical GIS & Weather Feed API Integration',
    'fileinfo' => 'Biometric ID & Avatar MIME Verification',
    'json'     => 'Atomic Flat-File Datastore Serialization',
    'session'  => 'RBAC Session Management & Clearance Tokens',
    'gd'       => 'Biometric Photo & Badge Rendering'
];

foreach ($requiredExtensions as $ext => $purpose) {
    $loaded = extension_loaded($ext);
    addCheck('Extensions', "Extension: {$ext}", $loaded, $loaded ? "Loaded ({$purpose})" : "MISSING: {$purpose}");
}

// 3. Storage & Directory Write Permissions
$requiredDirs = [
    HRS_ROOT . '/backend/data' => 'Datastore Persistence Root',
    HRS_ROOT . '/backend/data/documents' => 'Encrypted Hero Credentials & Diplomas',
    HRS_ROOT . '/backend/data/ratelimit' => 'Sliding-Window Rate Limiter Buckets',
    HRS_ROOT . '/frontend/uploads/avatars' => 'Operative Facial Biometrics'
];

foreach ($requiredDirs as $dir => $label) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $exists = is_dir($dir);
    $writable = $exists && is_writable($dir);
    addCheck(
        'Storage Permissions',
        basename($dir) . ' (' . $label . ')',
        $writable,
        $writable ? "Directory writable: {$dir}" : ($exists ? "Directory exists but NOT writable: {$dir}" : "Directory MISSING: {$dir}")
    );
}

// 4. Datastore Integrity Check
$dataFiles = [
    FILE_HEROES   => 'Operative Directory & Classified Specs',
    FILE_VAULT    => 'AES-256 Encrypted Civilian Bio-Identities',
    FILE_USERS    => 'RBAC User Credentials & Bcrypt Hashes',
    FILE_AUDIT    => 'Cryptographic SHA-256 Chained Audit Ledger',
    FILE_INCIDENTS => 'Metahuman Threat & Incident Records',
    FILE_SETTINGS => 'System Clearance Parameters & Sector Config'
];

foreach ($dataFiles as $filePath => $desc) {
    $fileName = basename($filePath);
    if (!file_exists($filePath)) {
        addCheck('Datastores', "Datastore: {$fileName}", false, "Missing file ({$desc})");
        continue;
    }
    $content = @file_get_contents($filePath);
    $json = json_decode($content ?: '', true);
    $validJson = is_array($json);
    addCheck(
        'Datastores',
        "Datastore: {$fileName}",
        $validJson,
        $validJson ? "Valid JSON (" . count($json) . " records)" : "CORRUPT JSON content in {$fileName}"
    );
}

// 5. Cryptographic Subsystem Check
try {
    $masterKey = getenv('HRS_MASTER_KEY') ?: 'HRS_SECRET_VAULT_KEY_2026_HERO_SYSTEM';
    $keyLength = strlen($masterKey);
    $keyStrong = $keyLength >= 32;
    addCheck(
        'Cryptography',
        'Master Vault Key Entropy (>= 32 chars)',
        $keyStrong,
        $keyStrong ? "Key Length: {$keyLength} chars" : "Weak Master Key ({$keyLength} chars). Recommend 32+ random characters.",
        !$keyStrong
    );

    // Test AES-256-CBC Encryption & Decryption
    $sampleCivilianData = [
        'legal_name' => 'Diagnostic Probe',
        'safehouse'  => 'Sub-level 7 Bunker',
        'biometric'  => 'DNA-DIAG-001'
    ];
    $encryptedVault = CryptoService::encryptVault($sampleCivilianData);
    $vaultId = $encryptedVault['vault_id'];
    $decryptedVault = CryptoService::decryptVault($vaultId);
    $aesMatch = ($decryptedVault === $sampleCivilianData);

    // Clean up diagnostic probe record from vault
    JsonStorage::transaction(FILE_VAULT, function (&$vault) use ($vaultId) {
        unset($vault[$vaultId]);
        return true;
    });

    addCheck(
        'Cryptography',
        'AES-256-CBC Vault Encrypt/Decrypt Roundtrip',
        $aesMatch,
        $aesMatch ? 'Encryption roundtrip verified with isolated IV' : 'AES-256-CBC roundtrip mismatch'
    );

    // Verify Audit Ledger Chain
    $auditResult = CryptoService::verifyAuditChain();
    $auditChainOk = !empty($auditResult['valid']);
    addCheck(
        'Cryptography',
        'SHA-256 Chained Audit Ledger Integrity',
        $auditChainOk,
        $auditChainOk
            ? "Chained ledger verified ({$auditResult['total_verified']} blocks tamper-free)"
            : "CORRUPT: Audit ledger hash chain broken at index " . ($auditResult['broken_index'] ?? 'unknown') . " (" . ($auditResult['reason'] ?? '') . ")"
    );
} catch (Throwable $e) {
    addCheck('Cryptography', 'Cryptographic Engine Exception', false, "Error: " . $e->getMessage());
}

// 6. Network & Web Server Port Check
$port = (int)(getenv('PORT') ?: 8000);
$socket = @fsockopen('127.0.0.1', $port, $errNo, $errStr, 0.5);
$portInUse = is_resource($socket);
if ($portInUse) {
    fclose($socket);
}
addCheck(
    'Network Service',
    "Port Availability (Port {$port})",
    true,
    $portInUse ? "Port {$port} is actively LISTENING (server is running)" : "Port {$port} is FREE (ready to bind server)",
    false
);

// Format & Display Result
if ($asJson || !$isCli) {
    if (!$isCli) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode([
        'system' => 'Global Hero Registration Authority Management System (GHRMS)',
        'timestamp' => date('c'),
        'healthy' => ($criticalErrors === 0),
        'critical_errors' => $criticalErrors,
        'warnings' => $warnings,
        'checks' => $checks
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit($criticalErrors === 0 ? 0 : 1);
}

// Rich ANSI Terminal Formatter
$cReset  = "\033[0m";
$cBold   = "\033[1m";
$cRed    = "\033[31m";
$cGreen  = "\033[32m";
$cYellow = "\033[33m";
$cCyan   = "\033[36m";
$cGray   = "\033[90m";

echo "\n" . $cBold . $cCyan . "================================================================================" . $cReset . "\n";
echo $cBold . "   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // SYSTEM DIAGNOSTIC AUDIT" . $cReset . "\n";
echo $cBold . $cCyan . "================================================================================" . $cReset . "\n";
echo "Timestamp: " . date('Y-m-d H:i:s T') . " | Environment: " . APP_ENV . "\n\n";

$currentCategory = '';
foreach ($checks as $chk) {
    if ($chk['category'] !== $currentCategory) {
        $currentCategory = $chk['category'];
        echo $cBold . $cYellow . "--- [ {$currentCategory} ] ---" . $cReset . "\n";
    }

    if ($chk['status'] === 'PASS') {
        $badge = $cGreen . "[ PASS ]" . $cReset;
    } elseif ($chk['status'] === 'WARN') {
        $badge = $cYellow . "[ WARN ]" . $cReset;
    } else {
        $badge = $cRed . "[ FAIL ]" . $cReset;
    }

    $name = str_pad($chk['name'], 44);
    echo "  {$badge} {$name} " . $cGray . "{$chk['message']}" . $cReset . "\n";
}

echo "\n" . $cBold . $cCyan . "--------------------------------------------------------------------------------" . $cReset . "\n";
echo "DIAGNOSTIC SCORECARD: ";
if ($criticalErrors === 0 && $warnings === 0) {
    echo $cBold . $cGreen . "ALL SYSTEMS OPERATIONAL (100% READY FOR SERVICE)" . $cReset . "\n";
} elseif ($criticalErrors === 0) {
    echo $cBold . $cYellow . "SYSTEM OPERATIONAL WITH {$warnings} NON-BLOCKING WARNING(S)" . $cReset . "\n";
} else {
    echo $cBold . $cRed . "SYSTEM CRITICAL: {$criticalErrors} BLOCKING ERROR(S) DETECTED" . $cReset . "\n";
}
echo $cBold . $cCyan . "================================================================================" . $cReset . "\n\n";

exit($criticalErrors === 0 ? 0 : 1);
