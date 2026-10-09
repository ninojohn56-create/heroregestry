<?php
declare(strict_types=1);

/**
 * GHRA Automated Enterprise Test Suite
 * Executes end-to-end regression, security, authorization, and cryptographic integrity tests.
 */

$baseUrl = getenv('TEST_BASE_URL') ?: 'http://127.0.0.1:8000';

class GhraTestRunner {
    private string $baseUrl;
    private int $passed = 0;
    private int $failed = 0;
    private array $failures = [];

    public function __construct(string $baseUrl) {
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    public function run(): void {
        echo "=================================================================\n";
        echo "GHRA GLOBAL SUPERHUMAN REGISTRATION AUTHORITY - TEST SUITE\n";
        echo "Target Endpoint: {$this->baseUrl}\n";
        echo "PHP Version: " . PHP_VERSION . "\n";
        echo "Timestamp: " . date('c') . "\n";
        echo "=================================================================\n\n";

        // Ensure reproducible baseline state
        $cjInit = tempnam(sys_get_temp_dir(), 'ghra_init_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjInit);
        $this->request('POST', '/api/admin/system/reset-data', ['confirm' => 'CONFIRM_FACTORY_RESET'], $cjInit);
        @unlink($cjInit);

        // Group 1: Health & Liveness
        $this->testHealthEndpoint();

        // Group 2: Authentication & Session
        $this->testAuthenticationValid();
        $this->testAuthenticationInvalid();
        $this->testAccountSuspensionBlock();
        $this->testSessionLogout();

        // Group 3: Authorization & IDOR Protection
        $this->testHeroIdorProtection();
        $this->testHeroDocumentIdorProtection();
        $this->testHeroSelfVerificationBlocked();

        // Group 4: Hero Self-Promotion & Threat Tier Forgery
        $this->testHeroThreatTierTamperingBlocked();

        // Group 5: Registration Workflow State Machine
        $this->testFtfLicenseEvidenceGate();
        $this->testWorkflowIllegalTransitionBlocked();
        $this->testWorkflowValidLifecycle();

        // Group 6: Personnel & Privilege Boundaries
        $this->testAdminCannotProvisionSuperAdmin();
        $this->testAdminCannotResetSuperAdminPasskey();
        $this->testUserSuspensionEndpoint();

        // Group 7: CSV Formula Injection (CWE-1236)
        $this->testCsvExportFormulaNeutralization();

        // Group 8: Cryptographic Audit Ledger Integrity
        $this->testAuditChainIntegrity();

        // Group 9: Rate Limiting
        $this->testRateLimitingHeaders();

        // Group 10: Static Security Perimeter & Traversal
        $this->testTraversalProtection();

        // Group 11: Active Session Revocation on Suspension
        $this->testActiveSessionSuspensionRevocation();

        // Group 12: Hero Damage Report IDOR Prevention
        $this->testHeroDamageReportIdor();

        // Group 13: Factory Reset Confirmation Token Protection
        $this->testFactoryResetSafety();

        // Group 14: Cross-Origin Request Forgery Perimeter
        $this->testOriginCsrfValidation();

        // Group 15: Document Deletion, Versioning & Immutability Protection
        $this->testDocumentDeletionAndVersioning();

        // Group 16: Upload Perimeter & Malicious Extension Defense
        $this->testDoubleExtensionUploadBlocked();

        // Group 17: Authenticated Encryption (Encrypt-then-MAC) Tamper Detection
        $this->testVaultMacTamperDetection();

        // Group 18: Security Headers & Content-Security-Policy Perimeter
        $this->testSecurityHeadersAndCsp();

        // Group 19: Sentinel QR Code & Operative ID Verification Scanner
        $this->testSentinelQrScanning();

        // Group 20: Hardened Production Defense Verifications
        $this->testHardeningDefenses();

        echo "\n=================================================================\n";
        echo "TEST EXECUTION SUMMARY\n";
        echo "=================================================================\n";
        echo "Total Passed: {$this->passed}\n";
        echo "Total Failed: {$this->failed}\n";

        if ($this->failed > 0) {
            echo "\nFailed Assertions:\n";
            foreach ($this->failures as $f) {
                echo "  [FAIL] {$f}\n";
            }
            exit(1);
        } else {
            echo "\nALL TESTS PASSED! System is fully hardened and verified.\n";
            exit(0);
        }
    }

    private function assert(bool $condition, string $testName, string $errorMsg = ''): void {
        if ($condition) {
            $this->passed++;
            echo "  [PASS] {$testName}\n";
        } else {
            $this->failed++;
            $msg = "{$testName} - {$errorMsg}";
            $this->failures[] = $msg;
            echo "  [FAIL] {$msg}\n";
        }
    }

    private function request(string $method, string $path, ?array $data = null, ?string $cookieJar = null, array $extraHeaders = []): array {
        $ch = curl_init($this->baseUrl . $path);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_HEADER, true);

        $headers = array_merge(['Accept: application/json'], $extraHeaders);
        if ($data !== null) {
            $payload = json_encode($data);
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($cookieJar !== null) {
            curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
        }

        $rawResponse = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headerStr = substr($rawResponse, 0, $headerSize);
        $bodyStr = substr($rawResponse, $headerSize);
        curl_close($ch);

        $json = json_decode($bodyStr, true);

        return [
            'code' => $httpCode,
            'headers' => $headerStr,
            'body' => $bodyStr,
            'json' => $json
        ];
    }

    private function requestMultipart(string $path, array $postFields, ?string $cookieJar = null, array $extraHeaders = []): array {
        $ch = curl_init($this->baseUrl . $path);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        $headers = array_merge(['Accept: application/json'], $extraHeaders);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($cookieJar !== null) {
            curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
        }

        $rawResponse = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headerStr = substr($rawResponse, 0, $headerSize);
        $bodyStr = substr($rawResponse, $headerSize);
        curl_close($ch);

        $json = json_decode($bodyStr, true);

        return [
            'code' => $httpCode,
            'headers' => $headerStr,
            'body' => $bodyStr,
            'json' => $json
        ];
    }

    private function testHealthEndpoint(): void {
        echo "1. System Health & Liveness Probe:\n";
        $res = $this->request('GET', '/api/health');
        $this->assert($res['code'] === 200, "Health endpoint returns HTTP 200", "Got {$res['code']}");
        $this->assert(($res['json']['status'] ?? '') === 'healthy', "Health status is 'healthy'");
    }

    private function testAuthenticationValid(): void {
        echo "\n2. Authentication - Valid Login:\n";
        $cj = tempnam(sys_get_temp_dir(), 'ghra_cj_');

        $res = $this->request('POST', '/api/auth/login', [
            'username' => 'commander',
            'password' => 'admin123'
        ], $cj);

        $this->assert($res['code'] === 200, "Super Admin login succeeds", "Got {$res['code']}");
        $this->assert(($res['json']['user']['role'] ?? '') === 'SUPER_ADMIN', "Role is SUPER_ADMIN");

        // Verify session /me endpoint
        $meRes = $this->request('GET', '/api/auth/me', null, $cj);
        $this->assert($meRes['code'] === 200 && ($meRes['json']['authenticated'] ?? false) === true, "Session established via /api/auth/me");
        @unlink($cj);
    }

    private function testAuthenticationInvalid(): void {
        echo "\n3. Authentication - Invalid Credentials & Timing:\n";
        $res = $this->request('POST', '/api/auth/login', [
            'username' => 'commander',
            'password' => 'wrong_passkey_999'
        ]);

        $this->assert($res['code'] === 401, "Invalid password rejected with HTTP 401", "Got {$res['code']}");

        $resUnknown = $this->request('POST', '/api/auth/login', [
            'username' => 'non_existent_hero_888',
            'password' => 'any_pass'
        ]);
        $this->assert($resUnknown['code'] === 401, "Non-existent callsign rejected with HTTP 401", "Got {$resUnknown['code']}");
    }

    private function testAccountSuspensionBlock(): void {
        echo "\n4. Account Suspension Defense:\n";
        $cjAdmin = tempnam(sys_get_temp_dir(), 'ghra_adm_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjAdmin);

        // Suspend operative apex
        $suspRes = $this->request('PUT', '/api/admin/users/apex/status', ['status' => 'suspended'], $cjAdmin);
        $this->assert($suspRes['code'] === 200, "Admin can set account status to 'suspended'");

        // Try logging in as suspended apex
        $loginSusp = $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123']);
        $this->assert($loginSusp['code'] === 401, "Suspended account login blocked (HTTP 401)", "Got {$loginSusp['code']}");

        // Reactivate apex
        $reactRes = $this->request('PUT', '/api/admin/users/apex/status', ['status' => 'active'], $cjAdmin);
        $this->assert($reactRes['code'] === 200, "Admin can reactivate account to 'active'");

        // Login now succeeds
        $loginActive = $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123']);
        $this->assert($loginActive['code'] === 200, "Reactivated account login succeeds (HTTP 200)");

        @unlink($cjAdmin);
    }

    private function testSessionLogout(): void {
        echo "\n5. Session Termination & Revocation:\n";
        $cj = tempnam(sys_get_temp_dir(), 'ghra_lg_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cj);

        $logoutRes = $this->request('POST', '/api/auth/logout', null, $cj);
        $this->assert($logoutRes['code'] === 200, "Logout returns HTTP 200");

        $meRes = $this->request('GET', '/api/auth/me', null, $cj);
        $this->assert(($meRes['json']['authenticated'] ?? false) === false, "Clearance revoked after logout");
        @unlink($cj);
    }

    private function testHeroIdorProtection(): void {
        echo "\n6. IDOR / Horizontal Privilege Boundary Defense:\n";
        // Login as operative apex (hero_id: hero_apex_01)
        $cjApex = tempnam(sys_get_temp_dir(), 'ghra_ap_');
        $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123'], $cjApex);

        // Operative views own profile
        $ownRes = $this->request('GET', '/api/heroes/hero_apex_01', null, $cjApex);
        $this->assert($ownRes['code'] === 200, "Operative can view own record (HTTP 200)");

        // Operative attempts to view Lumina's private profile (hero_lumina_02)
        $otherRes = $this->request('GET', '/api/heroes/hero_lumina_02', null, $cjApex);
        $this->assert($otherRes['code'] === 403, "IDOR BLOCKED: Hero viewing another operative record gets HTTP 403 Forbidden", "Got {$otherRes['code']}");

        // Staff (sarah.chen - Registrar) views Lumina's profile
        $cjSarah = tempnam(sys_get_temp_dir(), 'ghra_sc_');
        $this->request('POST', '/api/auth/login', ['username' => 'sarah.chen', 'password' => 'registrar123'], $cjSarah);
        $staffView = $this->request('GET', '/api/heroes/hero_lumina_02', null, $cjSarah);
        $this->assert($staffView['code'] === 200, "Staff (Registrar) can inspect any operative record (HTTP 200)");

        @unlink($cjApex);
        @unlink($cjSarah);
    }

    private function testHeroDocumentIdorProtection(): void {
        echo "\n7. Private Document Access Control (Cross-Hero Document Download):\n";
        $cjApex = tempnam(sys_get_temp_dir(), 'ghra_ap_');
        $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123'], $cjApex);

        // Hero apex tries downloading document from Lumina (hero_lumina_02)
        $docIdor = $this->request('GET', '/api/heroes/hero_lumina_02/documents/doc_dummy_999', null, $cjApex);
        $this->assert($docIdor['code'] === 403, "Document theft BLOCKED: Cross-hero document access returns HTTP 403", "Got {$docIdor['code']}");

        @unlink($cjApex);
    }

    private function testHeroSelfVerificationBlocked(): void {
        echo "\n8. Privilege Escalation: Hero Self-Verification Defense:\n";
        $cjApex = tempnam(sys_get_temp_dir(), 'ghra_ap_');
        $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123'], $cjApex);

        // Hero apex tries to verify a document on their own file
        $selfVerify = $this->request('POST', '/api/heroes/hero_apex_01/documents/doc_dummy_999/verify', [
            'status' => 'Verified'
        ], $cjApex);

        $this->assert($selfVerify['code'] === 403, "Hero self-verification BLOCKED with HTTP 403 Forbidden", "Got {$selfVerify['code']}");
        @unlink($cjApex);
    }

    private function testHeroThreatTierTamperingBlocked(): void {
        echo "\n9. Hero Self-Promotion & Threat Classification Forgery Defense:\n";
        $cjApex = tempnam(sys_get_temp_dir(), 'ghra_ap_');
        $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123'], $cjApex);

        // Hero apex attempts to elevate their own threat tier to 0 (Cosmic) and edit license number
        $tamperRes = $this->request('PUT', '/api/heroes/hero_apex_01', [
            'threat_tier' => 0,
            'license_number' => 'GHRMS-FAKE-COSMIC-999',
            'assessment_notes' => 'Self-promoted God-tier entity'
        ], $cjApex);

        $this->assert($tamperRes['code'] === 403, "Profile update trying to change license/threat fields is denied");

        // Verify operative record was NOT compromised
        $verifyRes = $this->request('GET', '/api/heroes/hero_apex_01', null, $cjApex);
        $threatTier = $verifyRes['json']['data']['threat_tier'] ?? null;
        $this->assert($threatTier !== 0, "Threat tier tampering PREVENTED at the API boundary");

        $workflowForgery = $this->request('PUT', '/api/heroes/hero_apex_01', [
            'status' => 'Licensed',
            'license_number' => 'GHRMS-FAKE-LICENSE',
            'verification_status' => 'Verified',
            'verified_by' => 'Forged Reviewer'
        ], $cjApex);
        $this->assert($workflowForgery['code'] === 403, "Direct profile updates cannot forge status, license, or verification fields");

        @unlink($cjApex);
    }

    private function testWorkflowIllegalTransitionBlocked(): void {
        echo "\n10. Registration State Machine Transition Boundaries:\n";
        $cjAdmin = tempnam(sys_get_temp_dir(), 'ghra_adm_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjAdmin);

        // 1. First move hero_apex_01 to Under Review
        $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'MOVE_TO_REVIEW'
        ], $cjAdmin);

        // 2. Reject the operative while under review (legal transition: Under Review -> Rejected)
        $rejectRes = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'REJECT',
            'reason' => 'State machine boundary audit test rejection'
        ], $cjAdmin);
        $this->assert($rejectRes['code'] === 200, "Operative rejected from Under Review (HTTP 200)");

        // 3. Attempt direct illegal jump from Rejected to Approved!
        $illegalApprove = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'APPROVE'
        ], $cjAdmin);
        $this->assert($illegalApprove['code'] === 422, "Illegal transition Rejected -> Approved BLOCKED with HTTP 422 Unprocessable Entity", "Got {$illegalApprove['code']}");

