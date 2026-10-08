<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$uploadDir = $root . '/htdocs_upload';
$samplesDir = $root . '/sample_hunter_documents';

echo "Building production upload bundle in: {$uploadDir}\n";

// Helper recursive copy
function copyRecursive(string $src, string $dst): void {
    $dir = opendir($src);
    @mkdir($dst, 0775, true);
    while (false !== ($file = readdir($dir))) {
        if ($file === '.' || $file === '..') continue;
        $srcPath = $src . '/' . $file;
        $dstPath = $dst . '/' . $file;
        if (is_dir($srcPath)) {
            copyRecursive($srcPath, $dstPath);
        } else {
            copy($srcPath, $dstPath);
        }
    }
    closedir($dir);
}

// Helper recursive delete
function deleteRecursive(string $dir): void {
    if (!file_exists($dir)) return;
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        @$todo($fileinfo->getRealPath());
    }
    @rmdir($dir);
}

// 1. Clean existing
deleteRecursive($uploadDir);
@mkdir($uploadDir, 0775, true);

// 2. Copy root files
$rootFiles = ['.htaccess', 'router.php', 'check_system.php', '.env'];
foreach ($rootFiles as $rf) {
    if (file_exists($root . '/' . $rf)) {
        copy($root . '/' . $rf, $uploadDir . '/' . $rf);
        echo "Copied root file: {$rf}\n";
    }
}

// 3. Copy backend (all PHP services and datastores)
echo "Copying backend directory...\n";
copyRecursive($root . '/backend', $uploadDir . '/backend');

// Ensure writable directories exist inside backend
@mkdir($uploadDir . '/backend/data/documents', 0775, true);
@mkdir($uploadDir . '/backend/data/ratelimit', 0775, true);

// 4. Copy frontend (all web pages, css, js, img)
echo "Copying frontend directory...\n";
copyRecursive($root . '/frontend', $uploadDir . '/frontend');

// Ensure writable upload directories exist
@mkdir($uploadDir . '/frontend/uploads/avatars', 0775, true);

// Create an informative README inside htdocs_upload
$readmeContent = <<<MARKDOWN
# Ready-to-Upload Production Package (htdocs)

This folder contains **ONLY** the production files required for hosting your application on **InfinityFree, cPanel, or Apache**.

## How to Deploy:
1. Open your hosting File Manager or FTP client (e.g. FileZilla).
2. Navigate to your site's `htdocs/` (or `public_html/`) folder on the server.
3. Upload **ALL** contents of this folder directly into `htdocs/`:
   - `.htaccess`
   - `.env`
   - `router.php`
   - `check_system.php`
   - `backend/`
   - `frontend/`

## Permissions Reminder:
Ensure the following folders have write permissions (chmod 775 or 777) on your server:
- `backend/data/`
- `backend/data/documents/`
- `backend/data/ratelimit/`
- `frontend/uploads/avatars/`

## Test After Uploading:
Visit: `https://your-domain.example/login`
MARKDOWN;

file_put_contents($uploadDir . '/DEPLOY_INSTRUCTIONS.txt', $readmeContent);

// 5. Create Sample Verification Documents for register.html
@mkdir($samplesDir, 0775, true);

function createSampleImage(string $filePath, string $title, string $subtitle, array $bgRgb, array $fgRgb): void {
    if (!extension_loaded('gd')) return;
    $width = 800;
    $height = 500;
    $img = imagecreatetruecolor($width, $height);
    
    list($r1, $g1, $b1) = $bgRgb;
    list($r2, $g2, $b2) = $fgRgb;
    
    $bg = imagecolorallocate($img, $r1, $g1, $b1);
    $fg = imagecolorallocate($img, $r2, $g2, $b2);
    $accent = imagecolorallocate($img, 16, 185, 129); // Emerald
    $border = imagecolorallocate($img, 71, 85, 105);
    
    imagefill($img, $bg, 0, 0);
    imagerectangle($img, 20, 20, $width - 20, $height - 20, $border);
    imagerectangle($img, 22, 22, $width - 22, $height - 22, $accent);
    
    // Add text lines
    imagestring($img, 5, 50, 60, "GLOBAL HERO REGISTRATION AUTHORITY (GHRMS)", $fg);
    imagestring($img, 5, 50, 90, "OFFICIAL VERIFICATION DOCUMENT EVIDENCE", $accent);
    imagestring($img, 5, 50, 160, "DOCUMENT TYPE: " . $title, $fg);
    imagestring($img, 4, 50, 200, "DETAILS: " . $subtitle, $fg);
    imagestring($img, 4, 50, 240, "STATUS: VALID / COMPLIANT / UNEXPIRED", $accent);
    imagestring($img, 3, 50, 320, "SECURITY CODE: GHRMS-EVIDENCE-" . strtoupper(bin2hex(random_bytes(6))), $fg);
    imagestring($img, 3, 50, 350, "ISSUED AT: 2026-10-08 | ACCORD STANDARD 701-A", $fg);
    imagestring($img, 2, 50, 430, "CONFIDENTIAL // OFFICIAL RECORD CERTIFICATION", $border);
    
    imagepng($img, $filePath);
    imagedestroy($img);
}

createSampleImage(
    $samplesDir . '/01_REQUIRED_Government_ID_PhilSys.png',
    'Philippine National ID (PhilSys)',
    'Verified PhilSys Card // Serial: PSN-9281-0192-K',
    [15, 23, 42],
    [241, 245, 249]
);

createSampleImage(
    $samplesDir . '/02_REQUIRED_Hunter_License_Certificate.png',
    'Hunter License / Mana Core Certificate',
    'Philippine Hunters Association // Class-A Accreditation',
    [15, 23, 42],
    [241, 245, 249]
);

createSampleImage(
    $samplesDir . '/03_OPTIONAL_Dungeon_Academy_Training_Diploma.png',
    'Tactical Dungeon Raid Training Diploma',
    'Manila Metropolitan Gate Defense Academy // Honor Graduate',
    [15, 23, 42],
    [241, 245, 249]
);

createSampleImage(
    $samplesDir . '/04_OPTIONAL_Guild_Sponsorship_Waiver.png',
    'Guild Sponsorship & Raid Waiver',
    'Hunters Association Guild Endorsement // Level 4 Clearance',
    [15, 23, 42],
    [241, 245, 249]
);

// Copy a sample avatar photo
if (file_exists($root . '/frontend/img/apex.jpg')) {
    copy($root . '/frontend/img/apex.jpg', $samplesDir . '/05_OPTIONAL_Operative_Portrait_Photo.jpg');
}

echo "Created sample verification documents in: {$samplesDir}\n";
echo "Done!\n";
