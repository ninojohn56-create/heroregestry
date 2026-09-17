<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/crypto.php';

if (php_sapi_name() === 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    echo "Re-seeding GHRMS Hero Registration System Data matching official UI...\n";
}

$seedHeroesData = [
    [
        'id' => 'hero_apex_01',
        'alias' => 'APEX',
        'avatar' => '/img/apex.jpg',
        'gov_code' => '9GH-8430',
        'real_bio' => [
            'real_name' => 'Samuel Wright',
            'gov_id' => 'FED-9GH-8430',
            'age' => 34,
            'dob' => 'Aug. 21, 1983',
            'location' => 'NYC - Sector 1 Metro',
            'biometric_dna_ref' => 'APX-998-CYBER-KINETIC',
            'safehouse_address' => '742 Lexington Ave, Penthouse 44, New York, NY',
            'handler_contact' => '+1 (555) 839-4910'
        ],
        'primary_power' => 'Enhanced Strength',
        'primary_level' => 'Level 8/10',
        'primary_pct' => 80,
        'secondary_power' => 'Flight',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'A-Class',
        'threat_tier' => 2,
        'threat_tier_label' => 'A-Class (Continental)',
        'region' => 'Sector 1 - Metro Downtown',
        'status' => 'REVIEWING', // In UI: REVIEWING
        'license_number' => 'GHRMS-LIC-9GH-8430',
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => ['Aero Scout'],
        'mentor' => null,
        'coordinates' => ['lat' => 40.7128, 'lng' => -74.0060, 'grid' => 'MTR-8430'],
        'created_at' => date('c', strtotime('-2 days')),
        'emergency_contacts' => [
            ['name' => 'Dr. Karen Wright', 'relation' => 'Spouse', 'phone' => '+1 (555) 012-9844']
        ]
    ],
    [
        'id' => 'hero_lumina_02',
        'alias' => 'LUMINA',
        'avatar' => '/img/lumina.jpg',
        'gov_code' => '9GH-8431',
        'real_bio' => [
            'real_name' => 'Alice Vance',
            'gov_id' => 'FED-9GH-8431',
            'age' => 28,
            'dob' => 'May 14, 1989',
            'location' => 'Sector 5 High-Tech Valley',
            'biometric_dna_ref' => 'LUM-114-TECHNO-ARC',
            'safehouse_address' => '500 Innovation Parkway, Sub-grid 2',
            'handler_contact' => '+1 (555) 019-3321'
        ],
        'primary_power' => 'Technomancy',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Energy Shielding',
        'secondary_level' => 'Level 7/10',
        'secondary_pct' => 70,
        'threat_class' => 'A-Class',
        'threat_tier' => 2,
        'threat_tier_label' => 'A-Class (Continental)',
        'region' => 'Sector 5 - High-Tech Valley',
        'status' => 'REVIEWING',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => ['Byte'],
        'mentor' => 'APEX',
        'coordinates' => ['lat' => 40.7589, 'lng' => -73.9851, 'grid' => 'TEC-8431'],
        'created_at' => date('c', strtotime('-3 days')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_atlas_03',
        'alias' => 'ATLAS',
        'avatar' => '/img/atlas.jpg',
        'gov_code' => '9GH-8432',
        'real_bio' => [
            'real_name' => 'Marcus Thorne',
            'gov_id' => 'FED-9GH-8432',
            'age' => 38,
            'dob' => 'Jan. 09, 1980',
            'location' => 'Sector 2 Industrial',
            'biometric_dna_ref' => 'ATL-701-TITAN-CORE',
            'safehouse_address' => '220 Foundry Row, Heavy Silo B',
            'handler_contact' => '+1 (555) 014-9988'
        ],
        'primary_power' => 'Super Strength',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Kinetic Redirection',
        'secondary_level' => 'Level 5/10',
        'secondary_pct' => 50,
        'threat_class' => 'B-Class',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Class (Regional)',
        'region' => 'Sector 2 - Industrial District',
        'status' => 'REVIEWING',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 40.7306, 'lng' => -73.9352, 'grid' => 'IND-8432'],
        'created_at' => date('c', strtotime('-5 days')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_steelpulse_04',
        'alias' => 'STEEL PULSE',
        'avatar' => '/img/atlas.jpg',
        'gov_code' => '9GH-8433',
        'real_bio' => [
            'real_name' => 'Ravi Singh',
            'gov_id' => 'FED-9GH-8433',
            'age' => 31,
            'dob' => 'Nov. 30, 1986',
            'location' => 'Sector 4 Coastal Wharf',
            'biometric_dna_ref' => 'STL-442-ENERGY-PULSE',
            'safehouse_address' => 'Pier 12 Harbor Facility, Unit 9',
            'handler_contact' => '+1 (555) 017-4400'
        ],
        'primary_power' => 'Energy Projection',
        'primary_level' => 'Level 7/10',
        'primary_pct' => 70,
        'secondary_power' => 'Concussive Force',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'C-Class',
        'threat_tier' => 4,
        'threat_tier_label' => 'C-Class (City)',
        'region' => 'Sector 4 - Coastal Wharf',
        'status' => 'REVIEWING',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => ['Pulse Runner'],
        'mentor' => 'ATLAS',
        'coordinates' => ['lat' => 40.6782, 'lng' => -74.0445, 'grid' => 'CST-8433'],
        'created_at' => date('c', strtotime('-6 days')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_vanguard_05',
        'alias' => 'VANGUARD TITAN',
        'avatar' => '/img/apex.jpg',
        'gov_code' => '9GH-0042',
        'real_bio' => [
            'real_name' => 'Marcus Jonathan Vance',
            'gov_id' => 'FED-904-22-8110',
            'age' => 41,
            'dob' => 'Oct. 12, 1977',
            'location' => 'Sector 1 Downtown Metro',
            'biometric_dna_ref' => 'VNG-001-ALPHA-PRIME',
            'safehouse_address' => '442 Ironworks Ave, Sub-level 3',
            'handler_contact' => '+1 (555) 019-2834'
        ],
        'primary_power' => 'Kinetic Mastery',
        'primary_level' => 'Level 10/10',
        'primary_pct' => 100,
        'secondary_power' => 'Bio-enhancement',
        'secondary_level' => 'Level 8/10',
        'secondary_pct' => 80,
        'threat_class' => 'S-Class',
        'threat_tier' => 1,
        'threat_tier_label' => 'S-Class (Planetary)',
        'region' => 'Sector 1 - Metro Downtown',
        'status' => 'Licensed',
        'license_number' => 'GHRMS-LIC-0042',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'green',
        'sidekicks' => ['Aero Scout', 'Shadow Dart'],
        'mentor' => null,
        'coordinates' => ['lat' => 40.7128, 'lng' => -74.0060, 'grid' => 'MTR-0042'],
        'created_at' => date('c', strtotime('-1 year')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_specter_06',
        'alias' => 'SPECTER ZERO',
        'avatar' => '/img/apex.jpg',
        'gov_code' => '9GH-0099',
        'real_bio' => [
            'real_name' => 'Unit 09 / David Alan Cross',
            'gov_id' => 'FED-000-XX-ROGUE',
            'age' => 36,
            'dob' => 'Unverified',
            'location' => 'Sector 4 Coastal Derelict',
            'biometric_dna_ref' => 'CYB-00X-REDACTED',
            'safehouse_address' => 'Pier 19 Abandoned Naval Silo',
            'handler_contact' => 'DISAVOWED'
        ],
        'primary_power' => 'Cybernetic Railgun',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Invisibility Cloak',
        'secondary_level' => 'Level 8/10',
        'secondary_pct' => 80,
        'threat_class' => 'A-Class',
        'threat_tier' => 1,
        'threat_tier_label' => 'A-Class (Planetary)',
        'region' => 'Sector 4 - Coastal Wharf',
        'status' => 'Rogue',
        'license_number' => 'GHRMS-REVOKED-0099',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'red',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 40.6800, 'lng' => -74.0410, 'grid' => 'CST-0099'],
        'created_at' => date('c', strtotime('-6 months')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_solaris_a833dd',
        'alias' => 'SOLARIS',
        'avatar' => '/img/solaris.jpg',
        'gov_code' => '9GH-9988',
        'real_bio' => [
            'real_name' => 'Elena Rostova',
            'gov_id' => 'FED-SOL-9988',
            'age' => 29,
            'dob' => 'July 18, 1996',
            'location' => 'Sector 3 Commercial Outskirts',
            'biometric_dna_ref' => 'SOL-882-PLASMA-AMBER',
            'safehouse_address' => 'Bunker 14 Sub-Level, Sector 3',
            'handler_contact' => 'FLAGGED_MONITORING'
        ],
        'primary_power' => 'Thermonuclear Plasma',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Solar Flare Disruption',
        'secondary_level' => 'Level 8/10',
        'secondary_pct' => 80,
        'threat_class' => 'A-Class',
        'threat_tier' => 1,
        'threat_tier_label' => 'A-Class (Planetary)',
        'region' => 'Sector 3 - Commercial Hub',
        'status' => 'Rogue',
        'license_number' => 'GHRMS-REVOKED-SOL88',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'red',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 40.7500, 'lng' => -73.9900, 'grid' => 'COM-9988'],
        'created_at' => date('c', strtotime('-2 months')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_aeroscout_07',
        'alias' => 'AERO SCOUT',
        'avatar' => '/img/aeroscout.jpg',
        'gov_code' => '9GH-7701',
        'real_bio' => [
            'real_name' => 'Leo Sterling',
            'gov_id' => 'FED-AER-7701',
            'age' => 21,
            'dob' => 'March 04, 2004',
            'location' => 'Sector 1 Metro Downtown',
            'biometric_dna_ref' => 'AER-102-GLIDE-SPEED',
            'safehouse_address' => 'Lexington Apprentice Quarters, Unit 12',
            'handler_contact' => '+1 (555) 012-9844'
        ],
        'primary_power' => 'High-Velocity Gliding',
        'primary_level' => 'Level 7/10',
        'primary_pct' => 70,
        'secondary_power' => 'Aerial Reconnaissance',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'B-Class',
        'threat_tier' => 4,
        'threat_tier_label' => 'B-Class (City)',
        'region' => 'Sector 1 - Metro Downtown',
        'status' => 'Licensed',
        'license_number' => 'GHRMS-LIC-AER-7701',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'green',
        'sidekicks' => [],
        'mentor' => 'APEX',
        'role_tag' => 'Sidekick',
        'coordinates' => ['lat' => 40.7135, 'lng' => -74.0045, 'grid' => 'MTR-7701'],
        'created_at' => date('c', strtotime('-4 months')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_pulserunner_08',
        'alias' => 'PULSE RUNNER',
        'avatar' => '/img/atlas.jpg',
        'gov_code' => '9GH-7702',
        'real_bio' => [
            'real_name' => 'Maya Lin',
            'gov_id' => 'FED-PLS-7702',
            'age' => 23,
            'dob' => 'October 11, 2002',
            'location' => 'Sector 2 Industrial District',
            'biometric_dna_ref' => 'PLS-441-KINETIC-SPRINT',
            'safehouse_address' => 'Heavy Silo Annex, Bed 4',
            'handler_contact' => '+1 (555) 014-9988'
        ],
        'primary_power' => 'Kinetic Acceleration',
        'primary_level' => 'Level 7/10',
        'primary_pct' => 70,
        'secondary_power' => 'Shockwave Stomp',
        'secondary_level' => 'Level 5/10',
        'secondary_pct' => 50,
        'threat_class' => 'C-Class',
        'threat_tier' => 4,
        'threat_tier_label' => 'C-Class (City)',
        'region' => 'Sector 2 - Industrial District',
        'status' => 'Under Review',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => [],
        'mentor' => 'ATLAS',
        'role_tag' => 'Sidekick',
        'coordinates' => ['lat' => 40.7310, 'lng' => -73.9360, 'grid' => 'IND-7702'],
        'created_at' => date('c', strtotime('-10 days')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_johnckson_887ff2',
        'alias' => 'JOHN CKSON',
        'avatar' => '/img/apex.jpg',
        'gov_code' => '9GH-887F',
        'real_bio' => [
            'real_name' => 'John Ckson',
            'gov_id' => 'FED-JCK-887F',
            'age' => 32,
            'dob' => 'May 22, 1993',
            'location' => 'Sector 1 - Metro Downtown',
            'biometric_dna_ref' => 'JCK-887-PHOTONIC',
            'safehouse_address' => '310 Broadway Ave, Apt 11',
            'handler_contact' => '+1 (555) 011-3388'
        ],
        'primary_power' => 'Photonic Manipulation',
        'primary_level' => 'Level 8/10',
        'primary_pct' => 80,
        'secondary_power' => 'Refractive Defense',
        'secondary_level' => 'Level 7/10',
        'secondary_pct' => 70,
        'threat_class' => 'B-Class',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Class (Regional)',
        'region' => 'Sector 1 - Metro Downtown',
        'status' => 'Licensed',
        'license_number' => 'GHRMS-LIC-JCK-887F',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'green',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 40.7140, 'lng' => -74.0070, 'grid' => 'MTR-887F'],
        'created_at' => date('c', strtotime('-1 month')),
        'emergency_contacts' => []
    ],
    [
        'id' => 'hero_dawn_4c5106',
        'alias' => 'DAWN',
        'avatar' => '/img/lumina.jpg',
        'gov_code' => '9GH-4C51',
        'real_bio' => [
            'real_name' => 'Dawn Miller',
            'gov_id' => 'FED-DWN-4C51',
            'age' => 26,
            'dob' => 'December 08, 1998',
            'location' => 'Sector 5 - High-Tech Valley',
            'biometric_dna_ref' => 'DWN-4C5-RADIANT',
            'safehouse_address' => '101 Horizon Way, Unit 4B',
            'handler_contact' => '+1 (555) 019-4411'
        ],
        'primary_power' => 'Radiant Light Shielding',
        'primary_level' => 'Level 8/10',
        'primary_pct' => 80,
        'secondary_power' => 'Thermal Healing',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'B-Class',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Class (Regional)',
        'region' => 'Sector 5 - High-Tech Valley',
        'status' => 'Under Review',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 40.7600, 'lng' => -73.9840, 'grid' => 'TEC-4C51'],
        'created_at' => date('c', strtotime('-5 days')),
        'emergency_contacts' => []
    ]
];

function seedGHRMSData(): array {
    global $seedHeroesData;
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0755, true);
    }

    $heroes = [];
    foreach ($seedHeroesData as $s) {
        $vaultRes = CryptoService::encryptVault($s['real_bio']);
        $heroRecord = $s;
        $heroRecord['real_name'] = $s['real_bio']['real_name'] ?? $s['alias'];
        unset($heroRecord['real_bio']);
        $heroRecord['vault_id'] = $vaultRes['vault_id'];
        $heroes[$s['id']] = $heroRecord;
    }

    JsonStorage::write(FILE_HEROES, $heroes);

    // Seed incidents
    $incidents = [
        [
            'id' => 'inc_2026_01',
            'title' => 'Bridge Structural Fracture - Shockwave Impact',
            'region' => 'Sector 1 - Metro Downtown',
            'coordinates' => ['lat' => 40.7100, 'lng' => -74.0020],
            'power_type' => 'Enhanced Strength',
            'severity' => 'High',
            'estimated_damage_usd' => 350000,
            'reported_by_hero' => 'hero_apex_01',
            'matched_hero_alias' => 'APEX',
            'civic_recovery_status' => 'Claim Approved - Fund Allocated',
            'photo_evidence' => 'concrete_fracture_01.jpg',
            'notes' => 'Structural pier stabilization required after neutralizing rogue kinetic assailant.',
            'timestamp' => date('c', strtotime('-3 days'))
        ],
        [
            'id' => 'inc_2026_02',
            'title' => 'Grid Substation Surge & Arc Discharge',
            'region' => 'Sector 2 - Industrial District',
            'coordinates' => ['lat' => 40.7320, 'lng' => -73.9400],
            'power_type' => 'Technomancy',
            'severity' => 'Critical',
            'estimated_damage_usd' => 820000,
            'reported_by_hero' => 'hero_lumina_02',
            'matched_hero_alias' => 'LUMINA',
            'civic_recovery_status' => 'Pending Assessor Review',
            'photo_evidence' => 'electrical_burn_grid.jpg',
            'notes' => 'Thermal containment failure during unverified high-output combat.',
            'timestamp' => date('c', strtotime('-18 hours'))
        ],
        [
            'id' => 'inc_2026_03',
            'title' => 'Pier 14 Craneway Collapse',
            'region' => 'Sector 4 - Coastal Wharf',
            'coordinates' => ['lat' => 40.6800, 'lng' => -74.0410],
            'power_type' => 'Energy Projection',
            'severity' => 'Severe',
            'estimated_damage_usd' => 540000,
            'reported_by_hero' => 'hero_steelpulse_04',
            'matched_hero_alias' => 'STEEL PULSE',
            'civic_recovery_status' => 'Pending Civic Review',
            'photo_evidence' => 'pier_collapse.jpg',
            'notes' => 'High-velocity energy rounds cleaved crane anchors during defense.',
            'timestamp' => date('c', strtotime('-1 day'))
        ]
    ];
    JsonStorage::write(FILE_INCIDENTS, $incidents);

    // Seed settings
    $settings = [
        'system_alert_level' => 'ELEVATED - OMEGA-3',
        'rogue_broadcast_active' => false,
        'rogue_broadcast_message' => 'ATTENTION ALL OPERATIVES: Sector 4 Containment Active. Standby for Registry directives.',
        'containment_zones' => [
            [
                'id' => 'zone_cst_alpha',
                'name' => 'Zone Alpha - Coastal Quarantine',
                'center' => ['lat' => 40.6782, 'lng' => -74.0445],
                'radius_km' => 2.2,
                'threat_tier' => 1,
                'status' => 'Active Containment'
            ]
        ]
    ];
    JsonStorage::write(FILE_SETTINGS, $settings);

    // Audit ledger genesis
    JsonStorage::write(FILE_AUDIT, []);
    CryptoService::appendAudit('SARAH_CHEN', 'REGISTRAR', 'REGISTRY_INIT', 'GHRMS_CENTRAL', [
        'message' => 'Global Hero Registration Authority online. Active registrar session authenticated.'
    ]);
    CryptoService::appendAudit('SARAH_CHEN', 'REGISTRAR', 'QUEUE_INGESTION', 'hero_apex_01', [
        'alias' => 'APEX',
        'gov_code' => '9GH-8430',
        'status' => 'REVIEWING'
    ]);
    CryptoService::appendAudit('SUPER_ADMIN_01', 'SUPER_ADMIN', 'SECURITY_AUDIT', 'hero_specter_06', [
        'alias' => 'SPECTER ZERO',
        'action' => 'ROGUE_STATUS_FLAGGED'
    ]);

    // Reset pending updates queue
    if (defined('FILE_PENDING')) {
        JsonStorage::write(FILE_PENDING, []);
    }

    // Re-seed standard users and sync hero logins
    require_once __DIR__ . '/auth.php';
    AuthService::seedUsers();
    AuthService::syncHeroUsers();

    return [
        'heroes' => count($heroes),
        'incidents' => count($incidents),
        'audit_entries' => 3
    ];
}

if (php_sapi_name() === 'cli' && realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $result = seedGHRMSData();
    echo "[OK] GHRMS Re-seed complete! Restored " . $result['heroes'] . " heroes, " . $result['incidents'] . " incidents.\n";
}
