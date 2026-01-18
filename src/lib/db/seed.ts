import { sql } from "drizzle-orm";
import { createDb } from "./client";
import {
  bonsai,
  bonsaiImages,
  careLogs,
  species,
  styles,
  users,
} from "./schema";

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
    name: "田中太郎",
    displayName: "盆栽太郎",
    bio: "盆栽歴20年の愛好家です。黒松と真柏を中心に育てています。",
    location: "東京都",
    website: "https://example.test/tanaka",
  },
  {
    id: "user_demo_suzuki",
    email: "demo-suzuki@example.test",
    name: "鈴木花子",
    displayName: "盆栽ガール",
    bio: "最近盆栽を始めました。紅葉と桜が好きです。",
    location: "京都府",
  },
  {
    id: "user_demo_yamada",
    email: "demo-yamada@example.test",
    name: "山田一郎",
    bio: "盆栽展示会によく参加しています。",
    location: "大阪府",
  },
];

const testBonsaiData = [
  // User: tanaka（熟練者）- 4本
  {
    id: "bonsai_demo_kuromatsu_01",
    userId: "user_demo_tanaka",
    speciesId: "species_kuromatsu",
    styleId: "style_moyogi",
    name: "黒龍",
    description:
      "樹齢45年の黒松。力強い幹の動きが特徴。県展示会で金賞を受賞した自慢の一本。",
    estimatedAge: 45,
    height: 65,
    width: 50,
    potDetails: "常滑焼 無釉長方鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_shimpaku_01",
    userId: "user_demo_tanaka",
    speciesId: "species_shimpaku",
    styleId: "style_kengai",
    name: "青雲",
    description:
      "懸崖仕立ての真柏。見事なジンとシャリが見どころ。10年前に師匠から譲り受けた思い出の木。",
    estimatedAge: 30,
    height: 40,
    width: 35,
    potDetails: "丸型懸崖鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_kaede_01",
    userId: "user_demo_tanaka",
    speciesId: "species_kaede",
    styleId: "style_chokkan",
    name: "紅炎",
    description:
      "直幹仕立ての楓。秋の紅葉が素晴らしい。長年かけて作り込んだ細かい枝が自慢。",
    estimatedAge: 25,
    height: 55,
    width: 45,
    potDetails: "青磁釉 楕円鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_goyo_01",
    userId: "user_demo_tanaka",
    speciesId: "species_goyo_matsu",
    styleId: "style_bunjingi",
    name: "白峰",
    description:
      "文人木仕立ての五葉松。優雅な幹の線が特徴。代々受け継がれてきた家宝の木。",
    estimatedAge: 50,
    height: 70,
    width: 30,
    potDetails: "浅丸鉢",
    isPublic: true,
  },

  // User: suzuki（中級者）- 3本
  {
    id: "bonsai_demo_sakura_01",
    userId: "user_demo_suzuki",
    speciesId: "species_sakura",
    styleId: "style_shakan",
    name: "春霞",
    description:
      "斜幹仕立ての桜。毎年春にはピンクの花が咲き誇ります。お気に入りの一本。",
    estimatedAge: 8,
    height: 35,
    width: 30,
    potDetails: "ピンク釉 楕円鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_kaede_02",
    userId: "user_demo_suzuki",
    speciesId: "species_kaede",
    styleId: "style_hokidachi",
    name: "秋錦",
    description:
      "箒作りの楓。紅葉の美しさは格別。12年前に挿し木から育てました。",
    estimatedAge: 12,
    height: 45,
    width: 40,
    potDetails: "茶色無釉 楕円鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_azalea_01",
    userId: "user_demo_suzuki",
    speciesId: "species_azalea",
    styleId: "style_moyogi",
    name: "紫雲",
    description: "模様木仕立てのサツキ。紫色の花が特徴。初夏に美しく咲きます。",
    estimatedAge: 10,
    height: 30,
    width: 35,
    potDetails: "白釉 長方鉢",
    isPublic: true,
  },

  // User: yamada（初心者）- 3本
  {
    id: "bonsai_demo_keyaki_01",
    userId: "user_demo_yamada",
    speciesId: "species_keyaki",
    styleId: "style_hokidachi",
    name: "若葉",
    description: "箒作りを目指して育てている欅。小枝の充実に取り組んでいます。",
    estimatedAge: 5,
    height: 25,
    width: 20,
    potDetails: "小型茶鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_ume_01",
    userId: "user_demo_yamada",
    speciesId: "species_ume",
    styleId: "style_shakan",
    name: "白梅",
    description: "白い花の梅。芳香が楽しみ。盆栽会の先輩から頂いた大切な木。",
    estimatedAge: 7,
    height: 30,
    width: 25,
    potDetails: "緑釉鉢",
    isPublic: true,
  },
  {
    id: "bonsai_demo_kuromatsu_02",
    userId: "user_demo_yamada",
    speciesId: "species_kuromatsu",
    styleId: "style_chokkan",
    name: "初陣",
    description: "初めての黒松。松の基本を学びながら育てています。",
    estimatedAge: 3,
    height: 20,
    width: 15,
    potDetails: "培養鉢",
    isPublic: true,
  },
];

