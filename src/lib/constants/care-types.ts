/**
 * Care Type Configuration
 *
 * Defines the visual properties for each care log type.
 */

import type { CareType } from "@/server/routes/bonsai.schema";

/**
 * Valid icon names for care type icons (from lucide-react)
 */
export type CareIconName =
  | "Droplet"
  | "Leaf"
  | "Scissors"
  | "Flower2"
  | "GitBranch"
  | "CircleDot";

export interface CareTypeConfig {
  label: string;
  icon: CareIconName;
  color: string;
}

export const careTypeConfig: Record<CareType, CareTypeConfig> = {
  watering: {
    label: "水やり",
    icon: "Droplet",
    color: "bg-blue-500",
  },
  fertilizing: {
    label: "施肥",
    icon: "Leaf",
    color: "bg-green-500",
  },
  pruning: {
    label: "剪定",
    icon: "Scissors",
    color: "bg-amber-500",
  },
  repotting: {
    label: "植替え",
    icon: "Flower2",
    color: "bg-orange-500",
  },
  wiring: {
    label: "針金掛け",
    icon: "GitBranch",
    color: "bg-gray-500",
  },
  other: {
    label: "その他",
    icon: "CircleDot",
    color: "bg-primary",
  },
} as const;

export type { CareType };
