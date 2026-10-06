<?php
declare(strict_types=1);

/**
 * GHRA Registration Workflow State Machine
 * Enforces valid lifecycle transitions and role authorization boundaries.
 */
class RegistrationWorkflow {
    public const DRAFT = 'Draft';
    public const SUBMITTED = 'Submitted';
    public const UNDER_REVIEW = 'Under Review';
    public const RETURNED_FOR_CORRECTION = 'Returned for Correction';
    public const VERIFIED = 'Verified';
    public const APPROVED = 'Approved';
    public const LICENSED = 'Licensed';
    public const SUSPENDED = 'Suspended';
    public const REJECTED = 'Rejected';
    public const REVOKED = 'Revoked';

    /**
     * Complete transition matrix: current_state => [allowed_target_states]
     */
    private const TRANSITIONS = [
        self::DRAFT => [
            self::SUBMITTED,
            self::DRAFT
        ],
        self::SUBMITTED => [
            self::UNDER_REVIEW,
            self::RETURNED_FOR_CORRECTION,
            self::REJECTED,
            self::DRAFT
        ],
        self::UNDER_REVIEW => [
            self::VERIFIED,
            self::RETURNED_FOR_CORRECTION,
            self::REJECTED,
            self::SUSPENDED
        ],
        self::RETURNED_FOR_CORRECTION => [
            self::SUBMITTED,
            self::REJECTED
        ],
        self::VERIFIED => [
            self::APPROVED,
            self::LICENSED,
            self::RETURNED_FOR_CORRECTION,
            self::REJECTED,
            self::SUSPENDED
        ],
        self::APPROVED => [
            self::LICENSED,
            self::SUSPENDED,
            self::REVOKED,
            self::UNDER_REVIEW
        ],
        self::LICENSED => [
            self::SUSPENDED,
            self::REVOKED,
            self::UNDER_REVIEW
        ],
        self::SUSPENDED => [
            self::UNDER_REVIEW,
            self::APPROVED,
            self::LICENSED,
            self::REVOKED
        ],
        self::REJECTED => [
            self::UNDER_REVIEW // Must undergo formal reconsideration before approval
        ],
        self::REVOKED => [
            self::UNDER_REVIEW // Must be reopened by Super Admin
        ]
    ];

    /**
     * Validate whether a state transition is legal for the given actor role
     */
    public static function canTransition(string $currentStatus, string $newStatus, string $actorRole): bool {
        // Normalizing legacy equivalents and casing
        $norm = [
            'pending' => self::SUBMITTED,
            'submitted' => self::SUBMITTED,
            'reviewing' => self::UNDER_REVIEW,
            'under_review' => self::UNDER_REVIEW,
            'under review' => self::UNDER_REVIEW,
            'correction' => self::RETURNED_FOR_CORRECTION,
            'returned for correction' => self::RETURNED_FOR_CORRECTION,
            'verified' => self::VERIFIED,
            'approved' => self::APPROVED,
            'licensed' => self::LICENSED,
            'active' => self::LICENSED,
            'suspended' => self::SUSPENDED,
            'rejected' => self::REJECTED,
            'revoked' => self::REVOKED,
            'rogue' => self::REVOKED,
            'draft' => self::DRAFT
        ];
        $currentKey = strtolower(trim($currentStatus));
        $newKey = strtolower(trim($newStatus));
        if (isset($norm[$currentKey])) $currentStatus = $norm[$currentKey];
        if (isset($norm[$newKey])) $newStatus = $norm[$newKey];

        if ($currentStatus === $newStatus) {
            return true;
        }

        // Strict barrier: Rejected or Revoked records CANNOT jump directly to Approved or Licensed
        if (in_array($currentStatus, [self::REJECTED, self::REVOKED], true) &&
            in_array($newStatus, [self::APPROVED, self::LICENSED], true)) {
            return false;
        }

        // Only SUPER_ADMIN can reinstate a Revoked license to Under Review
        if ($currentStatus === self::REVOKED && $actorRole !== 'SUPER_ADMIN') {
            return false;
        }

        // Only SUPER_ADMIN and ADMIN can reinstate Suspended operatives
        if ($currentStatus === self::SUSPENDED && !in_array($actorRole, ['SUPER_ADMIN', 'ADMIN'], true)) {
            return false;
        }

        // Operative role (HERO) can only transition their own record:
        // - Draft -> Submitted
        // - Returned for Correction -> Submitted
        if ($actorRole === 'HERO') {
            return ($currentStatus === self::DRAFT && $newStatus === self::SUBMITTED) ||
                   ($currentStatus === self::RETURNED_FOR_CORRECTION && $newStatus === self::SUBMITTED);
        }

        $allowedTargets = self::TRANSITIONS[$currentStatus] ?? [];
        return in_array($newStatus, $allowedTargets, true);
    }

    /**
     * Assert transition is valid or terminate with HTTP 422 Unprocessable Entity
     */
    public static function assertValidTransition(string $currentStatus, string $newStatus, string $actorRole): void {
        if (!self::canTransition($currentStatus, $newStatus, $actorRole)) {
            http_response_code(422);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'success' => false,
                'error' => "INVALID STATE TRANSITION: Cannot transition operative from '{$currentStatus}' to '{$newStatus}' under clearance role '{$actorRole}'.",
                'code' => 'INVALID_STATE_TRANSITION',
                'current_status' => $currentStatus,
                'target_status' => $newStatus,
                'actor_role' => $actorRole
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }
    }
}
