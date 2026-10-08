<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

$docDir = defined('DIR_DOCUMENTS') ? DIR_DOCUMENTS : (DATA_DIR . '/documents');
if (!is_dir($docDir)) {
    mkdir($docDir, 0755, true);
}

/**
 * Generate a professional Superhuman ID Card as PNG image using GD
 */
function generateIdCardPng(string $filePath, array $hero): void {
    $w = 800;
    $h = 480;
    $im = imagecreatetruecolor($w, $h);

    // Color palette
    $bgDark       = imagecolorallocate($im, 10, 15, 26);
    $cardBg       = imagecolorallocate($im, 16, 24, 40);
    $borderCyan   = imagecolorallocate($im, 14, 165, 233);
    $textWhite    = imagecolorallocate($im, 248, 250, 252);
    $textMuted    = imagecolorallocate($im, 148, 163, 184);
    $textGold     = imagecolorallocate($im, 234, 179, 8);
    $textGreen    = imagecolorallocate($im, 34, 197, 94);
    $headerBg     = imagecolorallocate($im, 23, 37, 84);
    $photoBg      = imagecolorallocate($im, 30, 41, 59);

    imagefill($im, 0, 0, $bgDark);

    // Card boundary with rounded effect
    imagefilledrectangle($im, 15, 15, $w - 15, $h - 15, $cardBg);
    imagerectangle($im, 15, 15, $w - 15, $h - 15, $borderCyan);
    imagerectangle($im, 18, 18, $w - 18, $h - 18, $borderCyan);

    // Top Header Banner
    imagefilledrectangle($im, 20, 20, $w - 20, 80, $headerBg);
    imagestring($im, 5, 40, 30, "DEMO COPY // NOT AN OFFICIAL LICENSE", $textWhite);
    imagestring($im, 3, 40, 52, "AWAKENED BEING CREDENTIAL // SAN FRANCISCO, AGUSAN DEL SUR", $borderCyan);

    // Photo Box Placeholder
    imagefilledrectangle($im, 40, 110, 200, 310, $photoBg);
    imagerectangle($im, 40, 110, 200, 310, $borderCyan);
    imagestring($im, 4, 70, 190, "[ MANA CORE ]", $textMuted);
    imagestring($im, 4, 65, 220, "PENDING REVIEW", $textGold);
    imagestring($im, 3, 500, 425, "SAMPLE - NOT VALID FOR LICENSING", $textGold);

    // Hero Callsign & Identity Fields
    $alias = strtoupper($hero['alias'] ?? 'HUNTER');
    $realName = $hero['real_name'] ?? ($hero['real_bio']['real_name'] ?? 'Classified');
    $govCode = $hero['gov_code'] ?? 'HA-XXXX';
    $power = $hero['primary_power'] ?? 'Awakened Ability';
    $tier = $hero['threat_class'] ?? ($hero['threat_tier_label'] ?? ('Rank ' . ($hero['threat_tier'] ?? 1)));
    $sector = $hero['region'] ?? 'Sector 1 - Poblacion Central Commercial Grid';

    imagestring($im, 5, 230, 110, "HUNTER NAME:  {$alias}", $textGold);
    imagestring($im, 4, 230, 145, "LEGAL NAME:   {$realName}", $textWhite);
    imagestring($im, 3, 230, 180, "HUNTER ID:    {$govCode}", $textMuted);
    imagestring($im, 4, 230, 210, "CLASS/POWER:  {$power}", $borderCyan);
    imagestring($im, 4, 230, 240, "HUNTER RANK:  {$tier}", $textWhite);
    imagestring($im, 3, 230, 270, "GATE SECTOR:  {$sector}", $textMuted);
    imagestring($im, 4, 230, 300, "LICENSE: PENDING HUMAN REVIEW", $textGold);

    // Bottom Security Bar
    imagefilledrectangle($im, 20, 360, $w - 20, 460, $headerBg);
    imagestring($im, 3, 40, 375, "CHIP ID: " . strtoupper(bin2hex(random_bytes(8))), $textMuted);
    imagestring($im, 3, 40, 395, "SECURITY CLEARANCE: ACCORD STANDARD 701-A // TAMPER-EVIDENT RFID", $textMuted);
    imagestring($im, 4, 40, 425, "DEMO RECORD - NOT VALID FOR USE", $textGold);

    // Barcode mock stripes
    for ($bx = 580; $bx < 750; $bx += 6) {
        $color = ($bx % 4 === 0) ? $borderCyan : $textWhite;
        imageline($im, $bx, 375, $bx, 445, $color);
    }

    imagepng($im, $filePath);
    imagedestroy($im);
}

