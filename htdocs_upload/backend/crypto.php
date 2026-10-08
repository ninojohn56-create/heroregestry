<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';

class CryptoService {
    /**
     * Derive isolated cryptographic HMAC authentication key from master key
     */
    private static function getMacKey(): string {
        return hash_hmac('sha256', 'GHRA_VAULT_HMAC_AUTHENTICATION_KEY', AES_KEY, true);
    }

    /**
     * Encrypt identity bio-data into an isolated vault record using Encrypt-then-MAC
     */
    public static function encryptVault(array $bioData): array {
        $iv = random_bytes(16);
        $payload = json_encode($bioData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $ciphertext = openssl_encrypt($payload, AES_CIPHER, AES_KEY, OPENSSL_RAW_DATA, $iv);

        if ($ciphertext === false) {
            throw new RuntimeException("Vault encryption failed.");
        }

        $mac = hash_hmac('sha256', $iv . $ciphertext, self::getMacKey());
        $vaultId = 'vlt_' . bin2hex(random_bytes(8));
        $record = [
            'vault_id' => $vaultId,
            'ciphertext' => base64_encode($ciphertext),
            'iv' => base64_encode($iv),
            'mac' => $mac,
            'algo' => 'AES-256-CBC+HMAC-SHA256',
            'created_at' => date('c'),
            'updated_at' => date('c')
        ];

        JsonStorage::transaction(FILE_VAULT, function (&$vault) use ($vaultId, $record) {
            if (!is_array($vault)) {
                $vault = [];
            }
            $vault[$vaultId] = $record;
        }, []);

        return [
            'vault_id' => $vaultId,
            'status' => 'encrypted'
        ];
    }

    /**
     * Update/re-encrypt existing vault record with Encrypt-then-MAC
     */
    public static function updateVault(string $vaultId, array $bioData): bool {
        $iv = random_bytes(16);
        $payload = json_encode($bioData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $ciphertext = openssl_encrypt($payload, AES_CIPHER, AES_KEY, OPENSSL_RAW_DATA, $iv);

        if ($ciphertext === false) {
            throw new RuntimeException("Vault re-encryption failed.");
        }

        $mac = hash_hmac('sha256', $iv . $ciphertext, self::getMacKey());
        $now = date('c');

        return JsonStorage::transaction(FILE_VAULT, function (&$vault) use ($vaultId, $ciphertext, $iv, $mac, $now) {
            if (!is_array($vault)) {
                $vault = [];
            }
            $createdAt = $vault[$vaultId]['created_at'] ?? $now;
            $vault[$vaultId] = [
                'vault_id' => $vaultId,
                'ciphertext' => base64_encode($ciphertext),
                'iv' => base64_encode($iv),
                'mac' => $mac,
                'algo' => 'AES-256-CBC+HMAC-SHA256',
                'created_at' => $createdAt,
                'updated_at' => $now
            ];
            return true;
        }, false);
    }

    /**
     * Decrypt and verify integrity of vault record
     */
    public static function decryptVault(string $vaultId): ?array {
        $vault = JsonStorage::read(FILE_VAULT, []);
        if (!isset($vault[$vaultId])) {
            return null;
        }

        $record = $vault[$vaultId];
        $ciphertext = base64_decode($record['ciphertext']);
        $iv = base64_decode($record['iv']);

        // Authenticated Encryption Verification (Encrypt-then-MAC)
        if (!empty($record['mac'])) {
            $expectedMac = hash_hmac('sha256', $iv . $ciphertext, self::getMacKey());
            if (!hash_equals($expectedMac, (string)$record['mac'])) {
                self::appendAudit('VAULT_ENGINE', 'SYSTEM', 'VAULT_INTEGRITY_VIOLATION', $vaultId, [
                    'reason' => 'MAC verification failed: ciphertext or IV tampered'
                ]);
                return null;
            }
        }

        $decrypted = openssl_decrypt($ciphertext, AES_CIPHER, AES_KEY, OPENSSL_RAW_DATA, $iv);
        if ($decrypted === false) {
            return null;
        }

        return json_decode($decrypted, true);
    }

    /**
     * Migrate all existing legacy unauthenticated vault records to Encrypt-then-MAC
     */
    public static function migrateVaultHmac(): int {
        return (int)JsonStorage::transaction(FILE_VAULT, function (&$vault) {
            if (!is_array($vault)) return 0;
            $macKey = self::getMacKey();
            $migrated = 0;
            foreach ($vault as $vid => &$rec) {
                if (empty($rec['mac']) && !empty($rec['ciphertext']) && !empty($rec['iv'])) {
                    $ciphertext = base64_decode($rec['ciphertext']);
                    $iv = base64_decode($rec['iv']);
                    $rec['mac'] = hash_hmac('sha256', $iv . $ciphertext, $macKey);
                    $rec['algo'] = 'AES-256-CBC+HMAC-SHA256';
                    $migrated++;
                }
            }
            unset($rec);
            return $migrated;
        }, 0);
    }

    /**
     * Generate dynamic time-decaying TOTP token (30-second window)
     */
    public static function generateBadgeToken(string $heroId, string $badgeSecret, int $timeStep = 30): array {
        $now = time();
        $counter = (int) floor($now / $timeStep);
        $timeRemaining = $timeStep - ($now % $timeStep);

        // Compute 6-digit numeric token from HMAC-SHA256
        $data = pack('N*', 0, $counter);
        $hash = hash_hmac('sha256', $data, $badgeSecret, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $binary = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        );
        $token = str_pad((string)($binary % 1000000), 6, '0', STR_PAD_LEFT);

        // Verification signature embedding
        $signature = hash_hmac('sha256', "HRS-BADGE:{$heroId}:{$counter}:{$token}", $badgeSecret);

        $qrData = [
            'sys' => 'HRS-HERO-GOV',
            'hid' => $heroId,
            'tok' => $token,
            'win' => $counter,
            'sig' => substr($signature, 0, 16)
        ];

        return [
            'hero_id' => $heroId,
            'token' => $token,
            'expires_in' => $timeRemaining,
            'time_step' => $timeStep,
            'counter' => $counter,
            'qr_payload' => json_encode($qrData)
        ];
    }

    /**
     * Verify dynamic badge token with clock drift tolerance (+- 1 window)
     */
    public static function verifyBadgeToken(string $heroId, string $badgeSecret, string $inputToken, int $timeStep = 30): array {
        $now = time();
        $currentCounter = (int) floor($now / $timeStep);
        $timeRemaining = $timeStep - ($now % $timeStep);

        // Check window -1, 0, +1
        for ($offset = -1; $offset <= 1; $offset++) {
            $c = $currentCounter + $offset;
            $data = pack('N*', 0, $c);
            $hash = hash_hmac('sha256', $data, $badgeSecret, true);
            $byteOffset = ord(substr($hash, -1)) & 0x0F;
            $binary = (
                ((ord($hash[$byteOffset]) & 0x7F) << 24) |
                ((ord($hash[$byteOffset + 1]) & 0xFF) << 16) |
                ((ord($hash[$byteOffset + 2]) & 0xFF) << 8) |
                (ord($hash[$byteOffset + 3]) & 0xFF)
            );
            $validToken = str_pad((string)($binary % 1000000), 6, '0', STR_PAD_LEFT);

            if (hash_equals($validToken, trim($inputToken))) {
                return [
                    'valid' => true,
                    'drift_window' => $offset,
                    'expires_in' => $timeRemaining,
                    'timestamp' => date('c')
                ];
            }
        }

        return [
            'valid' => false,
            'reason' => 'Token mismatch or expired time window',
            'timestamp' => date('c')
        ];
    }

    /**
     * Append record to the cryptographic SHA-256 chained audit ledger
     */
    public static function appendAudit(string $actor, string $role, string $action, string $targetId, array $details): array {
        return JsonStorage::transaction(FILE_AUDIT, function (&$ledger) use ($actor, $role, $action, $targetId, $details) {
            if (!is_array($ledger)) {
                $ledger = [];
            }

            $count = count($ledger);
            $prevHash = $count > 0 ? $ledger[$count - 1]['hash'] : str_repeat('0', 64);
            $timestamp = date('c');
            $id = 'evt_' . bin2hex(random_bytes(6));

            $detailsJson = json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $hashMaterial = "{$prevHash}|{$timestamp}|{$actor}|{$role}|{$action}|{$targetId}|{$detailsJson}";
            $hash = hash('sha256', $hashMaterial);

            $entry = [
                'id' => $id,
                'timestamp' => $timestamp,
                'actor' => $actor,
                'role' => $role,
                'action' => $action,
                'target_id' => $targetId,
                'details' => $details,
                'prev_hash' => $prevHash,
                'hash' => $hash
            ];

            $ledger[] = $entry;
            return $entry;
        }, []);
    }

    /**
     * Verify integrity of the entire audit chain
     */
    public static function verifyAuditChain(): array {
        $ledger = JsonStorage::read(FILE_AUDIT, []);
        $brokenAt = null;
        $total = count($ledger);

        for ($i = 0; $i < $total; $i++) {
            $entry = $ledger[$i];
            $expectedPrev = $i === 0 ? str_repeat('0', 64) : $ledger[$i - 1]['hash'];

            if ($entry['prev_hash'] !== $expectedPrev) {
                return ['valid' => false, 'broken_index' => $i, 'reason' => 'Previous hash mismatch'];
            }

            $detailsJson = json_encode($entry['details'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $hashMaterial = "{$entry['prev_hash']}|{$entry['timestamp']}|{$entry['actor']}|{$entry['role']}|{$entry['action']}|{$entry['target_id']}|{$detailsJson}";
            $expectedHash = hash('sha256', $hashMaterial);

            if ($entry['hash'] !== $expectedHash) {
                return ['valid' => false, 'broken_index' => $i, 'reason' => 'Hash tampering detected'];
            }
        }

        return ['valid' => true, 'total_verified' => $total];
    }
}
