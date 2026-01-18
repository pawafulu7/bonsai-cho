import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { bonsai, careLogs, species, styles, users } from "./schema";

/**
 * Parse seed-specific environment variables.
 * Only requires DB connection info, not full app env.
 */
function parseSeedEnv() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required for seeding");
  }

  return { url, authToken };
}

// =============================================================================
// Safety Checks (Multi-Layer Defense)
// =============================================================================

/**
 * Check if test data seeding is allowed.
 * Implements 4-layer defense against production data insertion.
 */
function checkTestDataSeedingAllowed(): boolean {
  const shouldSeedTestData = process.env.SEED_TEST_DATA === "true";

  if (!shouldSeedTestData) {
    return false;
  }

  // Layer 2: Production environment block
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console.error("ERROR: Cannot seed test data in production environment");
    process.exit(1);
  }

  // Layer 3: Production database URL detection
  const url = process.env.TURSO_DATABASE_URL || "";
  const isProdDatabase =
    url.includes("prod") || url.includes("production") || url.includes("prd");
  if (isProdDatabase) {
    console.error(
      "ERROR: Test data seeding blocked - production database detected"
    );
    process.exit(1);
  }

  // Layer 4: Development database allowlist (fail-closed)
  // Allow: localhost, file-based DB, or Turso dev database (contains "-dev")
  const isDevDb =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("file:") ||
    url.includes("-dev") ||
    url === "";
  if (!isDevDb) {
    console.error(
      "ERROR: Test data seeding only allowed on development database"
    );
    console.error("Detected DB URL:", `${url.substring(0, 50)}...`);
    console.error('Hint: DB URL must contain "localhost", "file:", or "-dev"');
    process.exit(1);
  }

  return true;
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Generate ISO date string for N days ago from now.
 */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// =============================================================================
// Master Data (Species & Styles)
// =============================================================================

const speciesData = [
  {
    id: "species_kuromatsu",
    nameJa: "Kuromatsu",
    nameEn: "Japanese Black Pine",
    nameScientific: "Pinus thunbergii",
    description: "One of the most popular species for bonsai in Japan.",
  },
  {
    id: "species_goyo_matsu",
    nameJa: "Goyomatsu",
    nameEn: "Japanese White Pine",
    nameScientific: "Pinus parviflora",
    description: "Known for its elegant needles and beautiful bark.",
  },
  {
    id: "species_shimpaku",
    nameJa: "Shimpaku",
    nameEn: "Shimpaku Juniper",
    nameScientific: "Juniperus chinensis var. sargentii",
    description: "Prized for its flexibility and jin/shari potential.",
  },
  {
    id: "species_kaede",
    nameJa: "Kaede",
    nameEn: "Japanese Maple",
    nameScientific: "Acer palmatum",
    description: "Beautiful autumn colors and delicate leaves.",
  },
  {
    id: "species_keyaki",
    nameJa: "Keyaki",
    nameEn: "Japanese Zelkova",
    nameScientific: "Zelkova serrata",
    description: "Classic broom-style bonsai with fine ramification.",
  },
  {
    id: "species_ume",
    nameJa: "Ume",
    nameEn: "Japanese Apricot",
    nameScientific: "Prunus mume",
    description: "Fragrant spring flowers and gnarled trunks.",
  },
  {
    id: "species_sakura",
    nameJa: "Sakura",
    nameEn: "Cherry Blossom",
    nameScientific: "Prunus serrulata",
    description: "Symbol of Japan with beautiful spring blossoms.",
  },
  {
    id: "species_azalea",
    nameJa: "Satsuki",
    nameEn: "Satsuki Azalea",
    nameScientific: "Rhododendron indicum",
    description: "Known for vibrant flowers in late spring.",
  },
];