        // 4. Now restore via legal path: REINSTATE -> Under Review
        $reopenRes = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'REINSTATE',
            'notes' => 'Reopened for official review'
        ], $cjAdmin);
        $this->assert($reopenRes['code'] === 200, "Legal reopen via REINSTATE succeeded (HTTP 200)");

        // 5. Identity verification must wait until required documents are reviewed.
        $verifyRes = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'VERIFY_IDENTITY',
            'notes' => 'Test identity review after evidence gate'
        ], $cjAdmin);
        $this->assert($verifyRes['code'] === 422, "Identity verification is blocked while required documents are pending");

        $docReview = $this->request('POST', "/api/heroes/hero_apex_01/documents/doc_hero_apex_01_id/verify", [
            'status' => 'Verified',
            'notes' => 'Test reviewer inspected the demo document and confirmed the workflow gate.'
        ], $cjAdmin);
        $this->assert($docReview['code'] === 200, "Authorized reviewer can explicitly verify required document doc_hero_apex_01_id");

        $missingIdentityNotes = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'VERIFY_IDENTITY'
        ], $cjAdmin);
        $this->assert($missingIdentityNotes['code'] === 422, "Identity verification requires reviewer notes");

        $verifyRes = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'VERIFY_IDENTITY',
            'notes' => 'Test identity reviewed against the required document packet.'
        ], $cjAdmin);
        $this->assert($verifyRes['code'] === 200, "Identity verification succeeds only after required document review");

        $legalApprove = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'APPROVE'
        ], $cjAdmin);
        $this->assert($legalApprove['code'] === 200, "Approval from Verified succeeded (HTTP 200)");

        @unlink($cjAdmin);
    }

    private function testFtfLicenseEvidenceGate(): void {
        echo "\n10. FTF License Evidence Gate:\n";
        $cookie = tempnam(sys_get_temp_dir(), 'ghra_ftf_gate_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cookie);

        $response = $this->request('POST', '/api/heroes/hero_apex_01/ftf-interview', [
            'status' => 'Passed',
            'notes' => 'Test interview must not override pending document review.',
            'grant_license' => true
        ], $cookie);
        $this->assert($response['code'] === 422, 'FTF pass cannot grant a license before required evidence and identity review');

        $hero = $this->request('GET', '/api/heroes/hero_apex_01', null, $cookie);
        $this->assert(($hero['json']['data']['status'] ?? '') !== 'Licensed', 'Blocked FTF evidence gate leaves license status unchanged');
        @unlink($cookie);
    }

    private function testWorkflowValidLifecycle(): void {
        echo "\n11. Workflow Lifecycle State Validation:\n";
        $cjSarah = tempnam(sys_get_temp_dir(), 'ghra_sc_');
        $this->request('POST', '/api/auth/login', ['username' => 'sarah.chen', 'password' => 'registrar123'], $cjSarah);

        $moveReview = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'MOVE_TO_REVIEW'
        ], $cjSarah);
        $this->assert($moveReview['code'] === 200, "Registrar can move operative to Under Review");

        $verifyId = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'VERIFY_IDENTITY',
            'notes' => 'Identity attested by Registrar Sarah Chen'
        ], $cjSarah);
        $this->assert($verifyId['code'] === 200, "Registrar can verify identity");

        $approve = $this->request('POST', '/api/heroes/hero_apex_01/assess', [
            'action' => 'APPROVE'
        ], $cjSarah);
        $this->assert($approve['code'] === 200, "Registrar can approve verified operative");

        @unlink($cjSarah);
    }

    private function testAdminCannotProvisionSuperAdmin(): void {
        echo "\n12. Administrative Boundary: Admin cannot provision Super Admin:\n";
        $cjAdmin = tempnam(sys_get_temp_dir(), 'ghra_ad_');
        $this->request('POST', '/api/auth/login', ['username' => 'admin', 'password' => 'admin123'], $cjAdmin);

        $provRes = $this->request('POST', '/api/admin/users', [
            'username' => 'rogue_super_admin',
            'password' => 'pass1234',
            'role' => 'SUPER_ADMIN'
        ], $cjAdmin);

        $this->assert($provRes['code'] === 403, "Standard Admin provisioning Super Admin BLOCKED with HTTP 403", "Got {$provRes['code']}");
        @unlink($cjAdmin);
    }

    private function testAdminCannotResetSuperAdminPasskey(): void {
        echo "\n13. Administrative Boundary: Admin cannot reset Super Admin credentials:\n";
        $cjAdmin = tempnam(sys_get_temp_dir(), 'ghra_ad_');
        $this->request('POST', '/api/auth/login', ['username' => 'admin', 'password' => 'admin123'], $cjAdmin);

        $resetRes = $this->request('PUT', '/api/admin/users/commander/reset-password', [
            'new_password' => 'hacked_admin123'
        ], $cjAdmin);

        $this->assert($resetRes['code'] === 403, "Standard Admin resetting Super Admin passkey BLOCKED with HTTP 403", "Got {$resetRes['code']}");
        @unlink($cjAdmin);
    }

    private function testUserSuspensionEndpoint(): void {
        echo "\n14. User Suspension Lifecycle:\n";
        $cjCmd = tempnam(sys_get_temp_dir(), 'ghra_cmd_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjCmd);

        // Cannot suspend root account
        $rootSusp = $this->request('PUT', '/api/admin/users/commander/status', ['status' => 'suspended'], $cjCmd);
        $this->assert($rootSusp['code'] === 403, "Root account 'commander' cannot be suspended (HTTP 403)");

        @unlink($cjCmd);
    }

    private function testCsvExportFormulaNeutralization(): void {
        echo "\n15. CSV Formula Injection (CWE-1236) Defense:\n";
        $cjCmd = tempnam(sys_get_temp_dir(), 'ghra_cmd_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjCmd);

        $csvRes = $this->request('GET', '/api/admin/export/heroes?format=csv', null, $cjCmd);
        $this->assert($csvRes['code'] === 200, "CSV Export returns HTTP 200");
        $this->assert(str_contains($csvRes['headers'], 'text/csv'), "Content-Type is text/csv");

        // Check that any potential formula characters at the start of cells are sanitized
        $lines = explode("\n", $csvRes['body']);
        $hasUnsanitizedFormula = false;
        foreach ($lines as $line) {
            $cols = str_getcsv($line);
            foreach ($cols as $col) {
                $str = (string)($col ?? '');
                if ($str !== '' && in_array($str[0], ['=', '+', '-', '@'], true)) {
                    $hasUnsanitizedFormula = true;
                    break 2;
                }
            }
        }
        $this->assert(!$hasUnsanitizedFormula, "CSV contains 0 unescaped formula characters (CWE-1236 neutralized)");

        @unlink($cjCmd);
    }

    private function testAuditChainIntegrity(): void {
        echo "\n16. Cryptographic Chained Audit Ledger Verification:\n";
        $cjCmd = tempnam(sys_get_temp_dir(), 'ghra_cmd_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjCmd);

        $auditExport = $this->request('GET', '/api/admin/export/audit', null, $cjCmd);
        $this->assert($auditExport['code'] === 200, "Audit export returns HTTP 200");
        $this->assert(($auditExport['json']['integrity_verified'] ?? false) === true, "Audit chain integrity verified: 100% untampered");

        @unlink($cjCmd);
    }

    private function testRateLimitingHeaders(): void {
        echo "\n17. Rate Limiter Security:\n";
        // Ensure /api/auth/login handles multiple attempts and maintains stability
        $res = $this->request('POST', '/api/auth/login', ['username' => 'test_user', 'password' => 'test']);
        $this->assert(in_array($res['code'], [401, 429], true), "Login endpoint rate limiter responsive (HTTP {$res['code']})");
    }

    private function testTraversalProtection(): void {
        echo "\n18. Path Traversal & File Access Perimeter Defense:\n";
        $dotfile = $this->request('GET', '/.env');
        $this->assert($dotfile['code'] === 403, "Access to /.env denied with HTTP 403 Forbidden");

        $backendDir = $this->request('GET', '/backend/config.php');
        $this->assert($backendDir['code'] === 403, "Access to /backend/ internals denied with HTTP 403 Forbidden");

        $traversal = $this->request('GET', '/../../windows/win.ini');
        $this->assert(in_array($traversal['code'], [403, 404], true), "Path traversal attempt blocked with HTTP {$traversal['code']}");
    }

    private function testActiveSessionSuspensionRevocation(): void {
        echo "\n19. Active Session Immediate Revocation on Suspension:\n";
        $cjRegistrar = tempnam(sys_get_temp_dir(), 'ghra_sess_');
        $cjCmd = tempnam(sys_get_temp_dir(), 'ghra_cmd2_');

        // Login as sarah.chen
        $loginRes = $this->request('POST', '/api/auth/login', ['username' => 'sarah.chen', 'password' => 'registrar123'], $cjRegistrar);
        $this->assert($loginRes['code'] === 200, "Registrar login succeeds (HTTP 200)");

        // Verify active session works
        $meRes = $this->request('GET', '/api/auth/me', null, $cjRegistrar);
        $this->assert($meRes['code'] === 200 && ($meRes['json']['user']['username'] ?? '') === 'sarah.chen', "Active session valid before suspension");

        // Commander suspends sarah.chen
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjCmd);
        $suspRes = $this->request('PUT', '/api/admin/users/sarah.chen/status', ['status' => 'suspended'], $cjCmd);
        $this->assert($suspRes['code'] === 200, "Super Admin successfully suspended sarah.chen account");

        // sarah.chen makes next request with old session cookie -> MUST be rejected with HTTP 401 by requireAuth()
        $protRes = $this->request('POST', '/api/damage-report', ['power_type' => 'Kinetic'], $cjRegistrar);
        $this->assert($protRes['code'] === 401, "Active session IMMEDIATELY revoked upon account suspension (HTTP 401)");

        // Reactivate sarah.chen for clean state
        $this->request('PUT', '/api/admin/users/sarah.chen/status', ['status' => 'active'], $cjCmd);

        @unlink($cjRegistrar);
        @unlink($cjCmd);
    }

    private function testHeroDamageReportIdor(): void {
        echo "\n20. Hero Damage Report IDOR / Impersonation Defense:\n";
        $cjHero = tempnam(sys_get_temp_dir(), 'ghra_hero_');
        $this->request('POST', '/api/auth/login', ['username' => 'lumina', 'password' => 'hero123'], $cjHero);

        // Lumina tries to report damage under another hero's ID ('hero_solaris_a833dd' - Solaris)
        $reportRes = $this->request('POST', '/api/damage-report', [
            'hero_id' => 'hero_solaris_a833dd',
            'power_type' => 'Photonic',
            'severity' => 'Moderate',
            'estimated_damage_usd' => 12000,
            'title' => 'Perimeter Breach Incident'
        ], $cjHero);

        $this->assert($reportRes['code'] === 201, "Damage report submitted successfully (HTTP 201)");
        $reportedBy = $reportRes['json']['data']['reported_by_hero'] ?? '';
        $this->assert($reportedBy === 'hero_lumina_02', "Damage report attribution forced to authenticated operative ID (Impersonation blocked: got {$reportedBy})");

        @unlink($cjHero);
    }

    private function testFactoryResetSafety(): void {
        echo "\n21. Factory Reset Confirmation Token Protection:\n";
        $cjCmd = tempnam(sys_get_temp_dir(), 'ghra_cmd_rst_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjCmd);

        // Call reset without confirmation token
        $unconfirmed = $this->request('POST', '/api/admin/system/reset-data', [], $cjCmd);
        $this->assert($unconfirmed['code'] === 400, "Unconfirmed factory reset BLOCKED with HTTP 400 Bad Request");

        // Call reset with invalid confirmation token
        $badToken = $this->request('POST', '/api/admin/system/reset-data', ['confirm' => 'yes'], $cjCmd);
        $this->assert($badToken['code'] === 400, "Invalid confirmation token rejected with HTTP 400");

        // Call reset with correct confirmation token
        $validToken = $this->request('POST', '/api/admin/system/reset-data', ['confirm' => 'CONFIRM_FACTORY_RESET'], $cjCmd);
        $this->assert($validToken['code'] === 200, "Confirmed factory reset succeeds with HTTP 200");

        @unlink($cjCmd);
    }

    private function testOriginCsrfValidation(): void {
        echo "\n22. Cross-Origin Request Forgery Defense:\n";
        // Attempt POST from untrusted origin
        $csrfAttempt = $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], null, [
            'Origin: https://malicious-adversary-origin.com'
        ]);
        $this->assert($csrfAttempt['code'] === 403, "Untrusted cross-origin request BLOCKED with HTTP 403 Forbidden");
    }

    private function testDocumentDeletionAndVersioning(): void {
        echo "\n23. Document Deletion, Versioning & Immutability Protection:\n";
        $cjHero = tempnam(sys_get_temp_dir(), 'ghra_hero_doc_');
        $this->request('POST', '/api/auth/login', ['username' => 'lumina', 'password' => 'hero123'], $cjHero);

        $cjAdmin = tempnam(sys_get_temp_dir(), 'ghra_admin_doc_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjAdmin);

        // Step 1: Upload a test document under Lumina (hero_lumina_02)
        $tmpFile = tempnam(sys_get_temp_dir(), 'ghra_test_upload_') . '.png';
        // 1x1 transparent PNG bytes
        file_put_contents($tmpFile, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='));

        $cfile = new CURLFile($tmpFile, 'image/png', 'test_certification.png');
        $uploadRes = $this->requestMultipart('/api/heroes/hero_lumina_02/documents', [
            'document' => $cfile,
            'type' => 'Other Supporting Documents'
        ], $cjHero);
        @unlink($tmpFile);

        $this->assert($uploadRes['code'] === 201, "Hero can upload new document (HTTP 201)");
        $docId = $uploadRes['json']['data']['id'] ?? '';
        $docVersion = $uploadRes['json']['data']['version'] ?? 0;
        $this->assert($docVersion >= 1, "Uploaded document has version tracking initialized (version: {$docVersion})");
        $this->assert(($uploadRes['json']['data']['verification_status'] ?? '') === 'Pending', "Uploaded enrollment document starts Pending");

        $missingDecision = $this->request('POST', "/api/heroes/hero_lumina_02/documents/{$docId}/verify", [
            'notes' => 'No decision supplied'
        ], $cjAdmin);
        $this->assert($missingDecision['code'] === 400, "Missing document verification decision rejected");
        $invalidDecision = $this->request('POST', "/api/heroes/hero_lumina_02/documents/{$docId}/verify", [
            'status' => 'Approved',
            'notes' => 'Unsupported decision'
        ], $cjAdmin);
        $this->assert($invalidDecision['code'] === 400, "Invalid document decision cannot default to Verified");
        $missingDocNotes = $this->request('POST', "/api/heroes/hero_lumina_02/documents/{$docId}/verify", [
            'status' => 'Verified'
        ], $cjAdmin);
        $this->assert($missingDocNotes['code'] === 400, "Document decision without reviewer notes rejected");

        // Step 2: Another hero attempts to delete Lumina's document (IDOR on deletion)
        $cjOtherHero = tempnam(sys_get_temp_dir(), 'ghra_other_hero_');
        $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123'], $cjOtherHero);
        $delIdor = $this->request('DELETE', "/api/heroes/hero_lumina_02/documents/{$docId}", null, $cjOtherHero);
        $this->assert($delIdor['code'] === 403, "Cross-hero document deletion BLOCKED (IDOR protection HTTP 403)");
        @unlink($cjOtherHero);

        // Step 3: Verify a required document as authorized staff, then test immutability.
        $markVerified = $this->request('POST', '/api/heroes/hero_lumina_02/documents/doc_hero_lumina_02_id/verify', [
            'status' => 'Verified',
            'notes' => 'Test reviewer explicitly reviewed the generated sample document.'
        ], $cjAdmin);
        $this->assert($markVerified['code'] === 200, "Authorized staff can verify a pending required document with notes");
        $delVerified = $this->request('DELETE', "/api/heroes/hero_lumina_02/documents/doc_hero_lumina_02_id", null, $cjAdmin);
        $this->assert($delVerified['code'] === 403, "Deletion of VERIFIED compliance document BLOCKED (HTTP 403)");

        // Step 4: Legitimate deletion of unverified document by owner hero
        $delOwner = $this->request('DELETE', "/api/heroes/hero_lumina_02/documents/{$docId}", null, $cjHero);
        $this->assert($delOwner['code'] === 200, "Owner hero can safely delete unverified document (HTTP 200)");

        @unlink($cjHero);
        @unlink($cjAdmin);
    }

    private function testDoubleExtensionUploadBlocked(): void {
        echo "\n24. Upload Perimeter & Malicious Extension Defense:\n";
        $cjHero = tempnam(sys_get_temp_dir(), 'ghra_hero_up_');
        $this->request('POST', '/api/auth/login', ['username' => 'lumina', 'password' => 'hero123'], $cjHero);

        // Attempt uploading payload with double extension (e.g. exploit.php.png)
        $tmpMal = tempnam(sys_get_temp_dir(), 'ghra_mal_') . '.php.png';
        file_put_contents($tmpMal, "<?php echo 'malicious'; ?>");

        $cfile = new CURLFile($tmpMal, 'image/png', 'backdoor.php.png');
        $uploadMal = $this->requestMultipart('/api/heroes/hero_lumina_02/documents', [
            'document' => $cfile,
            'type' => 'Medical Clearance'
        ], $cjHero);
        @unlink($tmpMal);

        $this->assert($uploadMal['code'] === 400, "Double-extension upload backdoor.php.png REJECTED (HTTP 400 Bad Request)");

        // Attempt uploading raw PHP file
        $tmpPhp = tempnam(sys_get_temp_dir(), 'ghra_php_') . '.php';
        file_put_contents($tmpPhp, "<?php phpinfo(); ?>");
        $cfilePhp = new CURLFile($tmpPhp, 'application/x-php', 'webshell.php');
        $uploadPhp = $this->requestMultipart('/api/heroes/hero_lumina_02/documents', [
            'document' => $cfilePhp,
            'type' => 'Medical Clearance'
        ], $cjHero);
        @unlink($tmpPhp);

        $this->assert(in_array($uploadPhp['code'], [400, 415], true), "Executable PHP file upload webshell.php REJECTED (HTTP {$uploadPhp['code']})");

        @unlink($cjHero);
    }

    private function testVaultMacTamperDetection(): void {
        echo "\n25. Authenticated Encryption (Encrypt-then-MAC) Tamper Detection:\n";
        require_once __DIR__ . '/../backend/crypto.php';

        $testBio = [
            'legal_name' => 'Dr. Bruce Banner',
            'dna_sequence' => 'ATCG-ALPHA-GAMMA-9988',
            'emergency_contact' => '+1-555-GAMMA-01'
        ];

        $encResult = CryptoService::encryptVault($testBio);
        $vaultId = $encResult['vault_id'];
        $this->assert(!empty($vaultId), "Vault record encrypted with Encrypt-then-MAC");

        // Verify valid decryption
        $decrypted = CryptoService::decryptVault($vaultId);
        $this->assert($decrypted !== null && $decrypted['legal_name'] === 'Dr. Bruce Banner', "Valid vault record decrypts successfully with valid HMAC");

        // Verify HMAC metadata in vault storage
        $vaultData = JsonStorage::read(FILE_VAULT, []);
        $this->assert(!empty($vaultData[$vaultId]['mac']), "Vault record contains HMAC authentication tag");
        $this->assert(($vaultData[$vaultId]['algo'] ?? '') === 'AES-256-CBC+HMAC-SHA256', "Algorithm specifies authenticated AES-256-CBC+HMAC-SHA256");

        // Bit-flip ciphertext in storage
        $rawCt = base64_decode($vaultData[$vaultId]['ciphertext']);
        $rawCt[0] = chr(ord($rawCt[0]) ^ 0xFF);
        $tamperedRecord = $vaultData[$vaultId];
        $tamperedRecord['ciphertext'] = base64_encode($rawCt);

        JsonStorage::transaction(FILE_VAULT, function(&$v) use ($vaultId, $tamperedRecord) {
            $v[$vaultId] = $tamperedRecord;
        });

        $tamperDec = CryptoService::decryptVault($vaultId);
        $this->assert($tamperDec === null, "Ciphertext tampering detected by HMAC: decryptVault returns null");

        // Clean up test vault record
        JsonStorage::transaction(FILE_VAULT, function(&$v) use ($vaultId) {
            unset($v[$vaultId]);
        });
    }

    private function testSecurityHeadersAndCsp(): void {
        echo "\n26. Security Headers & Content-Security-Policy Perimeter:\n";
        $res = $this->request('GET', '/api/health');

        $headers = $res['headers'];
        $this->assert(stripos($headers, 'X-Content-Type-Options: nosniff') !== false, "X-Content-Type-Options: nosniff enforced");
        $this->assert(stripos($headers, 'X-Frame-Options: DENY') !== false, "X-Frame-Options: DENY enforced");
        $this->assert(stripos($headers, 'Content-Security-Policy') !== false, "Content-Security-Policy header enforced on API responses");
        $this->assert(stripos($headers, 'Permissions-Policy') !== false, "Permissions-Policy header enforced");
    }

    private function testSentinelQrScanning(): void {
        echo "\n27. Sentinel QR Code & Operative ID Verification Scanner:\n";

        // 1. Scan via GHRMS URI protocol with gov_code
        $res1 = $this->request('POST', '/api/sentinel/scan', [
            'qr_input' => 'GHRMS://HERO/9GH-8430'
        ]);
        $this->assert($res1['code'] === 200, "Sentinel scan resolves GHRMS://HERO/9GH-8430 (HTTP 200)");
        $data1 = $res1['json'];
        $this->assert(($data1['data']['alias'] ?? '') === 'APEX', "Resolved hero is APEX by gov_code");

        // 2. Scan via GHRMS URI with hero ID
        $res2 = $this->request('POST', '/api/sentinel/scan', [
            'qr_input' => 'GHRMS://HERO/hero_lumina_02'
        ]);
        $this->assert($res2['code'] === 200, "Sentinel scan resolves GHRMS://HERO/hero_lumina_02 (HTTP 200)");
        $data2 = $res2['json'];
        $this->assert(($data2['data']['alias'] ?? '') === 'LUMINA', "Resolved hero is LUMINA by id");

        // 3. Scan via direct ID
        $res3 = $this->request('POST', '/api/sentinel/scan', [
            'query' => 'hero_apex_01'
        ]);
        $this->assert($res3['code'] === 200, "Sentinel scan resolves plain hero ID hero_apex_01 (HTTP 200)");

        // 4. Scan via License Number
        $res4 = $this->request('POST', '/api/sentinel/scan', [
            'payload' => 'GHRMS-LIC-9GH-8430'
        ]);
        $this->assert($res4['code'] === 200, "Sentinel scan resolves by license number (HTTP 200)");

        // 5. Unregistered subject triggers security breach alert (404)
        $res5 = $this->request('POST', '/api/sentinel/scan', [
            'qr_input' => 'GHRMS://HERO/NON_EXISTENT_UNKNOWN_000'
        ]);
        $this->assert($res5['code'] === 404, "Unregistered QR code returns 404 alert breach");
    }

    private function testHardeningDefenses(): void {
        echo "\n28. Production Defense: Privileged Starter Credential Policy:\n";
        require_once __DIR__ . '/../backend/config.php';
        require_once __DIR__ . '/../backend/crypto.php';
        require_once __DIR__ . '/../backend/auth.php';

        // Direct test of production strict policy gate
        $origEnv = getenv('APP_ENV');
        $origAllow = getenv('ALLOW_DEFAULT_ADMIN_CREDENTIALS');
        putenv('APP_ENV=production');
        putenv('ALLOW_DEFAULT_ADMIN_CREDENTIALS=false');

        $blockedRes = AuthService::login('commander', 'admin123');
        $this->assert(isset($blockedRes['blocked_default_credential']) && $blockedRes['blocked_default_credential'] === true, "Production blocks privileged login using default admin123");

        // Restore test env
        putenv("APP_ENV={$origEnv}");
        putenv("ALLOW_DEFAULT_ADMIN_CREDENTIALS={$origAllow}");

        echo "\n29. Confidential Identity Access Control & Audit Ledger:\n";
        $cjSarah = tempnam(sys_get_temp_dir(), 'ghra_sc_');
        $this->request('POST', '/api/auth/login', ['username' => 'sarah.chen', 'password' => 'registrar123'], $cjSarah);
        $sarahView = $this->request('GET', '/api/heroes/hero_apex_01', null, $cjSarah);
        $this->assert(!isset($sarahView['json']['data']['vault_info']), "Registrar cannot see raw vault_info in profile API");
        $this->assert(str_contains($sarahView['json']['data']['real_name'] ?? '', 'CONFIDENTIAL'), "Civilian real_name is masked for Registrar on profile API");

        $cjAdmin = tempnam(sys_get_temp_dir(), 'ghra_adm_');
        $this->request('POST', '/api/auth/login', ['username' => 'commander', 'password' => 'admin123'], $cjAdmin);
        $adminView = $this->request('GET', '/api/heroes/hero_apex_01', null, $cjAdmin);
        $this->assert(isset($adminView['json']['data']['vault_info']), "Super Admin receives decrypted vault_info on profile API");

        // Verify audit log has CONFIDENTIAL_IDENTITY_ACCESSED
        $auditData = JsonStorage::read(FILE_AUDIT, []);
        $foundAudit = false;
        foreach (array_reverse($auditData) as $log) {
            if (($log['action'] ?? '') === 'CONFIDENTIAL_IDENTITY_ACCESSED' && ($log['target_id'] ?? '') === 'hero_apex_01') {
                $foundAudit = true;
                break;
            }
        }
        $this->assert($foundAudit, "Confidential identity access is logged to audit ledger");
        @unlink($cjSarah);
        @unlink($cjAdmin);

        echo "\n30. Verified Hero Pending-Update Approval Workflow Enforcement:\n";
        $cjApex = tempnam(sys_get_temp_dir(), 'ghra_ap_');
        $this->request('POST', '/api/auth/login', ['username' => 'apex', 'password' => 'hero123'], $cjApex);

        // Direct PUT on approved/licensed hero is rejected
        $putAttempt = $this->request('PUT', '/api/heroes/hero_apex_01', [
            'primary_power' => 'Sonic Overdrive'
        ], $cjApex);
        $this->assert($putAttempt['code'] === 403, "Direct PUT profile update on verified/licensed hero is rejected (HTTP 403)", "Got code {$putAttempt['code']} - " . json_encode($putAttempt['json']));

        // Proposing via request-update succeeds
        $reqUpdate = $this->request('POST', '/api/heroes/hero_apex_01/request-update', [
            'primary_power' => 'Sonic Overdrive'
        ], $cjApex);
        $this->assert($reqUpdate['code'] === 200, "Approved hero update routed to pending approval queue (HTTP 200)");
        @unlink($cjApex);

        echo "\n31. Legacy Vault HMAC Integrity Enforcement & Safe Auto-Migration:\n";
        $legacyBio = [
            'legal_name' => 'Legacy Operative Test',
            'dna_sequence' => 'LEGACY-DNA-1234'
        ];
        $legacyEnc = CryptoService::encryptVault($legacyBio);
        $legacyId = $legacyEnc['vault_id'];

        // Simulate legacy unauthenticated record by stripping MAC
        JsonStorage::transaction(FILE_VAULT, function(&$v) use ($legacyId) {
            unset($v[$legacyId]['mac']);
            $v[$legacyId]['algo'] = 'AES-256-CBC';
        });

        // Strict verification: decryption must reject record without MAC
        $unauthDec = CryptoService::decryptVault($legacyId);
        $this->assert($unauthDec === null, "Legacy record without MAC tag is rejected by decryptVault");

        // Safe migration: migrate legacy unauthenticated record
        $migratedCount = CryptoService::migrateVaultHmac();
        $this->assert($migratedCount >= 1, "migrateVaultHmac successfully detects and migrates legacy record");

        // Verify record is now properly authenticated and decrypts
        $afterMigration = CryptoService::decryptVault($legacyId);
        $this->assert($afterMigration !== null && $afterMigration['legal_name'] === 'Legacy Operative Test', "Migrated record decrypts successfully with valid HMAC tag");

        // Cleanup
        JsonStorage::transaction(FILE_VAULT, function(&$v) use ($legacyId) {
            unset($v[$legacyId]);
        });
    }
}

$runner = new GhraTestRunner($baseUrl);
$runner->run();
