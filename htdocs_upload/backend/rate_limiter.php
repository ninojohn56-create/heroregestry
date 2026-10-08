<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

class RateLimiter {
    private static string $storageDir = DATA_DIR . '/ratelimit';

    /**
     * Enforce rate limiting for an action by IP address.
     * Throws HTTP 429 and terminates request if limit exceeded.
     */
    public static function check(string $action, int $maxAttempts = 60, int $windowSeconds = 60): void {
        // Skip rate limiting in CLI mode or unit tests
        if (php_sapi_name() === 'cli') {
            return;
        }

        if (!is_dir(self::$storageDir)) {
            @mkdir(self::$storageDir, 0700, true);
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $trustProxy = filter_var(getenv('TRUST_PROXIES') ?: false, FILTER_VALIDATE_BOOLEAN);

        if ($trustProxy) {
            $proxyIp = $_SERVER['HTTP_CF_CONNECTING_IP']
                ?? $_SERVER['HTTP_X_FORWARDED_FOR']
                ?? null;

            if ($proxyIp) {
                if (str_contains($proxyIp, ',')) {
                    $parts = explode(',', $proxyIp);
                    $ip = trim($parts[0]);
                } else {
                    $ip = trim($proxyIp);
                }
            }
        }

        $sanitizedIp = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $ip);
        $key = preg_replace('/[^a-zA-Z0-9_-]/', '_', $action . '_' . $sanitizedIp);
        $filePath = self::$storageDir . '/' . hash('sha256', $key) . '.json';

        $now = time();
        $attempts = [];

        if (file_exists($filePath)) {
            $raw = @file_get_contents($filePath);
            $data = $raw ? json_decode($raw, true) : null;
            if (is_array($data)) {
                $attempts = array_filter($data, static fn($ts) => is_int($ts) && ($now - $ts) < $windowSeconds);
            }
        }

        if (count($attempts) >= $maxAttempts) {
            $oldestAttempt = !empty($attempts) ? min($attempts) : $now;
            $retryAfter = max(1, $windowSeconds - ($now - $oldestAttempt));

            http_response_code(429);
            header('Content-Type: application/json; charset=UTF-8');
            header("Retry-After: {$retryAfter}");
            echo json_encode([
                'success' => false,
                'error' => "TOO MANY REQUESTS: Rate limit exceeded for '{$action}'. Retry in {$retryAfter}s.",
                'code' => 'RATE_LIMIT_EXCEEDED',
                'retry_after' => $retryAfter
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }

        $attempts[] = $now;
        @file_put_contents($filePath, json_encode(array_values($attempts)), LOCK_EX);

        // Opportunistic garbage collection (1% chance per request) to prevent inode accumulation
        if (mt_rand(1, 100) === 1) {
            self::purgeStaleRateLimitFiles();
        }
    }

    /**
     * Purge rate limit files untouched for over 1 hour
     */
    private static function purgeStaleRateLimitFiles(): void {
        if (!is_dir(self::$storageDir)) return;
        $files = @scandir(self::$storageDir);
        if (!$files) return;
        $threshold = time() - 3600;
        foreach ($files as $f) {
            if ($f === '.' || $f === '..' || !str_ends_with($f, '.json')) continue;
            $full = self::$storageDir . '/' . $f;
            if (@filemtime($full) < $threshold) {
                @unlink($full);
            }
        }
    }

    /**
     * Reset rate limit bucket for an action
     */
    public static function reset(string $action, ?string $ip = null): void {
        $ip = $ip ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $sanitizedIp = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $ip);
        $key = preg_replace('/[^a-zA-Z0-9_-]/', '_', $action . '_' . $sanitizedIp);
        $filePath = self::$storageDir . '/' . hash('sha256', $key) . '.json';
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }
}