/**
 * Generate care logs with relative dates from now.
 */
function generateTestCareLogsData() {
  return [
    // 黒龍（黒松）のケアログ
    {
      id: "carelog_demo_kuromatsu_01_001",
      bonsaiId: "bonsai_demo_kuromatsu_01",
      careType: "watering" as const,
      description: "朝の水やり。葉水も実施しました。",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_kuromatsu_01_002",
      bonsaiId: "bonsai_demo_kuromatsu_01",
      careType: "pruning" as const,
      description: "不要な芽を摘み取り。樹形を整えました。",
      performedAt: daysAgo(5),
    },
    {
      id: "carelog_demo_kuromatsu_01_003",
      bonsaiId: "bonsai_demo_kuromatsu_01",
      careType: "fertilizing" as const,
      description: "冬越し準備として有機肥料を施肥。",
      performedAt: daysAgo(14),
    },

    // 青雲（真柏）のケアログ
    {
      id: "carelog_demo_shimpaku_01_001",
      bonsaiId: "bonsai_demo_shimpaku_01",
      careType: "watering" as const,
      description: "真柏は過湿を嫌うため控えめに水やり。",
      performedAt: daysAgo(2),
    },
    {
      id: "carelog_demo_shimpaku_01_002",
      bonsaiId: "bonsai_demo_shimpaku_01",
      careType: "wiring" as const,
      description: "下枝の針金を調整。食い込みがないか確認。",
      performedAt: daysAgo(10),
    },

    // 紅炎（楓）のケアログ
    {
      id: "carelog_demo_kaede_01_001",
      bonsaiId: "bonsai_demo_kaede_01",
      careType: "watering" as const,
      description: "毎日の水やり。楓は水切れに注意が必要。",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_kaede_01_002",
      bonsaiId: "bonsai_demo_kaede_01",
      careType: "pruning" as const,
      description: "落葉後の軽い剪定で樹形を維持。",
      performedAt: daysAgo(7),
    },
    {
      id: "carelog_demo_kaede_01_003",
      bonsaiId: "bonsai_demo_kaede_01",
      careType: "other" as const,
      description: "冬囲いの場所へ移動しました。",
      performedAt: daysAgo(21),
    },

    // 白峰（五葉松）のケアログ
    {
      id: "carelog_demo_goyo_01_001",
      bonsaiId: "bonsai_demo_goyo_01",
      careType: "watering" as const,
      description: "控えめに水やり。五葉松は乾燥気味を好みます。",
      performedAt: daysAgo(3),
    },
    {
      id: "carelog_demo_goyo_01_002",
      bonsaiId: "bonsai_demo_goyo_01",
      careType: "fertilizing" as const,
      description: "薄めの肥料を施肥。過肥料に注意。",
      performedAt: daysAgo(20),
    },

    // 春霞（桜）のケアログ
    {
      id: "carelog_demo_sakura_01_001",
      bonsaiId: "bonsai_demo_sakura_01",
      careType: "watering" as const,
      description: "たっぷり水やり。桜は水を好みます。",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_sakura_01_002",
      bonsaiId: "bonsai_demo_sakura_01",
      careType: "pruning" as const,
      description: "花後の剪定。来年の樹形を意識して整枝。",
      performedAt: daysAgo(8),
    },

    // 秋錦（楓）のケアログ
    {
      id: "carelog_demo_kaede_02_001",
      bonsaiId: "bonsai_demo_kaede_02",
      careType: "watering" as const,
      description: "定期的な水やりを継続中。",
      performedAt: daysAgo(2),
    },
    {
      id: "carelog_demo_kaede_02_002",
      bonsaiId: "bonsai_demo_kaede_02",
      careType: "repotting" as const,
      description: "根の状態を確認。来春の植え替えを予定。",
      performedAt: daysAgo(15),
    },

    // 紫雲（サツキ）のケアログ
    {
      id: "carelog_demo_azalea_01_001",
      bonsaiId: "bonsai_demo_azalea_01",
      careType: "watering" as const,
      description: "雨水で水やり。サツキは酸性を好みます。",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_azalea_01_002",
      bonsaiId: "bonsai_demo_azalea_01",
      careType: "fertilizing" as const,
      description: "サツキ専用肥料を施肥。",
      performedAt: daysAgo(12),
    },
    {
      id: "carelog_demo_azalea_01_003",
      bonsaiId: "bonsai_demo_azalea_01",
      careType: "pruning" as const,
      description: "花がら摘みと枝の整理。",
      performedAt: daysAgo(25),
    },

    // 若葉（欅）のケアログ
    {
      id: "carelog_demo_keyaki_01_001",
      bonsaiId: "bonsai_demo_keyaki_01",
      careType: "watering" as const,
      description: "いつも通り朝の水やり。",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_keyaki_01_002",
      bonsaiId: "bonsai_demo_keyaki_01",
      careType: "other" as const,
      description: "害虫チェック。問題なし。",
      performedAt: daysAgo(6),
    },

    // 白梅（梅）のケアログ
    {
      id: "carelog_demo_ume_01_001",
      bonsaiId: "bonsai_demo_ume_01",
      careType: "watering" as const,
      description: "控えめに水やり。梅は過湿を嫌います。",
      performedAt: daysAgo(2),
    },
    {
      id: "carelog_demo_ume_01_002",
      bonsaiId: "bonsai_demo_ume_01",
      careType: "wiring" as const,
      description: "若い枝に針金かけ。樹形づくり。",
      performedAt: daysAgo(18),
    },

    // 初陣（黒松）のケアログ
    {
      id: "carelog_demo_kuromatsu_02_001",
      bonsaiId: "bonsai_demo_kuromatsu_02",
      careType: "watering" as const,
      description: "松の水やり方法を勉強中。",
      performedAt: daysAgo(1),
    },
    {
      id: "carelog_demo_kuromatsu_02_002",
      bonsaiId: "bonsai_demo_kuromatsu_02",
      careType: "fertilizing" as const,
      description: "初めての施肥。盆栽会のアドバイスに従って。",
      performedAt: daysAgo(10),
    },
    {
      id: "carelog_demo_kuromatsu_02_003",
      bonsaiId: "bonsai_demo_kuromatsu_02",
      careType: "other" as const,
      description: "盆栽会の例会に参加。松の手入れを学びました。",
      performedAt: daysAgo(22),
    },
  ];
}

