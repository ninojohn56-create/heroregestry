<?php
declare(strict_types=1);

$baseUrl = 'http://127.0.0.1:8000';

echo "=== GHRMS THEME MODE BUTTON CONSISTENCY AUDIT ===\n";

$pages = [
    '/'          => 'Portal Gateway',
    '/register'  => 'Registration Wizard',
    '/registry'  => 'Hero Registry Directory',
    '/login'     => 'Clearance Login',
    '/hero'      => 'Hunter Portal',
    '/registrar' => 'Registrar Terminal',
    '/sentinel'  => 'Sentinel Checkpoint',
    '/admin'     => 'Command Matrix'
];

$allPassed = true;

foreach ($pages as $uri => $pageName) {
    echo "\nTesting [$pageName] at $uri:\n";
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 5,
            'ignore_errors' => true
        ]
    ]);
    $html = @file_get_contents($baseUrl . $uri, false, $ctx);
    if ($html === false) {
        echo "  [FAIL] Could not load $uri\n";
        $allPassed = false;
        continue;
    }

    // 1. Check themeToggleBtn exists
    if (!preg_match('/id=["\']themeToggleBtn["\']/', $html)) {
        echo "  [FAIL] themeToggleBtn not found in HTML\n";
        $allPassed = false;
        continue;
    }
    echo "  [PASS] themeToggleBtn exists\n";

    // 2. Check class contains header-tool-btn
    if (!preg_match('/<button[^>]*id=["\']themeToggleBtn["\'][^>]*class=["\'][^"\']*header-tool-btn[^"\']*["\']|<button[^>]*class=["\'][^"\']*header-tool-btn[^"\']*["\'][^>]*id=["\']themeToggleBtn["\']/', $html)) {
        echo "  [FAIL] themeToggleBtn does not have class 'header-tool-btn'\n";
        $allPassed = false;
    } else {
        echo "  [PASS] themeToggleBtn has unified class 'header-tool-btn'\n";
    }

    // 3. Check themeToggleIconSymbol exists
    if (!preg_match('/id=["\']themeToggleIconSymbol["\']/', $html)) {
        echo "  [FAIL] themeToggleIconSymbol not found\n";
        $allPassed = false;
    } else {
        echo "  [PASS] themeToggleIconSymbol exists\n";
    }

    // 4. Check themeToggleIcon exists
    if (!preg_match('/id=["\']themeToggleIcon["\']/', $html)) {
        echo "  [FAIL] themeToggleIcon text label not found\n";
        $allPassed = false;
    } else {
        echo "  [PASS] themeToggleIcon text label exists\n";
    }
}

echo "\n" . str_repeat('=', 50) . "\n";
if ($allPassed) {
    echo "ALL PAGES USE THE IDENTICAL UNIFIED THEME MODE BUTTON DESIGN!\n";
} else {
    echo "SOME PAGES FAILED THE CONSISTENCY AUDIT!\n";
    exit(1);
}
