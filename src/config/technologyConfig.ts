import { CivilizationTrait, TechnologyEra } from "../entities/Civilization";

export type TechnologyUnlockType = "building" | "economyBonus" | "militaryBonus" | "visualEra";

export interface TechnologyUnlock {
  type: TechnologyUnlockType;
  target: string;
  value: number | string;
}

export interface TechnologyDefinition {
  id: string;
  name: string;
  era: TechnologyEra;
  description: string;
  researchCost: number;
  prerequisites: string[];
  unlocks: TechnologyUnlock[];
  weights: Partial<Record<CivilizationTrait, number>>;
}

export const TECHNOLOGIES: TechnologyDefinition[] = [
  {
    id: "fire",
    name: "Vuurbeheersing",
    era: "survival",
    description: "Kampen kunnen warmte, licht en veiligheid organiseren.",
    researchCost: 0,
    prerequisites: [],
    unlocks: [{ type: "visualEra", target: "camp", value: "survival" }],
    weights: { spiritual: 1 }
  },
  {
    id: "gathering",
    name: "Verzamelen",
    era: "survival",
    description: "Bewoners herkennen eetbare planten en bruikbare materialen.",
    researchCost: 0,
    prerequisites: [],
    unlocks: [{ type: "economyBonus", target: "food", value: 1 }],
    weights: { agricultural: 2 }
  },
  {
    id: "shelter",
    name: "Houten onderkomens",
    era: "survival",
    description: "Eenvoudige woningen maken stabiele groei mogelijk.",
    researchCost: 28,
    prerequisites: ["fire", "gathering"],
    unlocks: [{ type: "building", target: "house", value: 1 }],
    weights: { industrious: 1, isolationist: 1 }
  },
  {
    id: "agriculture",
    name: "Landbouw",
    era: "settlement",
    description: "Akkers leveren voorspelbaar voedsel en versnellen groei.",
    researchCost: 42,
    prerequisites: ["shelter"],
    unlocks: [
      { type: "building", target: "farm", value: 1 },
      { type: "economyBonus", target: "food", value: 1.2 }
    ],
    weights: { agricultural: 6, expansionist: 1 }
  },
  {
    id: "woodworking",
    name: "Houtbewerking",
    era: "settlement",
    description: "Beter gereedschap versnelt houtproductie en bouw.",
    researchCost: 45,
    prerequisites: ["shelter"],
    unlocks: [
      { type: "building", target: "woodcutter", value: 1 },
      { type: "economyBonus", target: "wood", value: 1.15 }
    ],
    weights: { industrious: 4 }
  },
  {
    id: "mining",
    name: "Mijnbouw",
    era: "settlement",
    description: "Nederzettingen kunnen structureel steenaders benutten.",
    researchCost: 48,
    prerequisites: ["woodworking"],
    unlocks: [
      { type: "building", target: "mine", value: 1 },
      { type: "economyBonus", target: "stone", value: 1.2 }
    ],
    weights: { industrious: 4, militaristic: 1 }
  },
  {
    id: "masonry",
    name: "Metselwerk",
    era: "kingdom",
    description: "Steenbouw maakt gebouwen sterker en steden duurzamer.",
    researchCost: 70,
    prerequisites: ["mining"],
    unlocks: [
      { type: "economyBonus", target: "buildingHealth", value: 25 },
      { type: "visualEra", target: "buildings", value: "stone" }
    ],
    weights: { industrious: 3, isolationist: 1 }
  },
  {
    id: "roads",
    name: "Wegenbouw",
    era: "kingdom",
    description: "Betere wegen verbinden nederzettingen en handel.",
    researchCost: 62,
    prerequisites: ["woodworking"],
    unlocks: [{ type: "economyBonus", target: "infrastructure", value: 1.25 }],
    weights: { mercantile: 4, expansionist: 3 }
  },
  {
    id: "markets",
    name: "Markten",
    era: "kingdom",
    description: "Markten verhogen rijkdom en maken handel aantrekkelijk.",
    researchCost: 66,
    prerequisites: ["agriculture", "roads"],
    unlocks: [
      { type: "building", target: "market", value: 1 },
      { type: "economyBonus", target: "wealth", value: 1.35 }
    ],
    weights: { mercantile: 7 }
  },
  {
    id: "writing",
    name: "Schrift",
    era: "kingdom",
    description: "Administratie en scholen versnellen onderzoek.",
    researchCost: 74,
    prerequisites: ["markets"],
    unlocks: [
      { type: "building", target: "school", value: 1 },
      { type: "economyBonus", target: "research", value: 1.3 }
    ],
    weights: { innovative: 7, spiritual: 2 }
  },
  {
    id: "metallurgy",
    name: "Metaalbewerking",
    era: "engineering",
    description: "Metalen werktuigen en wapens versterken productie en legers.",
    researchCost: 92,
    prerequisites: ["masonry", "writing"],
    unlocks: [
      { type: "economyBonus", target: "metal", value: 1.25 },
      { type: "militaryBonus", target: "armyStrength", value: 1.25 }
    ],
    weights: { militaristic: 6, industrious: 3 }
  },
  {
    id: "fortification",
    name: "Fortificaties",
    era: "engineering",
    description: "Verdedigingswerken maken steden moeilijker te veroveren.",
    researchCost: 88,
    prerequisites: ["masonry"],
    unlocks: [
      { type: "building", target: "watchtower", value: 1 },
      { type: "militaryBonus", target: "defense", value: 1.3 }
    ],
    weights: { militaristic: 5, isolationist: 4 }
  },
  {
    id: "industry",
    name: "Vroege industrie",
    era: "industry",
    description: "Werkplaatsen organiseren efficiëntere productie en logistiek.",
    researchCost: 130,
    prerequisites: ["metallurgy", "roads"],
    unlocks: [
      { type: "economyBonus", target: "tools", value: 1.4 },
      { type: "visualEra", target: "buildings", value: "industry" }
    ],
    weights: { innovative: 5, industrious: 6, mercantile: 2 }
  }
];

export const TECHNOLOGIES_BY_ID = Object.fromEntries(TECHNOLOGIES.map((technology) => [technology.id, technology])) as Record<
  string,
  TechnologyDefinition
>;
