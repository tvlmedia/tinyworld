import { CivilizationTrait, GovernmentType } from "../entities/Civilization";

export const CIVILIZATION_COLORS = [
  "#e55f4f",
  "#4f8fe5",
  "#60b96f",
  "#d6a84f",
  "#a76ad7",
  "#39a7a0",
  "#cf6f9f",
  "#91a84e"
];

export const CIVILIZATION_PREFIXES = [
  "Alder",
  "Storm",
  "Vale",
  "Iron",
  "Sun",
  "River",
  "Oak",
  "Ash",
  "Mist",
  "Golden",
  "Stone",
  "Bright",
  "Fern",
  "Silver"
];

export const CIVILIZATION_SUFFIXES = [
  "folk",
  "reach",
  "realm",
  "union",
  "kingdom",
  "clans",
  "league",
  "republic",
  "empire",
  "compact"
];

export const SETTLEMENT_PREFIXES = ["River", "Stone", "Green", "Oak", "Sun", "Mist", "Iron", "Frost", "Hill", "Bright", "Ash"];
export const SETTLEMENT_SUFFIXES = ["holm", "watch", "ford", "mere", "haven", "field", "wick", "ridge", "mark", "port", "stead"];

export const CIVILIZATION_TRAITS: CivilizationTrait[] = [
  "agricultural",
  "mercantile",
  "militaristic",
  "isolationist",
  "expansionist",
  "innovative",
  "spiritual",
  "industrious",
  "seafaring"
];

export const GOVERNMENT_BY_LEVEL: GovernmentType[] = ["tribe", "chiefdom", "kingdom", "kingdom", "empire"];

export const GOVERNMENT_LABELS: Record<GovernmentType, string> = {
  tribe: "stam",
  chiefdom: "hoofdmanschap",
  kingdom: "koninkrijk",
  republic: "republiek",
  empire: "rijk"
};

export const TRAIT_LABELS: Record<CivilizationTrait, string> = {
  agricultural: "agrarisch",
  mercantile: "handelsgericht",
  militaristic: "militaristisch",
  isolationist: "isolationistisch",
  expansionist: "expansionistisch",
  innovative: "innovatief",
  spiritual: "spiritueel",
  industrious: "nijver",
  seafaring: "zeevarend"
};