const stylesData = [
  {
    id: "style_chokkan",
    nameJa: "Chokkan",
    nameEn: "Formal Upright",
    description:
      "Straight trunk with balanced branch arrangement, tapering to apex.",
  },
  {
    id: "style_moyogi",
    nameJa: "Moyogi",
    nameEn: "Informal Upright",
    description: "S-curved trunk with natural, flowing movement.",
  },
  {
    id: "style_shakan",
    nameJa: "Shakan",
    nameEn: "Slanting",
    description:
      "Trunk grows at an angle, suggesting wind or environmental pressure.",
  },
  {
    id: "style_kengai",
    nameJa: "Kengai",
    nameEn: "Cascade",
    description:
      "Trunk cascades below the pot base, like a cliff-growing tree.",
  },
  {
    id: "style_han_kengai",
    nameJa: "Han-kengai",
    nameEn: "Semi-Cascade",
    description: "Trunk cascades but stays above the pot base.",
  },
  {
    id: "style_bunjingi",
    nameJa: "Bunjingi",
    nameEn: "Literati",
    description:
      "Minimal branches with elegant, tall trunk. Inspired by Chinese literati painting.",
  },
  {
    id: "style_fukinagashi",
    nameJa: "Fukinagashi",
    nameEn: "Windswept",
    description: "All branches swept to one side by constant wind.",
  },
  {
    id: "style_hokidachi",
    nameJa: "Hokidachi",
    nameEn: "Broom",
    description:
      "Fine, radiating branches forming a broom-like canopy. Common for deciduous trees.",
  },
  {
    id: "style_yose_ue",
    nameJa: "Yose-ue",
    nameEn: "Forest/Group Planting",
    description: "Multiple trees planted together to create a forest scene.",
  },
  {
    id: "style_ishitsuki",
    nameJa: "Ishitsuki",
    nameEn: "Root Over Rock",
    description: "Roots grow over and around a rock, gripping its surface.",
  },
];

// =============================================================================
// Test Data (Users, Bonsai, Care Logs)
// =============================================================================

const testUsersData = [
  {
    id: "user_demo_tanaka",
    email: "demo-tanaka@example.test",
    name: "Tanaka Taro",
    displayName: "Bonsai Taro",
    bio: "Bonsai enthusiast for 20 years. Specializing in kuromatsu and shimpaku.",
    location: "Tokyo",
    website: "https://example.test/tanaka",
  },
  {
    id: "user_demo_suzuki",
    email: "demo-suzuki@example.test",
    name: "Suzuki Hanako",
    displayName: "Bonsai Girl",
    bio: "Recently started bonsai. I love maple and cherry blossoms.",
    location: "Kyoto",
  },
  {
    id: "user_demo_yamada",
    email: "demo-yamada@example.test",
    name: "Yamada Ichiro",
    bio: "I often participate in bonsai exhibitions.",
    location: "Osaka",
  },
];

const testBonsaiData = [
  // User: tanaka (Expert) - 4 bonsai
  {
    id: "bonsai_demo_kuromatsu_01",
    userId: "user_demo_tanaka",
    speciesId: "species_kuromatsu",
    styleId: "style_moyogi",
    name: "Kokuryu",
    description:
      "A 45-year-old kuromatsu with powerful trunk movement. Won grand prize at the regional exhibition.",
    estimatedAge: 45,
    height: 65,
    width: 50,
    potDetails: "Tokoname unglazed rectangle pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_shimpaku_01",
    userId: "user_demo_tanaka",
    speciesId: "species_shimpaku",
    styleId: "style_kengai",
    name: "Seiun",
    description:
      "Cascade style shimpaku with beautiful jin and shari. Acquired from a bonsai master 10 years ago.",
    estimatedAge: 30,
    height: 40,
    width: 35,
    potDetails: "Round cascade pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_kaede_01",
    userId: "user_demo_tanaka",
    speciesId: "species_kaede",
    styleId: "style_chokkan",
    name: "Kouen",
    description:
      "Formal upright maple with stunning autumn colors. Fine ramification achieved through years of work.",
    estimatedAge: 25,
    height: 55,
    width: 45,
    potDetails: "Blue glazed oval pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_goyo_01",
    userId: "user_demo_tanaka",
    speciesId: "species_goyo_matsu",
    styleId: "style_bunjingi",
    name: "Hakuho",
    description:
      "Literati style goyomatsu with elegant trunk line. A heritage tree passed down in the family.",
    estimatedAge: 50,
    height: 70,
    width: 30,
    potDetails: "Shallow round pot",
    isPublic: true,
  },

  // User: suzuki (Intermediate) - 3 bonsai
  {
    id: "bonsai_demo_sakura_01",
    userId: "user_demo_suzuki",
    speciesId: "species_sakura",
    styleId: "style_shakan",
    name: "Harugasumi",
    description:
      "Slanting cherry blossom tree. Beautiful pink flowers bloom every spring.",
    estimatedAge: 8,
    height: 35,
    width: 30,
    potDetails: "Pink glazed oval pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_kaede_02",
    userId: "user_demo_suzuki",
    speciesId: "species_kaede",
    styleId: "style_hokidachi",
    name: "Akinishiki",
    description:
      "Broom style maple with beautiful fall colors. Started from a cutting 12 years ago.",
    estimatedAge: 12,
    height: 45,
    width: 40,
    potDetails: "Brown unglazed oval pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_azalea_01",
    userId: "user_demo_suzuki",
    speciesId: "species_azalea",
    styleId: "style_moyogi",
    name: "Shiun",
    description:
      "Satsuki azalea with purple flowers. Blooms beautifully in late spring.",
    estimatedAge: 10,
    height: 30,
    width: 35,
    potDetails: "White glazed rectangle pot",
    isPublic: true,
  },

  // User: yamada (Beginner) - 3 bonsai
  {
    id: "bonsai_demo_keyaki_01",
    userId: "user_demo_yamada",
    speciesId: "species_keyaki",
    styleId: "style_hokidachi",
    name: "Wakaba",
    description:
      "Young zelkova in broom style. Working on developing fine ramification.",
    estimatedAge: 5,
    height: 25,
    width: 20,
    potDetails: "Small brown pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_ume_01",
    userId: "user_demo_yamada",
    speciesId: "species_ume",
    styleId: "style_shakan",
    name: "Hakubai",
    description:
      "White plum with fragrant flowers. A gift from a bonsai club member.",
    estimatedAge: 7,
    height: 30,
    width: 25,
    potDetails: "Green glazed pot",
    isPublic: true,
  },
  {
    id: "bonsai_demo_kuromatsu_02",
    userId: "user_demo_yamada",
    speciesId: "species_kuromatsu",
    styleId: "style_chokkan",
    name: "Uijin",
    description:
      "My first kuromatsu. Learning the basics of pine care with this tree.",
    estimatedAge: 3,
    height: 20,
    width: 15,
    potDetails: "Training pot",
    isPublic: true,
  },
];

