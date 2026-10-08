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
            'gov_id' => 'ADS-9GH-8430',
            'age' => 34,
            'dob' => 'Aug. 21, 1983',
            'location' => 'Barangay 2 Poblacion, San Francisco, Agusan del Sur',
            'biometric_dna_ref' => 'APX-998-CYBER-KINETIC',
            'safehouse_address' => 'Purok 4, Quezon St., Brgy. 2 Poblacion, San Francisco, ADS',
            'handler_contact' => '+63 (917) 839-4910'
        ],
        'primary_power' => 'Enhanced Strength',
        'primary_level' => 'Level 8/10',
        'primary_pct' => 80,
        'secondary_power' => 'Flight',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'A-Rank',
        'threat_tier' => 2,
        'threat_tier_label' => 'A-Rank Hunter (Fighter)',
        'region' => 'Sector 1 - Poblacion Central Commercial Grid',
        'status' => 'REVIEWING',
        'license_number' => 'GHRMS-LIC-9GH-8430',
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => ['Aero Scout'],
        'mentor' => null,
        'coordinates' => ['lat' => 8.5122, 'lng' => 125.9818, 'grid' => 'SF-POB-8430'],
        'created_at' => date('c', strtotime('-2 days')),
        'emergency_contacts' => [
            ['name' => 'Dr. Karen Wright', 'relation' => 'Spouse', 'phone' => '+63 (917) 012-9844']
        ]
    ],
    
    [
        'id' => 'hero_lumina_02',
        'alias' => 'LUMINA',
        'avatar' => '/img/lumina.jpg',
        'gov_code' => '9GH-8431',
        'real_bio' => [
            'real_name' => 'Alice Vance',
            'gov_id' => 'ADS-9GH-8431',
            'age' => 28,
            'dob' => 'May 14, 1989',
            'location' => 'Barangay Caimpugan Peatland Corridor, San Francisco, ADS',
            'biometric_dna_ref' => 'LUM-114-TECHNO-ARC',
            'safehouse_address' => 'Eco-Research Station 3, Caimpugan Peat Dome, San Francisco, ADS',
            'handler_contact' => '+63 (918) 019-3321'
        ],
        'primary_power' => 'Technomancy',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Energy Shielding',
        'secondary_level' => 'Level 7/10',
        'secondary_pct' => 70,
        'threat_class' => 'A-Rank',
        'threat_tier' => 2,
        'threat_tier_label' => 'A-Rank Hunter (Mage)',
        'region' => 'Sector 5 - Caimpugan Peatland Sanctuary & Marsh Shield',
        'status' => 'REVIEWING',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => ['Byte'],
        'mentor' => 'APEX',
        'coordinates' => ['lat' => 8.4795, 'lng' => 125.9532, 'grid' => 'SF-CAI-8431'],
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
            'gov_id' => 'ADS-9GH-8432',
            'age' => 38,
            'dob' => 'Jan. 09, 1980',
            'location' => 'Barangay Hubang Transport Terminal, San Francisco, ADS',
            'biometric_dna_ref' => 'ATL-701-TITAN-CORE',
            'safehouse_address' => 'Pan-Philippine Highway, Purok 1A, Brgy. Hubang, San Francisco, ADS',
            'handler_contact' => '+63 (919) 014-9988'
        ],
        'primary_power' => 'Super Strength',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Kinetic Redirection',
        'secondary_level' => 'Level 5/10',
        'secondary_pct' => 50,
        'threat_class' => 'B-Rank',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Rank Hunter (Tank)',
        'region' => 'Sector 2 - Hubang Highway & Logistics Corridor',
        'status' => 'REVIEWING',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 8.5276, 'lng' => 125.9752, 'grid' => 'SF-HUB-8432'],
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
            'gov_id' => 'ADS-9GH-8433',
            'age' => 31,
            'dob' => 'Nov. 30, 1986',
            'location' => 'Barangay Bitan-agan River Basin, San Francisco, ADS',
            'biometric_dna_ref' => 'STL-442-ENERGY-PULSE',
            'safehouse_address' => 'River Basin Outpost, Brgy. Bitan-agan, San Francisco, ADS',
            'handler_contact' => '+63 (920) 017-4400'
        ],
        'primary_power' => 'Energy Projection',
        'primary_level' => 'Level 7/10',
        'primary_pct' => 70,
        'secondary_power' => 'Concussive Force',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'B-Rank',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Rank Hunter (Mage)',
        'region' => 'Sector 4 - Bitan-agan & Lapinigan River Basin',
        'status' => 'REVIEWING',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => ['Pulse Runner'],
        'mentor' => 'ATLAS',
        'coordinates' => ['lat' => 8.4912, 'lng' => 125.9870, 'grid' => 'SF-BIT-8433'],
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
            'gov_id' => 'ADS-904-22-8110',
            'age' => 41,
            'dob' => 'Oct. 12, 1977',
            'location' => 'Barangay 3 Poblacion Civic Center, San Francisco, ADS',
            'biometric_dna_ref' => 'VNG-001-ALPHA-PRIME',
            'safehouse_address' => 'Municipal Command Post, Brgy. 3 Poblacion, San Francisco, ADS',
            'handler_contact' => '+63 (917) 019-2834'
        ],
        'primary_power' => 'Kinetic Mastery',
        'primary_level' => 'Level 10/10',
        'primary_pct' => 100,
        'secondary_power' => 'Bio-enhancement',
        'secondary_level' => 'Level 8/10',
        'secondary_pct' => 80,
        'threat_class' => 'S-Rank',
        'threat_tier' => 1,
        'threat_tier_label' => 'S-Rank Hunter (National Tank)',
        'region' => 'Sector 1 - Poblacion Central Commercial Grid',
        'status' => 'Licensed',
        'license_number' => 'GHRMS-LIC-0042',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'green',
        'sidekicks' => ['Aero Scout', 'Shadow Dart'],
        'mentor' => null,
        'coordinates' => ['lat' => 8.5090, 'lng' => 125.9842, 'grid' => 'SF-POB-0042'],
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
            'gov_id' => 'ADS-000-XX-ROGUE',
            'age' => 36,
            'dob' => 'Unverified',
            'location' => 'Barangay Karaos Mountain Ridge, San Francisco, ADS',
            'biometric_dna_ref' => 'CYB-00X-REDACTED',
            'safehouse_address' => 'Highland Forest Watchpost, Brgy. Karaos, San Francisco, ADS',
            'handler_contact' => 'DISAVOWED'
        ],
        'primary_power' => 'Cybernetic Railgun',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Invisibility Cloak',
        'secondary_level' => 'Level 8/10',
        'secondary_pct' => 80,
        'threat_class' => 'S-Rank',
        'threat_tier' => 1,
        'threat_tier_label' => 'S-Rank Criminal Hunter (Assassin)',
        'region' => 'Sector 3 - Karaos & Borbon Uplands District',
        'status' => 'Rogue',
        'license_number' => 'GHRMS-REVOKED-0099',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'red',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 8.5385, 'lng' => 125.9928, 'grid' => 'SF-KAR-0099'],
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
            'gov_id' => 'ADS-SOL-9988',
            'age' => 29,
            'dob' => 'July 18, 1996',
            'location' => 'Barangay Borbon Agro-Solar Array, San Francisco, ADS',
            'biometric_dna_ref' => 'SOL-882-PLASMA-AMBER',
            'safehouse_address' => 'Borbon Ridge Substation, San Francisco, ADS',
            'handler_contact' => 'FLAGGED_MONITORING'
        ],
        'primary_power' => 'Thermonuclear Plasma',
        'primary_level' => 'Level 9/10',
        'primary_pct' => 90,
        'secondary_power' => 'Solar Flare Disruption',
        'secondary_level' => 'Level 8/10',
        'secondary_pct' => 80,
        'threat_class' => 'S-Rank',
        'threat_tier' => 1,
        'threat_tier_label' => 'S-Rank Criminal Hunter (Mage)',
        'region' => 'Sector 3 - Karaos & Borbon Uplands District',
        'status' => 'Rogue',
        'license_number' => 'GHRMS-REVOKED-SOL88',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'red',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 8.5442, 'lng' => 125.9815, 'grid' => 'SF-BOR-9988'],
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
            'gov_id' => 'ADS-AER-7701',
            'age' => 21,
            'dob' => 'March 04, 2004',
            'location' => 'Barangay 1 Poblacion Telemetry Mast, San Francisco, ADS',
            'biometric_dna_ref' => 'AER-102-GLIDE-SPEED',
            'safehouse_address' => 'Rooftop Communications Post, Brgy. 1 Poblacion, San Francisco, ADS',
            'handler_contact' => '+63 (917) 012-9844'
        ],
        'primary_power' => 'High-Velocity Gliding',
        'primary_level' => 'Level 7/10',
        'primary_pct' => 70,
        'secondary_power' => 'Aerial Reconnaissance',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'B-Rank',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Rank Hunter (Ranger)',
        'region' => 'Sector 1 - Poblacion Central Commercial Grid',
        'status' => 'Licensed',
        'license_number' => 'GHRMS-LIC-AER-7701',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'green',
        'sidekicks' => [],
        'mentor' => 'APEX',
        'role_tag' => 'Sidekick',
        'coordinates' => ['lat' => 8.5142, 'lng' => 125.9798, 'grid' => 'SF-POB-7701'],
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
            'gov_id' => 'ADS-PLS-7702',
            'age' => 23,
            'dob' => 'October 11, 2002',
            'location' => 'Barangay Lapinigan Rapid Transit Post, San Francisco, ADS',
            'biometric_dna_ref' => 'PLS-441-KINETIC-SPRINT',
            'safehouse_address' => 'Lapinigan Floodway Station, Brgy. Lapinigan, San Francisco, ADS',
            'handler_contact' => '+63 (919) 014-9988'
        ],
        'primary_power' => 'Kinetic Acceleration',
        'primary_level' => 'Level 7/10',
        'primary_pct' => 70,
        'secondary_power' => 'Shockwave Stomp',
        'secondary_level' => 'Level 5/10',
        'secondary_pct' => 50,
        'threat_class' => 'C-Rank',
        'threat_tier' => 4,
        'threat_tier_label' => 'C-Rank Hunter (Fighter)',
        'region' => 'Sector 4 - Bitan-agan & Lapinigan River Basin',
        'status' => 'Under Review',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => [],
        'mentor' => 'ATLAS',
        'role_tag' => 'Sidekick',
        'coordinates' => ['lat' => 8.4965, 'lng' => 125.9918, 'grid' => 'SF-LAP-7702'],
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
            'gov_id' => 'ADS-JCK-887F',
            'age' => 32,
            'dob' => 'May 22, 1993',
            'location' => 'Barangay Hubang Highway Logistics, San Francisco, ADS',
            'biometric_dna_ref' => 'JCK-887-PHOTONIC',
            'safehouse_address' => 'Highway Logistics Center, Brgy. Hubang, San Francisco, ADS',
            'handler_contact' => '+63 (917) 011-3388'
        ],
        'primary_power' => 'Photonic Manipulation',
        'primary_level' => 'Level 8/10',
        'primary_pct' => 80,
        'secondary_power' => 'Refractive Defense',
        'secondary_level' => 'Level 7/10',
        'secondary_pct' => 70,
        'threat_class' => 'B-Rank',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Rank Hunter (Mage)',
        'region' => 'Sector 2 - Hubang Highway & Logistics Corridor',
        'status' => 'Licensed',
        'license_number' => 'GHRMS-LIC-JCK-887F',
        'registration_step' => 3,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'green',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 8.5235, 'lng' => 125.9768, 'grid' => 'SF-HUB-887F'],
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
            'gov_id' => 'ADS-DWN-4C51',
            'age' => 26,
            'dob' => 'December 08, 1998',
            'location' => 'Barangay Caimpugan Wetland Sanctuary, San Francisco, ADS',
            'biometric_dna_ref' => 'DWN-4C5-RADIANT',
            'safehouse_address' => 'Peatland Ecology Field Station, Brgy. Caimpugan, San Francisco, ADS',
            'handler_contact' => '+63 (918) 019-4411'
        ],
        'primary_power' => 'Radiant Light Shielding',
        'primary_level' => 'Level 8/10',
        'primary_pct' => 80,
        'secondary_power' => 'Thermal Healing',
        'secondary_level' => 'Level 6/10',
        'secondary_pct' => 60,
        'threat_class' => 'B-Rank',
        'threat_tier' => 3,
        'threat_tier_label' => 'B-Rank Hunter (Healer)',
        'region' => 'Sector 5 - Caimpugan Peatland Sanctuary & Marsh Shield',
        'status' => 'Under Review',
        'license_number' => null,
        'registration_step' => 2,
        'badge_secret' => bin2hex(random_bytes(16)),
        'badge_color' => 'yellow',
        'sidekicks' => [],
        'mentor' => null,
        'coordinates' => ['lat' => 8.4825, 'lng' => 125.9578, 'grid' => 'SF-CAI-4C51'],
        'created_at' => date('c', strtotime('-5 days')),
        'emergency_contacts' => []
    ]
];