// =============================================================================
// Test Bonsai Images Data
// =============================================================================

/**
 * Generate bonsai images with picsum.photos placeholder URLs.
 * Each bonsai gets 1-3 images.
 */
const testBonsaiImagesData = [
  // 黒龍（黒松）- 3枚
  {
    id: "image_demo_kuromatsu_01_001",
    bonsaiId: "bonsai_demo_kuromatsu_01",
    imageUrl: "https://picsum.photos/seed/kuromatsu01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kuromatsu01a/200/150",
    caption: "正面からの全景",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_kuromatsu_01_002",
    bonsaiId: "bonsai_demo_kuromatsu_01",
    imageUrl: "https://picsum.photos/seed/kuromatsu01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kuromatsu01b/200/150",
    caption: "幹の立ち上がり部分",
    isPrimary: false,
    sortOrder: 1,
  },
  {
    id: "image_demo_kuromatsu_01_003",
    bonsaiId: "bonsai_demo_kuromatsu_01",
    imageUrl: "https://picsum.photos/seed/kuromatsu01c/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kuromatsu01c/200/150",
    caption: "背面からの姿",
    isPrimary: false,
    sortOrder: 2,
  },

  // 青雲（真柏）- 2枚
  {
    id: "image_demo_shimpaku_01_001",
    bonsaiId: "bonsai_demo_shimpaku_01",
    imageUrl: "https://picsum.photos/seed/shimpaku01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/shimpaku01a/200/150",
    caption: "懸崖仕立ての全景",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_shimpaku_01_002",
    bonsaiId: "bonsai_demo_shimpaku_01",
    imageUrl: "https://picsum.photos/seed/shimpaku01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/shimpaku01b/200/150",
    caption: "ジンとシャリの詳細",
    isPrimary: false,
    sortOrder: 1,
  },

  // 紅炎（楓）- 2枚
  {
    id: "image_demo_kaede_01_001",
    bonsaiId: "bonsai_demo_kaede_01",
    imageUrl: "https://picsum.photos/seed/kaede01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kaede01a/200/150",
    caption: "紅葉の様子",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_kaede_01_002",
    bonsaiId: "bonsai_demo_kaede_01",
    imageUrl: "https://picsum.photos/seed/kaede01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kaede01b/200/150",
    caption: "枝ぶりの詳細",
    isPrimary: false,
    sortOrder: 1,
  },

  // 白峰（五葉松）- 2枚
  {
    id: "image_demo_goyo_01_001",
    bonsaiId: "bonsai_demo_goyo_01",
    imageUrl: "https://picsum.photos/seed/goyo01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/goyo01a/200/150",
    caption: "文人木の全景",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_goyo_01_002",
    bonsaiId: "bonsai_demo_goyo_01",
    imageUrl: "https://picsum.photos/seed/goyo01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/goyo01b/200/150",
    caption: "幹の線の美しさ",
    isPrimary: false,
    sortOrder: 1,
  },

  // 春霞（桜）- 2枚
  {
    id: "image_demo_sakura_01_001",
    bonsaiId: "bonsai_demo_sakura_01",
    imageUrl: "https://picsum.photos/seed/sakura01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/sakura01a/200/150",
    caption: "満開の桜",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_sakura_01_002",
    bonsaiId: "bonsai_demo_sakura_01",
    imageUrl: "https://picsum.photos/seed/sakura01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/sakura01b/200/150",
    caption: "新緑の姿",
    isPrimary: false,
    sortOrder: 1,
  },

  // 秋錦（楓）- 2枚
  {
    id: "image_demo_kaede_02_001",
    bonsaiId: "bonsai_demo_kaede_02",
    imageUrl: "https://picsum.photos/seed/kaede02a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kaede02a/200/150",
    caption: "箒作りの樹形",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_kaede_02_002",
    bonsaiId: "bonsai_demo_kaede_02",
    imageUrl: "https://picsum.photos/seed/kaede02b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kaede02b/200/150",
    caption: "秋の紅葉",
    isPrimary: false,
    sortOrder: 1,
  },

  // 紫雲（サツキ）- 2枚
  {
    id: "image_demo_azalea_01_001",
    bonsaiId: "bonsai_demo_azalea_01",
    imageUrl: "https://picsum.photos/seed/azalea01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/azalea01a/200/150",
    caption: "開花時の姿",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_azalea_01_002",
    bonsaiId: "bonsai_demo_azalea_01",
    imageUrl: "https://picsum.photos/seed/azalea01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/azalea01b/200/150",
    caption: "紫色の花のアップ",
    isPrimary: false,
    sortOrder: 1,
  },

  // 若葉（欅）- 1枚
  {
    id: "image_demo_keyaki_01_001",
    bonsaiId: "bonsai_demo_keyaki_01",
    imageUrl: "https://picsum.photos/seed/keyaki01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/keyaki01a/200/150",
    caption: "若木の全景",
    isPrimary: true,
    sortOrder: 0,
  },

  // 白梅（梅）- 2枚
  {
    id: "image_demo_ume_01_001",
    bonsaiId: "bonsai_demo_ume_01",
    imageUrl: "https://picsum.photos/seed/ume01a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/ume01a/200/150",
    caption: "白梅の開花",
    isPrimary: true,
    sortOrder: 0,
  },
  {
    id: "image_demo_ume_01_002",
    bonsaiId: "bonsai_demo_ume_01",
    imageUrl: "https://picsum.photos/seed/ume01b/800/600",
    thumbnailUrl: "https://picsum.photos/seed/ume01b/200/150",
    caption: "幹模様の詳細",
    isPrimary: false,
    sortOrder: 1,
  },

  // 初陣（黒松）- 1枚
  {
    id: "image_demo_kuromatsu_02_001",
    bonsaiId: "bonsai_demo_kuromatsu_02",
    imageUrl: "https://picsum.photos/seed/kuromatsu02a/800/600",
    thumbnailUrl: "https://picsum.photos/seed/kuromatsu02a/200/150",
    caption: "培養中の若松",
    isPrimary: true,
    sortOrder: 0,
  },
];

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