/**
 * Generate an Academy Accreditation Diploma as PNG image using GD
 */
function generateCertificatePng(string $filePath, array $hero): void {
    $w = 800;
    $h = 560;
    $im = imagecreatetruecolor($w, $h);

    // Palette
    $bgParchment = imagecolorallocate($im, 15, 23, 42);
    $innerCard   = imagecolorallocate($im, 20, 30, 55);
    $goldBorder  = imagecolorallocate($im, 245, 158, 11);
    $textWhite   = imagecolorallocate($im, 255, 255, 255);
    $textGold    = imagecolorallocate($im, 251, 191, 36);
    $textCyan    = imagecolorallocate($im, 56, 189, 248);
    $textMuted   = imagecolorallocate($im, 148, 163, 184);

    imagefill($im, 0, 0, $bgParchment);

    // Decorative Borders
    imagefilledrectangle($im, 20, 20, $w - 20, $h - 20, $innerCard);
    imagerectangle($im, 20, 20, $w - 20, $h - 20, $goldBorder);
    imagerectangle($im, 25, 25, $w - 25, $h - 25, $goldBorder);

    // Title
    imagestring($im, 5, 220, 50, "GLOBAL HERO REGISTRATION AUTHORITY", $textGold);
    imagestring($im, 5, 170, 75, "ACADEMY OF METAHUMAN DEFENSE & CITIZEN PROTECTION", $textWhite);
    imagestring($im, 3, 240, 105, "SAMPLE TRAINING RECORD - NOT AN ACCREDITATION", $textCyan);

    // Horizontal Divider
    imageline($im, 80, 130, $w - 80, 130, $goldBorder);

    // Body
    $alias = strtoupper($hero['alias'] ?? 'OPERATIVE');
    $realName = $hero['real_name'] ?? ($hero['real_bio']['real_name'] ?? 'Classified');
    $power = $hero['primary_power'] ?? 'Special Enhancement';

    imagestring($im, 4, 120, 160, "This is to certify that candidate operative:", $textMuted);
    imagestring($im, 5, 180, 195, "{$alias} // [ Civilian Legal Name: {$realName} ]", $textGold);
    imagestring($im, 4, 120, 240, "has completed tactical evaluation and kinetic containment mastery in:", $textMuted);
    imagestring($im, 5, 180, 270, "Power Classification: {$power}", $textCyan);
    imagestring($im, 4, 120, 310, "Sample record only; no accreditation.", $textWhite);

    // Seal and Signature Block
    imagerectangle($im, 80, 380, 260, 490, $goldBorder);
    imagestring($im, 4, 105, 410, "[ SAMPLE SEAL ]", $textGold);
    imagestring($im, 3, 95, 435, "NO OFFICIAL SEAL", $textMuted);
    imagestring($im, 3, 90, 455, "SUBMITTED FOR REVIEW", $textCyan);

    imageline($im, 480, 440, 700, 440, $textWhite);
    imagestring($im, 4, 520, 450, "NO REVIEWER SIGNATURE", $textWhite);
    imagestring($im, 3, 490, 470, "PENDING HUMAN REVIEW", $textMuted);

    // Bottom Date
    imagestring($im, 3, 80, 515, "SAMPLE DOCUMENT DATE: " . date('F j, Y'), $textMuted);
    imagestring($im, 3, 500, 515, "REGISTRY ID: " . ($hero['gov_code'] ?? '9GH-0000'), $textCyan);

    imagepng($im, $filePath);
    imagedestroy($im);
}

/**
 * Generate a valid, clean native PDF Tactical Dossier
 */
