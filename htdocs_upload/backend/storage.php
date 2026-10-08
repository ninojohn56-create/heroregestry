<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

class JsonStorage {
    /**
     * Read JSON file with shared lock
     */
    public static function read(string $filePath, $default = []) {
        if (!file_exists($filePath)) {
            return $default;
        }

        $fp = fopen($filePath, 'rb');
        if (!$fp) {
            return $default;
        }

        flock($fp, LOCK_SH);
        $content = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        if (empty($content)) {
            return $default;
        }

        $data = json_decode($content, true);
        return $data !== null ? $data : $default;
    }

    /**
     * Write JSON file atomically with exclusive lock
     */
    public static function write(string $filePath, $data): bool {
        $dir = dirname($filePath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return false;
        }

        $fp = fopen($filePath, 'c+b');
        if (!$fp) {
            return false;
        }

        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return false;
        }

        rewind($fp);
        $written = fwrite($fp, $json);
        if ($written !== false) {
            ftruncate($fp, strlen($json));
        }
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $written !== false;
    }

    /**
     * Crash-safe atomic write using temporary file swap
     */
    public static function writeSafe(string $filePath, $data): bool {
        $dir = dirname($filePath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return false;
        }

        $tmpFile = tempnam($dir, 'tmp_ghrms_');
        if ($tmpFile === false) {
            return self::write($filePath, $data);
        }

        if (file_put_contents($tmpFile, $json, LOCK_EX) === false) {
            @unlink($tmpFile);
            return false;
        }

        // On Windows rename will fail if target exists and is open, so try rename with fallback
        if (!@rename($tmpFile, $filePath)) {
            $copied = copy($tmpFile, $filePath);
            @unlink($tmpFile);
            return $copied;
        }
        return true;
    }

    /**
     * Update JSON file with a callable inside an exclusive lock
     */
    public static function transaction(string $filePath, callable $modifier, $default = []) {
        $dir = dirname($filePath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $fp = fopen($filePath, 'c+b');
        if (!$fp) {
            throw new RuntimeException("Unable to open file for transaction: {$filePath}");
        }

        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new RuntimeException("Unable to acquire exclusive lock: {$filePath}");
        }

        $content = stream_get_contents($fp);
        $data = !empty($content) ? json_decode($content, true) : $default;
        if ($data === null) {
            $data = $default;
        }

        $result = $modifier($data);

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json !== false) {
            rewind($fp);
            fwrite($fp, $json);
            ftruncate($fp, strlen($json));
            fflush($fp);
        }
        flock($fp, LOCK_UN);
        fclose($fp);

        return $result;
    }
}
