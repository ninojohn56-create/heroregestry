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
    imagestring($im, 5, 40, 30, "GLOBAL HERO REGISTRATION AUTHORITY (GHRMS)", $textWhite);
    imagestring($im, 3, 40, 52, "FEDERAL SUPERHUMAN ACCORD // CIVILIAN & OPERATIVE CREDENTIAL", $borderCyan);

    // Photo Box Placeholder
    imagefilledrectangle($im, 40, 110, 200, 310, $photoBg);
    imagerectangle($im, 40, 110, 200, 310, $borderCyan);
    imagestring($im, 4, 75, 190, "[ BIOMETRIC ]", $textMuted);
    imagestring($im, 4, 85, 220, "VERIFIED", $textGreen);

    // Hero Callsign & Identity Fields
    $alias = strtoupper($hero['alias'] ?? 'OPERATIVE');
    $realName = $hero['real_name'] ?? ($hero['real_bio']['real_name'] ?? 'Classified');
    $govCode = $hero['gov_code'] ?? '9GH-XXXX';
    $power = $hero['primary_power'] ?? 'Classified Ability';
    $tier = $hero['threat_class'] ?? ($hero['threat_tier_label'] ?? ('Tier ' . ($hero['threat_tier'] ?? 1)));
    $sector = $hero['region'] ?? 'Sector 1 - Poblacion Central Commercial Grid';
    $license = $hero['license_number'] ?? 'GHRMS-LIC-PENDING';

    imagestring($im, 5, 230, 110, "CALLSIGN: {$alias}", $textGold);
    imagestring($im, 4, 230, 145, "LEGAL NAME: {$realName}", $textWhite);
    imagestring($im, 3, 230, 180, "GOVERNMENT CODE: {$govCode}", $textMuted);
    imagestring($im, 4, 230, 210, "PRIMARY POWER:  {$power}", $borderCyan);
    imagestring($im, 4, 230, 240, "THREAT RATING:  {$tier}", $textWhite);
    imagestring($im, 3, 230, 270, "JURISDICTION:   {$sector}", $textMuted);
    imagestring($im, 4, 230, 300, "LICENSE NO:     {$license}", $textGreen);

    // Bottom Security Bar
    imagefilledrectangle($im, 20, 360, $w - 20, 460, $headerBg);
    imagestring($im, 3, 40, 375, "CHIP ID: " . strtoupper(bin2hex(random_bytes(8))), $textMuted);
    imagestring($im, 3, 40, 395, "SECURITY CLEARANCE: ACCORD STANDARD 701-A // TAMPER-EVIDENT RFID", $textMuted);
    imagestring($im, 4, 40, 425, "VALID THROUGH: 2035-12-31 // ISSUED BY MUNICIPAL HIGH COMMAND", $borderCyan);

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
    imagestring($im, 3, 260, 105, "OFFICIAL CERTIFICATE OF OPERATIONAL LICENSURE", $textCyan);

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
    imagestring($im, 4, 120, 310, "and is hereby accredited for active civil service under Municipal Accord Standards.", $textWhite);

    // Seal and Signature Block
    imagerectangle($im, 80, 380, 260, 490, $goldBorder);
    imagestring($im, 4, 105, 410, "[ OFFICIAL SEAL ]", $textGold);
    imagestring($im, 3, 95, 435, "COUNCIL OF SUPREMES", $textMuted);
    imagestring($im, 3, 110, 455, "SECURITY VERIFIED", $textCyan);

    imageline($im, 480, 440, 700, 440, $textWhite);
    imagestring($im, 4, 520, 450, "Commander Vance", $textWhite);
    imagestring($im, 3, 490, 470, "Supreme Authority Commander", $textMuted);

    // Bottom Date
    imagestring($im, 3, 80, 515, "DATE OF ACCREDITATION: " . date('F j, Y'), $textMuted);
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
    $license = $hero['license_number'] ?? 'GHRMS-LIC-PENDING';
    $status = $hero['status'] ?? 'Active';

    $lines = [
        "GLOBAL HERO REGISTRATION AUTHORITY (GHRMS)",
        "CLASSIFIED TACTICAL DOSSIER // AUTHORIZATION PROTOCOL",
        "SECURITY LEVEL: LEVEL 4 ACCORD SPECIFICATION",
        "--------------------------------------------------------------------------------",
        "OPERATIVE IDENTIFICATION:",
        "  Callsign Alias:          {$alias}",
        "  Civilian Legal Name:     {$realName}",
        "  Government Code:         {$govCode}",
        "  Active License Number:   {$license}",
        "  Current Standing:        {$status}",
        "",
        "METAHUMAN CAPABILITIES & THREAT GRADING:",
        "  Primary Power:           {$power}",
        "  Secondary Specialty:     {$secondary}",
        "  Assigned Threat Tier:    {$tier}",
        "  Authorized Sector:       {$sector}",
        "",
        "TACTICAL LIMITS & EMERGENCY MEDICAL PROTOCOLS:",
        "  1. Kinetic dampening protocol authorized for civilian containment.",
        "  2. Non-lethal force mandate applies during municipal standard patrols.",
        "  3. In event of power surge, deploy Sector Response Team 9 immediately.",
        "  4. Emergency medical treatment requires high-clearance trauma bypass.",
        "",
        "OFFICIAL AUDIT VERIFICATION:",
        "  Authenticated by:        Intake Registrar Sarah Chen / Commander Vance",
        "  Chained Ledger Block:    SHA-256 Ledger Record Registered",
        "  Document Date:           " . date('Y-m-d H:i:s T'),
        "--------------------------------------------------------------------------------",
        "RESTRICTED DISCLOSURE: UNAUTHORIZED DUPLICATION PUNISHABLE UNDER ACCORD LAW"
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
echo "Populating rich uploaded files for all heroes...\n";

$heroes = JsonStorage::read(FILE_HEROES, []);
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
            'verification_status' => 'Verified',
            'verified_by' => 'Commander Vance (SUPER_ADMIN)',
            'verification_date' => date('c', strtotime('-14 days')),
            'verification_notes' => 'Federal biometric identity confirmed authentic against vault'
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
            'verification_status' => 'Verified',
            'verified_by' => 'Sarah Chen (REGISTRAR)',
            'verification_date' => date('c', strtotime('-10 days')),
            'verification_notes' => 'Academy metahuman combat and containment certification verified'
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
            'verification_status' => 'Verified',
            'verified_by' => 'Commander Vance (SUPER_ADMIN)',
            'verification_date' => date('c', strtotime('-4 days')),
            'verification_notes' => 'Municipal emergency protocol clearance approved'
        ]
    ];

    $updatedCount++;
    echo "  [OK] Generated 3 documents (ID PNG, Diploma PNG, Dossier PDF) for {$hero['alias']} ({$heroId})\n";
}
unset($hero);

// Save updated heroes to heroes.json
JsonStorage::write(FILE_HEROES, $heroes);

echo "\n[SUCCESS] Successfully generated full documents packet for all {$updatedCount}/{$total} heroes!\n";