/**
 * Generate care logs with relative dates from now.
 */
function generateTestCareLogsData() {
  return [
    // Care logs for bonsai_demo_kuromatsu_01
    {
      id: "carelog_demo_kuromatsu_01_001",
      bonsaiId: "bonsai_demo_kuromatsu_01",
      careType: "watering" as const,
      description: "Morning watering. Also misted the foliage.",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_kuromatsu_01_002",
      bonsaiId: "bonsai_demo_kuromatsu_01",
      careType: "pruning" as const,
      description: "Removed unwanted buds. Shaped the tree structure.",
      performedAt: daysAgo(5),
    },
    {
      id: "carelog_demo_kuromatsu_01_003",
      bonsaiId: "bonsai_demo_kuromatsu_01",
      careType: "fertilizing" as const,
      description: "Applied organic fertilizer for winter preparation.",
      performedAt: daysAgo(14),
    },

    // Care logs for bonsai_demo_shimpaku_01
    {
      id: "carelog_demo_shimpaku_01_001",
      bonsaiId: "bonsai_demo_shimpaku_01",
      careType: "watering" as const,
      description: "Careful watering to avoid overwatering juniper.",
      performedAt: daysAgo(2),
    },
    {
      id: "carelog_demo_shimpaku_01_002",
      bonsaiId: "bonsai_demo_shimpaku_01",
      careType: "wiring" as const,
      description: "Adjusted wire on lower branches. Checking for bite marks.",
      performedAt: daysAgo(10),
    },

    // Care logs for bonsai_demo_kaede_01
    {
      id: "carelog_demo_kaede_01_001",
      bonsaiId: "bonsai_demo_kaede_01",
      careType: "watering" as const,
      description: "Daily watering. Maple requires consistent moisture.",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_kaede_01_002",
      bonsaiId: "bonsai_demo_kaede_01",
      careType: "pruning" as const,
      description: "Light pruning to maintain shape after leaf fall.",
      performedAt: daysAgo(7),
    },
    {
      id: "carelog_demo_kaede_01_003",
      bonsaiId: "bonsai_demo_kaede_01",
      careType: "other" as const,
      description: "Moved to winter protection area.",
      performedAt: daysAgo(21),
    },

    // Care logs for bonsai_demo_goyo_01
    {
      id: "carelog_demo_goyo_01_001",
      bonsaiId: "bonsai_demo_goyo_01",
      careType: "watering" as const,
      description: "Light watering. White pine prefers drier conditions.",
      performedAt: daysAgo(3),
    },
    {
      id: "carelog_demo_goyo_01_002",
      bonsaiId: "bonsai_demo_goyo_01",
      careType: "fertilizing" as const,
      description: "Applied weak fertilizer. Being careful not to overfeed.",
      performedAt: daysAgo(20),
    },

    // Care logs for bonsai_demo_sakura_01
    {
      id: "carelog_demo_sakura_01_001",
      bonsaiId: "bonsai_demo_sakura_01",
      careType: "watering" as const,
      description: "Watered thoroughly. Cherry needs good hydration.",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_sakura_01_002",
      bonsaiId: "bonsai_demo_sakura_01",
      careType: "pruning" as const,
      description: "Pruned after flowering to shape for next year.",
      performedAt: daysAgo(8),
    },

    // Care logs for bonsai_demo_kaede_02
    {
      id: "carelog_demo_kaede_02_001",
      bonsaiId: "bonsai_demo_kaede_02",
      careType: "watering" as const,
      description: "Regular watering schedule maintained.",
      performedAt: daysAgo(2),
    },
    {
      id: "carelog_demo_kaede_02_002",
      bonsaiId: "bonsai_demo_kaede_02",
      careType: "repotting" as const,
      description: "Checked roots. Planning repotting for next spring.",
      performedAt: daysAgo(15),
    },

    // Care logs for bonsai_demo_azalea_01
    {
      id: "carelog_demo_azalea_01_001",
      bonsaiId: "bonsai_demo_azalea_01",
      careType: "watering" as const,
      description: "Watered with rainwater. Azalea prefers acidic water.",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_azalea_01_002",
      bonsaiId: "bonsai_demo_azalea_01",
      careType: "fertilizing" as const,
      description: "Applied azalea-specific fertilizer.",
      performedAt: daysAgo(12),
    },
    {
      id: "carelog_demo_azalea_01_003",
      bonsaiId: "bonsai_demo_azalea_01",
      careType: "pruning" as const,
      description: "Removed spent flowers and shaped branches.",
      performedAt: daysAgo(25),
    },

    // Care logs for bonsai_demo_keyaki_01
    {
      id: "carelog_demo_keyaki_01_001",
      bonsaiId: "bonsai_demo_keyaki_01",
      careType: "watering" as const,
      description: "Watered in the morning as usual.",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_keyaki_01_002",
      bonsaiId: "bonsai_demo_keyaki_01",
      careType: "other" as const,
      description: "Checked for pests. All clear.",
      performedAt: daysAgo(6),
    },

    // Care logs for bonsai_demo_ume_01
    {
      id: "carelog_demo_ume_01_001",
      bonsaiId: "bonsai_demo_ume_01",
      careType: "watering" as const,
      description: "Moderate watering. Plum doesn't like wet feet.",
      performedAt: daysAgo(2),
    },
    {
      id: "carelog_demo_ume_01_002",
      bonsaiId: "bonsai_demo_ume_01",
      careType: "wiring" as const,
      description: "Applied wire to shape young branches.",
      performedAt: daysAgo(18),
    },

    // Care logs for bonsai_demo_kuromatsu_02
    {
      id: "carelog_demo_kuromatsu_02_001",
      bonsaiId: "bonsai_demo_kuromatsu_02",
      careType: "watering" as const,
      description: "Learning proper watering technique for pines.",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_kuromatsu_02_002",
      bonsaiId: "bonsai_demo_kuromatsu_02",
      careType: "fertilizing" as const,
      description: "First time fertilizing this tree. Following club advice.",
      performedAt: daysAgo(10),
    },
    {
      id: "carelog_demo_kuromatsu_02_003",
      bonsaiId: "bonsai_demo_kuromatsu_02",
      careType: "other" as const,
      description: "Attended club meeting. Got tips on pine care.",
      performedAt: daysAgo(22),
    },
  ];
}