function generateTacticalDossierPdf(string $filePath, array $hero): void {
    $alias = $hero['alias'] ?? 'HERO';
    $realName = $hero['real_name'] ?? 'Classified';
    $govCode = $hero['gov_code'] ?? '9GH-XXXX';
    $power = $hero['primary_power'] ?? 'Metahuman Output';
    $secondary = $hero['secondary_power'] ?? 'None registered';
    $tier = $hero['threat_class'] ?? ('Tier ' . ($hero['threat_tier'] ?? 1));
    $sector = $hero['region'] ?? 'Sector 1 - Poblacion Central Commercial Grid';
    $license = 'PENDING HUMAN REVIEW';
    $status = $hero['status'] ?? 'Active';

    $lines = [
        "HUNTERS ASSOCIATION // REGISTRATION & LICENSING BUREAU",
        "DEMO COPY // NOT AN OFFICIAL HUNTER DOSSIER",
        "SAMPLE DATA - NOT VERIFIED OR VALID FOR LICENSING",
        "CLEARANCE LEVEL: ASSOCIATION EXECUTIVE ACCORD (SAN FRANCISCO, ADS)",
        "--------------------------------------------------------------------------------",
        "AWAKENED HUNTER IDENTIFICATION:",
        "  Hunter Alias:            {$alias}",
        "  Civilian Legal Name:     {$realName}",
        "  Hunter Registry Code:    {$govCode}",
        "  Official License Number: {$license}",
        "  Licensing Standing:      {$status}",
        "",
        "MANA CORE PROFILE & COMBAT CLASSIFICATION:",
        "  Combat Class / Power:    {$power}",
        "  Sub-Class / Skill:       {$secondary}",
        "  Assigned Hunter Rank:    {$tier}",
        "  Assigned Gate Sector:    {$sector}",
        "",
        "DUNGEON RAID PROTOCOLS & GATE ENGAGEMENT DIRECTIVES:",
        "  1. Only B-Rank and above Hunters permitted for Red Gate & High-Tier Raids.",
        "  2. Mana Core resonance must be recalibrated before high-difficulty Gate entry.",
        "  3. In event of Dungeon Break, report immediately to Association Command Grid.",
        "  4. Unauthorized Gate entry or false rank reporting punishable by Disavowal.",
        "",
        "REVIEW STATUS:",
        "  Status:                  Pending human review",
        "  Reviewer:                None assigned",
        "  Document Date:           " . date('Y-m-d H:i:s T'),
        "--------------------------------------------------------------------------------",
        "DEMONSTRATION DOCUMENT // NO OFFICIAL AUTHORITY OR APPROVAL"
    ];

    $streamContent = "BT\n/F1 11 Tf\n14 TL\n50 720 Td\n";
    foreach ($lines as $line) {
        $escaped = strtr($line, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
        $streamContent .= "({$escaped}) '\n";
    }
    $streamContent .= "ET\n";

    $streamLen = strlen($streamContent);

    $pdf = "%PDF-1.4\n" .
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" .
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" .
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n" .
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n" .
        "5 0 obj\n<< /Length {$streamLen} >>\nstream\n{$streamContent}endstream\nendobj\n";

    $pos5 = strpos($pdf, "5 0 obj");
    $xref = "xref\n0 6\n0000000000 65535 f \n" .
        sprintf("%010d 00000 n \n", strpos($pdf, "1 0 obj")) .
        sprintf("%010d 00000 n \n", strpos($pdf, "2 0 obj")) .
        sprintf("%010d 00000 n \n", strpos($pdf, "3 0 obj")) .
        sprintf("%010d 00000 n \n", strpos($pdf, "4 0 obj")) .
        sprintf("%010d 00000 n \n", $pos5);

    $startXref = strlen($pdf);
    $pdf .= $xref . "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{$startXref}\n%%EOF\n";

    file_put_contents($filePath, $pdf);
}

// -------------------------------------------------------------
// Process all heroes in heroes.json
// -------------------------------------------------------------
$refreshSampleFilesOnly = in_array('--refresh-sample-files', $argv ?? [], true);
$refreshSamplePdfsOnly = in_array('--refresh-sample-pdfs', $argv ?? [], true);
$heroes = JsonStorage::read(FILE_HEROES, []);

if ($refreshSamplePdfsOnly) {
    foreach ($heroes as $heroId => $hero) {
        $filePath = $docDir . "/doc_{$heroId}_auth.pdf";
        if (is_file($filePath)) {
            generateTacticalDossierPdf($filePath, $hero);
        }
    }
    echo "[SUCCESS] Existing generated sample PDFs refreshed; document metadata was not changed.\n";
    exit(0);
}

if ($refreshSampleFilesOnly) {
    foreach ($heroes as $heroId => $hero) {
        foreach ([
            ["doc_{$heroId}_id.png", 'id'],
            ["doc_{$heroId}_cert.png", 'cert'],
            ["doc_{$heroId}_auth.pdf", 'auth']
        ] as [$fileName, $type]) {
            $filePath = $docDir . '/' . $fileName;
            if (!is_file($filePath)) {
                continue;
            }
            if ($type === 'id') {
                generateIdCardPng($filePath, $hero);
            } elseif ($type === 'cert') {
                generateCertificatePng($filePath, $hero);
            } else {
                generateTacticalDossierPdf($filePath, $hero);
            }
        }
    }
    echo "[SUCCESS] Existing generated sample files refreshed; document metadata was not changed.\n";
    exit(0);
}

echo "Populating rich uploaded files for all heroes...\n";

$total = count($heroes);
$updatedCount = 0;

foreach ($heroes as $heroId => &$hero) {
    $cleanAlias = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', $hero['alias'] ?? $heroId));
    
    // 1. Official ID Document
    $idFileName = "doc_{$heroId}_id.png";
    $idFilePath = $docDir . '/' . $idFileName;
    generateIdCardPng($idFilePath, $hero);
    $idFileSize = filesize($idFilePath);

    // 2. Certification Diploma
    $certFileName = "doc_{$heroId}_cert.png";
    $certFilePath = $docDir . '/' . $certFileName;
    generateCertificatePng($certFilePath, $hero);
    $certFileSize = filesize($certFilePath);

    // 3. Tactical Dossier PDF
    $pdfFileName = "doc_{$heroId}_auth.pdf";
    $pdfFilePath = $docDir . '/' . $pdfFileName;
    generateTacticalDossierPdf($pdfFilePath, $hero);
    $pdfFileSize = filesize($pdfFilePath);

    // Populate supporting_documents array
    $hero['supporting_documents'] = [
        [
            'id' => "doc_{$heroId}_id",
            'document_type' => 'Official ID',
            'original_name' => "{$cleanAlias}_official_id.png",
            'file_name' => $idFileName,
            'file_size' => $idFileSize,
            'mime_type' => 'image/png',
            'upload_date' => date('c', strtotime('-15 days')),
            'uploaded_at' => date('c', strtotime('-15 days')),
            'expiration_date' => '2035-12-31',
            'verification_status' => 'Pending',
            'verified_by' => null,
            'verification_date' => null,
            'verification_notes' => null,
            'reviewed_by' => null,
            'review_date' => null
        ],
        [
            'id' => "doc_{$heroId}_cert",
            'document_type' => 'Hero Certification',
            'original_name' => "{$cleanAlias}_academy_diploma.png",
            'file_name' => $certFileName,
            'file_size' => $certFileSize,
            'mime_type' => 'image/png',
            'upload_date' => date('c', strtotime('-12 days')),
            'uploaded_at' => date('c', strtotime('-12 days')),
            'expiration_date' => null,
            'verification_status' => 'Pending',
            'verified_by' => null,
            'verification_date' => null,
            'verification_notes' => null,
            'reviewed_by' => null,
            'review_date' => null
        ],
        [
            'id' => "doc_{$heroId}_auth",
            'document_type' => 'Authorization Document',
            'original_name' => "{$cleanAlias}_tactical_dossier.pdf",
            'file_name' => $pdfFileName,
            'file_size' => $pdfFileSize,
            'mime_type' => 'application/pdf',
            'upload_date' => date('c', strtotime('-5 days')),
            'uploaded_at' => date('c', strtotime('-5 days')),
            'expiration_date' => '2028-06-30',
            'verification_status' => 'Pending',
            'verified_by' => null,
            'verification_date' => null,
            'verification_notes' => null,
            'reviewed_by' => null,
            'review_date' => null
        ]
    ];

    $hero['verification_status'] = 'Pending';
    $hero['verified_by'] = null;
    $hero['verification_date'] = null;
    $hero['verification_notes'] = null;
    if (in_array($hero['status'] ?? '', ['Verified', 'Approved', 'Licensed'], true)) {
        $hero['status'] = 'Under Review';
        $hero['badge_color'] = 'yellow';
        $hero['license_number'] = null;
        $hero['approved_at'] = null;
        $hero['approved_by'] = null;
    }

    $updatedCount++;
    echo "  [OK] Generated 3 documents (ID PNG, Diploma PNG, Dossier PDF) for {$hero['alias']} ({$heroId})\n";
}
unset($hero);

// Save updated heroes to heroes.json
JsonStorage::write(FILE_HEROES, $heroes);

echo "\n[SUCCESS] Successfully generated full documents packet for all {$updatedCount}/{$total} heroes!\n";
