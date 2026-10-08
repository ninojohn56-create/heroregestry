<?php
declare(strict_types=1);

$baseUrl = 'http://127.0.0.1:8000';

echo "=== GHRMS REGISTRATION PAGE AUDIT ===\n";

// 1. Fetch register page HTML
$ctx = stream_context_create([
    'http' => [
        'timeout' => 5,
        'ignore_errors' => true
    ]
]);
$html = @file_get_contents($baseUrl . '/register', false, $ctx);
if ($html === false) {
    echo "FAIL: Could not reach $baseUrl/register\n";
    exit(1);
}
echo "PASS: Fetched /register successfully (" . strlen($html) . " bytes)\n";

// 2. Extract script block
if (preg_match('/<script>([\s\S]*?)<\/script>\s*<!-- In-Page Document Viewer Modal -->/', $html, $m)) {
    $js = $m[1];
    $opens = substr_count($js, '{');
    $closes = substr_count($js, '}');
    echo "PASS: Script block extracted. Open braces: $opens, Close braces: $closes\n";
    if ($opens === $closes) {
        echo "PASS: JavaScript braces are perfectly balanced (diff = 0)!\n";
    } else {
        echo "FAIL: JavaScript braces unbalanced! Diff: " . ($opens - $closes) . "\n";
        exit(1);
    }
} else {
    echo "FAIL: Could not extract main registration script block\n";
    exit(1);
}

// 3. Verify critical functions exist in the script
$functions = [
    'applyRegisterTheme',
    'findClosestSector',
    'initRegistrationMap',
    'setMapLocation',
    'toggleRegistrationMap',
    'updateThreatLabel',
    'processFaceFile',
    'handleFacePhotoSelect',
    'resetFacePhoto',
    'openLiveCameraModal',
    'startCameraStream',
    'captureLiveSnapshot',
    'retakeLiveSnapshot',
    'acceptLiveSnapshot',
    'flipCameraFacing',
    'closeLiveCameraModal',
    'triggerNativeMobileCamera',
    'goToStep',
    'nextStep',
    'prevStep',
    'getRegistrationPayload',
    'uploadAttachedDocuments',
    'saveDraft',
    'submitRegistration',
    'escapeHtml',
    'initIntakeState',
    'populateHeroData',
    'returnToOriginDashboard',
    'openRegisterDocViewer',
    'closeRegisterDocViewer',
    'toggleRegisterDocZoom',
    'printRegisterDoc'
];

$allFunctionsFound = true;
foreach ($functions as $fn) {
    if (!preg_match('/function\s+' . preg_quote($fn, '/') . '\b/', $js)) {
        echo "FAIL: Function $fn not found in script!\n";
        $allFunctionsFound = false;
    }
}
if ($allFunctionsFound) {
    echo "PASS: All " . count($functions) . " registration functions defined!\n";
} else {
    exit(1);
}

// 4. Verify all interactive buttons in the HTML have valid targets
$buttons = [
    'btnPrev',
    'btnSaveDraft',
    'btnNext',
    'btnSubmit',
    'btnToggleAddressMap',
    'btnRemoveFace',
    'themeToggleBtn'
];
foreach ($buttons as $btn) {
    if (strpos($html, 'id="' . $btn . '"') === false) {
        echo "FAIL: Button #$btn missing in HTML!\n";
        exit(1);
    }
}
echo "PASS: All " . count($buttons) . " core action buttons present in HTML!\n";

// 5. Test registration API directly with a sample registration payload
$payload = [
    'is_draft' => false,
    'callsign' => 'AutomatedTestHero_' . rand(1000, 9999),
    'username' => 'AutomatedTestHero_' . rand(1000, 9999),
    'email' => 'autotest_' . rand(1000, 9999) . '@example.com',
    'password' => 'SecurePass123!',
    'real_name' => 'Auto Tester',
    'dob' => '1995-05-15',
    'gender' => 'Other',
    'contact_number' => '+63 912 345 6789',
    'address' => 'Sector 1, San Francisco, Agusan del Sur',
    'hero_classification' => 'Striker',
    'combat_style' => 'Close Quarters Combat',
    'primary_power' => 'Kinetic Redirection',
    'power_description' => 'Absorbs kinetic impact and redirects as concussive blast',
    'weaknesses' => 'Overheating after consecutive discharges',
    'training_experience' => '3 years municipal defense squad',
    'threat_tier' => 4,
    'power_level' => 75,
    'combat_rating' => 80,
    'id_type' => 'National ID',
    'id_number' => 'NID-9999-1234',
    'gov_id' => 'NID-9999-1234'
];

$postContext = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode($payload),
        'ignore_errors' => true
    ]
]);

$apiRes = @file_get_contents($baseUrl . '/api/heroes/register', false, $postContext);
$apiData = json_decode((string)$apiRes, true);

if ($apiData && !empty($apiData['success']) && !empty($apiData['hero']['id'])) {
    echo "PASS: Registration API successfully submitted test packet! Hero ID: " . $apiData['hero']['id'] . "\n";
} else {
    echo "FAIL: Registration API submission failed: " . json_encode($apiData) . "\n";
    exit(1);
}

echo "=== ALL REGISTRATION CHECKS PASSED SUCCESSFULLY ===\n";