// =============================================================================
// Seed Functions
// =============================================================================

async function seedTestUsers(
  tx: Parameters<
    Parameters<Awaited<ReturnType<typeof createDb>>["db"]["transaction"]>[0]
  >[0]
) {
  console.log("Seeding test users...");
  await tx
    .insert(users)
    .values(testUsersData)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: sql.raw(`excluded.${users.name.name}`),
        displayName: sql.raw(`excluded.${users.displayName.name}`),
        bio: sql.raw(`excluded.${users.bio.name}`),
        location: sql.raw(`excluded.${users.location.name}`),
        website: sql.raw(`excluded.${users.website.name}`),
        updatedAt: sql`(datetime('now'))`,
      },
    });
  console.log(`  Upserted ${testUsersData.length} test users`);
}

async function seedTestBonsai(
  tx: Parameters<
    Parameters<Awaited<ReturnType<typeof createDb>>["db"]["transaction"]>[0]
  >[0]
) {
  console.log("Seeding test bonsai...");
  await tx
    .insert(bonsai)
    .values(testBonsaiData)
    .onConflictDoUpdate({
      target: bonsai.id,
      set: {
        name: sql.raw(`excluded.${bonsai.name.name}`),
        description: sql.raw(`excluded.${bonsai.description.name}`),
        speciesId: sql.raw(`excluded.${bonsai.speciesId.name}`),
        styleId: sql.raw(`excluded.${bonsai.styleId.name}`),
        estimatedAge: sql.raw(`excluded.${bonsai.estimatedAge.name}`),
        height: sql.raw(`excluded.${bonsai.height.name}`),
        width: sql.raw(`excluded.${bonsai.width.name}`),
        potDetails: sql.raw(`excluded.${bonsai.potDetails.name}`),
        isPublic: sql.raw(`excluded.${bonsai.isPublic.name}`),
        updatedAt: sql`(datetime('now'))`,
      },
    });
  console.log(`  Upserted ${testBonsaiData.length} test bonsai`);
}

