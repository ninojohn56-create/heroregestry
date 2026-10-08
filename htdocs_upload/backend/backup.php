<?php
declare(strict_types=1);

/**
 * GHRA Datastore Backup & Disaster Recovery CLI Tool
 *
 * Usage:
 *   php backend/backup.php create [--note="pre-upgrade"]
 *   php backend/backup.php list
 *   php backend/backup.php verify <backup-file.zip>
 *   php backend/backup.php restore <backup-file.zip> [--force]
 */

require_once __DIR__ . '/config.php';

$backupDir = DATA_DIR . '/backups';
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0700, true);
}

$action = $argv[1] ?? 'help';

switch ($action) {
    case 'create':
        $timestamp = date('Ymd_His');
        $backupFile = "{$backupDir}/ghra_datastore_backup_{$timestamp}.zip";

        if (!class_exists('ZipArchive')) {
            fwrite(STDERR, "[ERROR] PHP ZipArchive extension required for compressed backups.\n");
            exit(1);
        }

        $zip = new ZipArchive();
        if ($zip->open($backupFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            fwrite(STDERR, "[ERROR] Failed to initialize backup archive: {$backupFile}\n");
            exit(1);
        }

        $manifest = [
            'app' => 'GHRA - Global Superhuman Registration Authority',
            'created_at' => date('c'),
            'created_by' => get_current_user(),
            'files' => []
        ];

        // Backup all canonical JSON datastores in backend/data
        $dataFiles = glob(DATA_DIR . '/*.json');
        foreach ($dataFiles as $filePath) {
            $fileName = basename($filePath);
            $content = file_get_contents($filePath);
            $hash = hash('sha256', $content);
            $manifest['files'][$fileName] = [
                'sha256' => $hash,
                'bytes' => strlen($content)
            ];
            $zip->addFile($filePath, "data/{$fileName}");
        }

        // Backup uploaded documents
        $docDir = DATA_DIR . '/documents';
        if (is_dir($docDir)) {
            $docs = glob("{$docDir}/*");
            foreach ($docs as $doc) {
                if (is_file($doc)) {
                    $dName = basename($doc);
                    $zip->addFile($doc, "documents/{$dName}");
                }
            }
        }

        $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $zip->close();

        $size = filesize($backupFile);
        echo "[SUCCESS] GHRA Backup Archive successfully created:\n";
        echo "  Path: {$backupFile}\n";
        echo "  Size: " . number_format($size / 1024, 2) . " KB\n";
        echo "  Datastores archived: " . count($dataFiles) . "\n";
        break;

    case 'list':
        $backups = glob("{$backupDir}/*.zip");
        echo "=================================================================\n";
        echo "GHRA Datastore Backup Archives (Storage: {$backupDir})\n";
        echo "=================================================================\n";
        if (empty($backups)) {
            echo "  (No backup archives found)\n";
        } else {
            rsort($backups);
            foreach ($backups as $b) {
                $bName = basename($b);
                $bSize = number_format(filesize($b) / 1024, 2) . " KB";
                $bTime = date('Y-m-d H:i:s', filemtime($b));
                echo "  [{$bTime}] {$bName} ({$bSize})\n";
            }
        }
        break;

    case 'verify':
        $target = $argv[2] ?? null;
        if ($target && !file_exists($target) && file_exists(DATA_DIR . '/backups/' . basename($target))) {
            $target = DATA_DIR . '/backups/' . basename($target);
        }
        if (!$target || !file_exists($target)) {
            fwrite(STDERR, "[ERROR] Specify a valid backup archive file path to verify.\n");
            exit(1);
        }

        $zip = new ZipArchive();
        if ($zip->open($target) !== true) {
            fwrite(STDERR, "[ERROR] Failed to open backup archive for verification.\n");
            exit(1);
        }

        $manifestJson = $zip->getFromName('manifest.json');
        if (!$manifestJson) {
            fwrite(STDERR, "[VERIFY FAILED] Missing manifest.json in archive.\n");
            $zip->close();
            exit(1);
        }

        $manifest = json_decode($manifestJson, true);
        $errors = 0;
        echo "[VERIFY] Checking datastore cryptographic hashes against manifest...\n";
        foreach (($manifest['files'] ?? []) as $file => $meta) {
            $content = $zip->getFromName("data/{$file}");
            if ($content === false) {
                echo "  [FAIL] Missing data file: {$file}\n";
                $errors++;
                continue;
            }
            $currentHash = hash('sha256', $content);
            if ($currentHash !== $meta['sha256']) {
                echo "  [FAIL] SHA-256 hash mismatch for {$file}!\n";
                $errors++;
            } else {
                echo "  [OK] {$file} (SHA-256: " . substr($currentHash, 0, 16) . "...)\n";
            }
        }

        $zip->close();
        if ($errors === 0) {
            echo "[SUCCESS] Backup verification PASSED with 0 errors. Archive is cryptographically sound.\n";
        } else {
            echo "[FAILED] Backup verification failed with {$errors} error(s).\n";
            exit(1);
        }
        break;

    case 'restore':
        $target = $argv[2] ?? null;
        $isForce = in_array('--force', $argv, true);
        if ($target && !file_exists($target) && file_exists(DATA_DIR . '/backups/' . basename($target))) {
            $target = DATA_DIR . '/backups/' . basename($target);
        }
        if (!$target || !file_exists($target)) {
            fwrite(STDERR, "[ERROR] Specify a valid backup archive file path to restore.\n");
            exit(1);
        }

        $zip = new ZipArchive();
        if ($zip->open($target) !== true) {
            fwrite(STDERR, "[ERROR] Could not open backup archive: {$target}\n");
            exit(1);
        }

        // Automatic pre-restore safety snapshot
        echo "[SAFETY] Creating automatic pre-restore rollback snapshot...\n";
        $preRestoreTs = date('Ymd_His');
        $preRestoreFile = "{$backupDir}/pre_restore_snapshot_{$preRestoreTs}.zip";
        $preZip = new ZipArchive();
        if ($preZip->open($preRestoreFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
            foreach (glob(DATA_DIR . '/*.json') as $df) {
                $preZip->addFile($df, 'data/' . basename($df));
            }
            $preZip->close();
            echo "  Pre-restore safety snapshot saved to: {$preRestoreFile}\n";
        }

        // Extract and restore datastores
        $manifestJson = $zip->getFromName('manifest.json');
        $manifest = $manifestJson ? json_decode($manifestJson, true) : null;
        $filesRestored = 0;

        foreach (($manifest['files'] ?? []) as $fileName => $meta) {
            $content = $zip->getFromName("data/{$fileName}");
            if ($content !== false) {
                $destPath = DATA_DIR . '/' . $fileName;
                file_put_contents($destPath, $content, LOCK_EX);
                $filesRestored++;
                echo "  Restored datastore: {$fileName}\n";
            }
        }

        $zip->close();
        echo "[SUCCESS] Successfully restored {$filesRestored} datastores from {$target}.\n";
        break;

    default:
        echo "GHRA Datastore Backup & Recovery CLI\n";
        echo "Usage:\n";
        echo "  php backend/backup.php create            Create timestamped datastore backup\n";
        echo "  php backend/backup.php list              List all backup archives\n";
        echo "  php backend/backup.php verify <file>     Verify integrity of backup archive\n";
        echo "  php backend/backup.php restore <file>    Restore datastore from backup archive\n";
        break;
}