function seedGHRMSData(): array {
    global $seedHeroesData;
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0755, true);
    }

    $existingHeroes = JsonStorage::read(FILE_HEROES, []);
    $heroes = [];
    foreach ($seedHeroesData as $s) {
        $vaultRes = CryptoService::encryptVault($s['real_bio']);
        $heroRecord = $s;
        $heroRecord['real_name'] = $s['real_bio']['real_name'] ?? $s['alias'];
        unset($heroRecord['real_bio']);
        $heroRecord['vault_id'] = $vaultRes['vault_id'];
        if (!empty($existingHeroes[$s['id']]['supporting_documents'])) {
            $heroRecord['supporting_documents'] = $existingHeroes[$s['id']]['supporting_documents'];
        }
        $heroes[$s['id']] = $heroRecord;
    }

    JsonStorage::write(FILE_HEROES, $heroes);

    // Seed incidents
    $incidents = [
        [
            'id' => 'inc_2026_01',
            'title' => 'Poblacion Commercial Crossing - Gate Incursion Shockwave Impact',
            'region' => 'Sector 1 - Poblacion Central Commercial Grid',
            'coordinates' => ['lat' => 8.5115, 'lng' => 125.9820],
            'power_type' => 'Fighter',
            'severity' => 'High',
            'estimated_damage_usd' => 350000,
            'reported_by_hero' => 'hero_apex_01',
            'matched_hero_alias' => 'APEX',
            'civic_recovery_status' => 'Claim Approved - Fund Allocated',
            'photo_evidence' => 'concrete_fracture_01.jpg',
            'notes' => 'Gate monster incursion fractured crossing; neutralized by A-Rank Hunter strike team.',
            'timestamp' => date('c', strtotime('-3 days'))
        ],
        [
            'id' => 'inc_2026_02',
            'title' => 'Hubang Highway Substation - Arc Discharge Beast Surge',
            'region' => 'Sector 2 - Hubang Highway & Logistics Corridor',
            'coordinates' => ['lat' => 8.5270, 'lng' => 125.9750],
            'power_type' => 'Mage',
            'severity' => 'Critical',
            'estimated_damage_usd' => 820000,
            'reported_by_hero' => 'hero_lumina_02',
            'matched_hero_alias' => 'LUMINA',
            'civic_recovery_status' => 'Pending Assessor Review',
            'photo_evidence' => 'electrical_burn_grid.jpg',
            'notes' => 'Lightning-type magic beast arc discharge during Gate subjugation raid.',
            'timestamp' => date('c', strtotime('-18 hours'))
        ],
        [
            'id' => 'inc_2026_03',
            'title' => 'Caimpugan Marsh Peat Barrier - Red Gate Outbreak',
            'region' => 'Sector 5 - Caimpugan Peatland Sanctuary & Marsh Shield',
            'coordinates' => ['lat' => 8.4790, 'lng' => 125.9530],
            'power_type' => 'Tank',
            'severity' => 'Severe',
            'estimated_damage_usd' => 540000,
            'reported_by_hero' => 'hero_steelpulse_04',
            'matched_hero_alias' => 'STEEL PULSE',
            'civic_recovery_status' => 'Pending Civic Review',
            'photo_evidence' => 'pier_collapse.jpg',
            'notes' => 'Dimensional Red Gate rift opened in Peatland dome; containment secured by Association Hunters.',
            'timestamp' => date('c', strtotime('-1 day'))
        ]
    ];
    JsonStorage::write(FILE_INCIDENTS, $incidents);

    // Seed settings
    $settings = [
        'system_alert_level' => 'RED GATE ALERT - LEVEL 4',
        'rogue_broadcast_active' => false,
        'rogue_broadcast_message' => 'CRITICAL HUNTER DISPATCH: Dungeon Break detected in Sector 5 (Caimpugan Marsh Gate). All B-Rank and above Hunters deploy immediately!',
        'containment_zones' => [
            [
                'id' => 'zone_cst_alpha',
                'name' => 'Gate Zone Alpha - Caimpugan Peatland Dungeon Break',
                'center' => ['lat' => 8.4780, 'lng' => 125.9520],
                'radius_km' => 3.5,
                'threat_tier' => 1,
                'status' => 'Active Dungeon Raid Perimeter'
            ]
        ]
    ];
    JsonStorage::write(FILE_SETTINGS, $settings);

    // Audit ledger genesis
    JsonStorage::write(FILE_AUDIT, []);
    CryptoService::appendAudit('SARAH_CHEN', 'REGISTRAR', 'REGISTRY_INIT', 'HUNTER_ASSOC_CENTRAL', [
        'message' => 'Hunters Association Management System online. Mana evaluation ledger authenticated.'
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

    // Ensure all heroes have rich supporting documents (PNG ID, PNG Diploma, PDF Dossier)
    require_once __DIR__ . '/generate_all_documents.php';

    // Upgrade all vault records to authenticated Encrypt-then-MAC
    CryptoService::migrateVaultHmac();

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