async function seedTestBonsaiImages(
  tx: Parameters<
    Parameters<Awaited<ReturnType<typeof createDb>>["db"]["transaction"]>[0]
  >[0]
) {
  console.log("Seeding test bonsai images...");
  await tx
    .insert(bonsaiImages)
    .values(testBonsaiImagesData)
    .onConflictDoUpdate({
      target: bonsaiImages.id,
      set: {
        imageUrl: sql.raw(`excluded.${bonsaiImages.imageUrl.name}`),
        thumbnailUrl: sql.raw(`excluded.${bonsaiImages.thumbnailUrl.name}`),
        caption: sql.raw(`excluded.${bonsaiImages.caption.name}`),
        isPrimary: sql.raw(`excluded.${bonsaiImages.isPrimary.name}`),
        sortOrder: sql.raw(`excluded.${bonsaiImages.sortOrder.name}`),
      },
    });
  console.log(`  Upserted ${testBonsaiImagesData.length} test bonsai images`);
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
        await seedTestBonsaiImages(tx);
      }
    });

    console.log("Seeding complete!");
    if (shouldSeedTestData) {
      console.log("Test data summary:");
      console.log(`  - ${testUsersData.length} users`);
      console.log(`  - ${testBonsaiData.length} bonsai`);
      console.log(`  - ${generateTestCareLogsData().length} care logs`);
      console.log(`  - ${testBonsaiImagesData.length} bonsai images`);
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
