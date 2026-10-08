<?php
declare(strict_types=1);

$baseUrl = 'http://127.0.0.1:8000';
$cookieFile = sys_get_temp_dir() . '/ghrms_test_cookie_' . uniqid() . '.txt';

function httpReq(string $url, array $options = []): array {
    global $cookieFile;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    if (!empty($options['post'])) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($options['post']));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);
    return ['status' => $status, 'body' => (string)$body, 'url' => $effectiveUrl];
}

$checks = [];

// 1. Check disk files directly
$regDisk = file_get_contents(__DIR__ . '/../frontend/registrar.html');
$checks['disk_registrar_step1_evidence'] = strpos($regDisk, 'id="regDocsSection"') !== false;
$checks['disk_registrar_step2_identity'] = strpos($regDisk, 'id="regIdentitySection"') !== false;
$checks['disk_registrar_step3_licensing'] = strpos($regDisk, 'id="regLicensingSection"') !== false;
$checks['disk_registrar_btn_verify_identity'] = strpos($regDisk, 'id="btnVerifyOperativeIdentity"') !== false;
$checks['disk_registrar_modal_doc_verify'] = strpos($regDisk, 'id="docVerifyModal"') !== false;
$checks['disk_registrar_modal_doc_reject'] = strpos($regDisk, 'id="docRejectModal"') !== false;
$checks['disk_registrar_modal_identity'] = strpos($regDisk, 'id="identityVerifyModal"') !== false;
$checks['disk_registrar_nav_badge_token'] = strpos($regDisk, 'AUTHENTICATE BADGE TOKEN') !== false;

$registryDisk = file_get_contents(__DIR__ . '/../frontend/registry.html');
$checks['disk_registry_header_btn'] = strpos($registryDisk, 'AUTHENTICATE BADGE TOKEN') !== false;
$checks['disk_registry_card_btn'] = strpos($registryDisk, 'AUTHENTICATE BADGE') !== false;
$checks['disk_registry_modal_title'] = strpos($registryDisk, 'ANTI-SPOOF FIELD BADGE TOKEN AUTHENTICATOR') !== false;
$checks['disk_registry_modal_submit'] = strpos($registryDisk, 'AUTHENTICATE 6-DIGIT TOKEN') !== false;

$adminDisk = file_get_contents(__DIR__ . '/../frontend/admin.html');
$checks['disk_admin_badge_submit'] = strpos($adminDisk, 'Authenticate 6-Digit Badge Token') !== false;

// 2. Check JS files
$regJs = file_get_contents(__DIR__ . '/../frontend/js/registrar.js');
$checks['js_registrar_openDocVerifyModal'] = strpos($regJs, 'function openDocVerifyModal') !== false;
$checks['js_registrar_openIdentityVerifyModal'] = strpos($regJs, 'function openIdentityVerifyModal') !== false;
$checks['js_registrar_updateDetailsPanel'] = strpos($regJs, 'function updateDetailsPanel') !== false;

$adminJs = file_get_contents(__DIR__ . '/../frontend/js/admin.js');
$checks['js_admin_certify_doc'] = strpos($adminJs, '[✓ CERTIFY DOC]') !== false;
$checks['js_admin_verify_identity'] = strpos($adminJs, '[✓ VERIFY OPERATIVE IDENTITY & ACCORDS]') !== false;
$checks['js_admin_licensing_locked'] = strpos($adminJs, '[LICENSING LOCKED — IDENTITY VERIFICATION REQUIRED]') !== false;
$checks['js_admin_issue_license'] = strpos($adminJs, '[★ APPROVE REGISTRATION & ISSUE LICENSE]') !== false;

// 3. Authenticated HTTP checks
$loginRes = httpReq($baseUrl . '/api/auth/login', [
    'post' => ['username' => 'sarah.chen', 'password' => 'registrar123']
]);
$checks['http_login_registrar'] = ($loginRes['status'] === 200);

$httpRegistrar = httpReq($baseUrl . '/registrar');
$checks['http_registrar_step1_evidence'] = strpos($httpRegistrar['body'], 'id="regDocsSection"') !== false;
$checks['http_registrar_step2_identity'] = strpos($httpRegistrar['body'], 'id="regIdentitySection"') !== false;
$checks['http_registrar_step3_licensing'] = strpos($httpRegistrar['body'], 'id="regLicensingSection"') !== false;
$checks['http_registrar_btn_verify_identity'] = strpos($httpRegistrar['body'], 'id="btnVerifyOperativeIdentity"') !== false;

$httpRegistry = httpReq($baseUrl . '/registry');
$checks['http_registry_authenticate_badge'] = strpos($httpRegistry['body'], 'AUTHENTICATE BADGE TOKEN') !== false;
$checks['http_registry_modal_title'] = strpos($httpRegistry['body'], 'ANTI-SPOOF FIELD BADGE TOKEN AUTHENTICATOR') !== false;

// Login as super admin for admin page check
$superLoginRes = httpReq($baseUrl . '/api/auth/login', [
    'post' => ['username' => 'commander', 'password' => 'admin123']
]);
$checks['http_login_super_admin'] = ($superLoginRes['status'] === 200);

$httpAdmin = httpReq($baseUrl . '/admin');
$checks['http_admin_badge_submit'] = strpos($httpAdmin['body'], 'Authenticate 6-Digit Badge Token') !== false;

// 4. Test identity verification and license approval
$heroesFile = __DIR__ . '/../backend/data/heroes.json';
if (file_exists($heroesFile)) {
    $heroesData = json_decode(file_get_contents($heroesFile), true);
    if (is_array($heroesData)) {
        foreach ($heroesData as &$h) {
            if (($h['id'] ?? '') === 'hero_apex_01') {
                $h['status'] = 'Submitted';
                $h['license_status'] = 'Pending';
                break;
            }
        }
        file_put_contents($heroesFile, json_encode($heroesData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}

foreach (['doc_hero_apex_01_id', 'doc_hero_apex_01_cert'] as $docId) {
    httpReq($baseUrl . "/api/heroes/hero_apex_01/documents/{$docId}/verify", [
        'post' => ['status' => 'Verified', 'notes' => 'Verified in automated pipeline test']
    ]);
}

$verifyRes = httpReq($baseUrl . '/api/heroes/hero_apex_01/assess', [
    'post' => ['action' => 'VERIFY_IDENTITY', 'notes' => 'Certifying identity directly from Submitted state']
]);
$checks['verify_identity_from_submitted_status'] = ($verifyRes['status'] === 200);

$approveRes = httpReq($baseUrl . '/api/heroes/hero_apex_01/assess', [
    'post' => ['action' => 'APPROVE_LICENSE']
]);
$checks['approve_license_from_verified_status'] = ($approveRes['status'] === 200);

if (file_exists($cookieFile)) {
    unlink($cookieFile);
}

echo "==========================================================" . PHP_EOL;
echo "VERIFICATION BUTTONS & PIPELINE CHECK RESULTS:" . PHP_EOL;
echo "==========================================================" . PHP_EOL;

$allPassed = true;
foreach ($checks as $name => $passed) {
    echo sprintf("[%s] %s\n", $passed ? 'PASS' : 'FAIL', $name);
    if (!$passed) $allPassed = false;
}

echo "==========================================================" . PHP_EOL;
if ($allPassed) {
    echo "ALL " . count($checks) . " CHECKS PASSED PERFECTLY!" . PHP_EOL;
} else {
    echo "SOME CHECKS FAILED!" . PHP_EOL;
    exit(1);
}
