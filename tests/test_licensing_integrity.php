<?php
// Test Suite: Licensing Integrity, Checkpoints & Status Hardening
$baseUrl = 'http://127.0.0.1:8000';
$cookieJar = tempnam(sys_get_temp_dir(), 'lic_test_');

function httpGet($url, $cookieJar = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    if ($cookieJar) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    }
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $code, 'data' => json_decode($res, true), 'body' => $res];
}

function httpPost($url, $payload, $cookieJar = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    if ($cookieJar) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    }
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $code, 'data' => json_decode($res, true), 'body' => $res];
}

echo "==========================================================\n";
echo "GHRMS LICENSING & CHECKPOINT INTEGRITY VERIFICATION:\n";
echo "==========================================================\n";

$passed = 0;
$total = 0;

function check($desc, $cond) {
    global $passed, $total;
    $total++;
    if ($cond) {
        $passed++;
        echo " [PASS] $desc\n";
    } else {
        echo " [FAIL] $desc\n";
    }
}

// 0. Authenticate as Super Admin / Registrar
$loginRes = httpPost($baseUrl . '/api/auth/login', [
    'username' => 'commander',
    'password' => 'admin123'
], $cookieJar);
check("Super Admin authentication succeeds", ($loginRes['status'] ?? 0) === 200);

// 1. Badge Token Endpoint Checks
$apexToken = httpGet($baseUrl . '/api/heroes/hero_apex_01/badge-token', $cookieJar);
check("Approved hero (APEX) badge token returns is_licensed=true", ($apexToken['data']['data']['is_licensed'] ?? null) === true);
check("Approved hero token_type is FIELD_DEPLOYMENT", ($apexToken['data']['data']['token_type'] ?? null) === 'FIELD_DEPLOYMENT');

$luminaToken = httpGet($baseUrl . '/api/heroes/hero_lumina_02/badge-token', $cookieJar);
check("Unapproved hero (LUMINA) badge token returns is_licensed=false", ($luminaToken['data']['data']['is_licensed'] ?? null) === false);
check("Unapproved hero token_type is PROVISIONAL_INTAKE", ($luminaToken['data']['data']['token_type'] ?? null) === 'PROVISIONAL_INTAKE');

$specterToken = httpGet($baseUrl . '/api/heroes/hero_specter_06/badge-token', $cookieJar);
check("Rogue hero (SPECTER ZERO) badge token returns is_revoked=true", ($specterToken['data']['data']['is_revoked'] ?? null) === true);
check("Rogue hero token_type is REVOKED_VOID", ($specterToken['data']['data']['token_type'] ?? null) === 'REVOKED_VOID');

// 2. Verify Badge Endpoint Checks
if (!empty($apexToken['data']['data']['token'])) {
    $verifyApex = httpPost($baseUrl . '/api/verify-badge', [
        'hero_id' => 'hero_apex_01',
        'token' => $apexToken['data']['data']['token']
    ], $cookieJar);
    check("Verify badge for approved hero is valid=true and is_licensed=true", ($verifyApex['data']['valid'] ?? null) === true && ($verifyApex['data']['is_licensed'] ?? null) === true);
}

if (!empty($luminaToken['data']['data']['token'])) {
    $verifyLumina = httpPost($baseUrl . '/api/verify-badge', [
        'hero_id' => 'hero_lumina_02',
        'token' => $luminaToken['data']['data']['token']
    ], $cookieJar);
    check("Verify badge for unapproved hero returns is_licensed=false (Provisional only)", ($verifyLumina['data']['is_licensed'] ?? null) === false);
    check("Verify badge for unapproved hero does not grant field validity", ($verifyLumina['data']['valid'] ?? null) === false);
}

$verifySpecter = httpPost($baseUrl . '/api/verify-badge', [
    'hero_id' => 'hero_specter_06',
    'token' => '123456'
], $cookieJar);
check("Verify badge for rogue hero returns ROGUE_ALERT", ($verifySpecter['data']['status'] ?? null) === 'ROGUE_ALERT');

// 3. Sentinel Scan Endpoint Checks
$scanApex = httpPost($baseUrl . '/api/sentinel/scan', [
    'qr_input' => 'GHRMS://HERO/9GH-8430'
], $cookieJar);
check("Sentinel scan on approved hero marks is_licensed=true", ($scanApex['data']['data']['is_licensed'] ?? null) === true);
check("Sentinel scan on approved hero marks is_rogue=false", ($scanApex['data']['data']['is_rogue'] ?? null) === false);

$scanLumina = httpPost($baseUrl . '/api/sentinel/scan', [
    'qr_input' => 'GHRMS://HERO/hero_lumina_02'
], $cookieJar);
check("Sentinel scan on unapproved hero marks is_licensed=false (Provisional intake)", ($scanLumina['data']['data']['is_licensed'] ?? null) === false);
check("Sentinel scan on unapproved hero is recognized by intake ID", ($scanLumina['data']['data']['alias'] ?? null) === 'LUMINA');

$scanSpecter = httpPost($baseUrl . '/api/sentinel/scan', [
    'qr_input' => 'GHRMS://HERO/hero_specter_06'
], $cookieJar);
check("Sentinel scan on rogue hero marks is_rogue=true", ($scanSpecter['data']['data']['is_rogue'] ?? null) === true);
check("Sentinel scan on rogue hero provides containment directive", !empty($scanSpecter['data']['data']['containment_directive']));

// 4. Data File Accreditation Verification
$heroes = json_decode(file_get_contents(__DIR__ . '/../backend/data/heroes.json'), true);
$unapprovedWithLicense = 0;
foreach ($heroes as $id => $h) {
    $status = strtolower($h['status'] ?? '');
    if (!in_array($status, ['approved', 'licensed', 'rogue', 'revoked']) && !empty($h['license_number'])) {
        $unapprovedWithLicense++;
    }
}
check("Zero unapproved heroes have accredited license numbers fabricated", $unapprovedWithLicense === 0);

@unlink($cookieJar);

echo "==========================================================\n";
echo "SUMMARY: $passed / $total CHECKS PASSED\n";
echo "==========================================================\n";
exit($passed === $total ? 0 : 1);
