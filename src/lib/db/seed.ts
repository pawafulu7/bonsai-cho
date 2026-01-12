import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { species, styles } from "./schema";

// Species data
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

// Styles data
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
    description: "Trunk grows at an angle, suggesting wind or environmental pressure.",
  },
  {
    id: "style_kengai",
    nameJa: "Kengai",
    nameEn: "Cascade",
    description: "Trunk cascades below the pot base, like a cliff-growing tree.",
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

async function seed() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("TURSO_DATABASE_URL is required");
    process.exit(1);
  }

  const db = await createDb(url, authToken);

  console.log("Seeding database...");

  try {
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
      console.log(`  Inserted ${speciesData.length} species`);

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
      console.log(`  Inserted ${stylesData.length} styles`);
    });

    console.log("Seeding complete!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