async function seedTestCareLogs(
  tx: Parameters<
    Parameters<Awaited<ReturnType<typeof createDb>>["db"]["transaction"]>[0]
  >[0]
) {
  console.log("Seeding test care logs...");
  const careLogsData = generateTestCareLogsData();
  await tx
    .insert(careLogs)
    .values(careLogsData)
    .onConflictDoUpdate({
      target: careLogs.id,
      set: {
        careType: sql.raw(`excluded.${careLogs.careType.name}`),
        description: sql.raw(`excluded.${careLogs.description.name}`),
        performedAt: sql.raw(`excluded.${careLogs.performedAt.name}`),
      },
    });
  console.log(`  Upserted ${careLogsData.length} test care logs`);
}

// =============================================================================
// Main Seed Function
// =============================================================================

async function seed() {
  const { url, authToken } = parseSeedEnv();

  // Check if test data seeding is allowed
  const shouldSeedTestData = checkTestDataSeedingAllowed();

  console.log("Seeding database...");
  if (shouldSeedTestData) {
    console.log("Test data seeding is ENABLED (SEED_TEST_DATA=true)");
  }

  let client: Awaited<ReturnType<typeof createDb>>["client"] | undefined;

  try {
    const result = await createDb(url, authToken);
    const db = result.db;
    client = result.client;

    await db.transaction(async (tx) => {
      // Seed species (batch upsert)
      console.log("Seeding species...");
      await tx
        .insert(species)
        .values(speciesData)
        .onConflictDoUpdate({
          target: species.id,
          set: {
            nameJa: sql.raw(`excluded.${species.nameJa.name}`),
            nameEn: sql.raw(`excluded.${species.nameEn.name}`),
            nameScientific: sql.raw(`excluded.${species.nameScientific.name}`),
            description: sql.raw(`excluded.${species.description.name}`),
          },
        });
      console.log(`  Upserted ${speciesData.length} species`);

      // Seed styles (batch upsert)
      console.log("Seeding styles...");
      await tx
        .insert(styles)
        .values(stylesData)
        .onConflictDoUpdate({
          target: styles.id,
          set: {
            nameJa: sql.raw(`excluded.${styles.nameJa.name}`),
            nameEn: sql.raw(`excluded.${styles.nameEn.name}`),
            description: sql.raw(`excluded.${styles.description.name}`),
          },
        });
      console.log(`  Upserted ${stylesData.length} styles`);

      // Seed test data if enabled
      if (shouldSeedTestData) {
        await seedTestUsers(tx);
        await seedTestBonsai(tx);
        await seedTestCareLogs(tx);
      }
    });

    console.log("Seeding complete!");
    if (shouldSeedTestData) {
      console.log("Test data summary:");
      console.log(`  - ${testUsersData.length} users`);
      console.log(`  - ${testBonsaiData.length} bonsai`);
      console.log(`  - ${generateTestCareLogsData().length} care logs`);
    }
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    client?.close();
  }
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
