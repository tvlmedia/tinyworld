import { GameState } from "../app/GameState";
import { CIVILIZATION_COLORS, GOVERNMENT_LABELS, TRAIT_LABELS } from "../config/civilizationConfig";
import { SETTLEMENT_TIER_LABELS } from "../config/settlementConfig";
import { TECHNOLOGIES_BY_ID } from "../config/technologyConfig";
import { MapMode, Settlement } from "../entities/Civilization";

export const MAP_MODE_DEFINITIONS: readonly { mode: MapMode; label: string; description: string }[] = [
  { mode: "normal", label: "Wereld", description: "Normale terreinweergave met wegen, gebouwen, bewoners en nederzettingen." },
  { mode: "political", label: "Politiek", description: "Toont beschavingsgebieden en territoriumgrenzen." },
  { mode: "diplomacy", label: "Diplomatie", description: "Kleurt gebieden op basis van relaties met de geselecteerde beschaving." },
  { mode: "resources", label: "Grondstof", description: "Toont bekende voedsel-, hout- en steenbronnen." },
  { mode: "population", label: "Bevolking", description: "Toont bevolkingsdichtheid rond nederzettingen." },
  { mode: "technology", label: "Tech", description: "Toont technologisch niveau per beschaving of gebied." },
  { mode: "war", label: "Oorlog", description: "Toont actieve oorlogen, legers en frontlijnen wanneer aanwezig." },
  { mode: "trade", label: "Handel", description: "Toont actieve handelsroutes wanneer aanwezig." }
];

export function mapModeHtml(state: GameState): string {
  return `
    <div class="segmented segmented--wrap" role="group" aria-label="Kaartmodus">
      ${MAP_MODE_DEFINITIONS
        .map(
          ({ mode, label, description }) =>
            `<button type="button" data-map-mode="${mode}" title="${description}" aria-pressed="${state.mapMode === mode ? "true" : "false"}" class="${state.mapMode === mode ? "is-active" : ""}"><span aria-hidden="true"></span>${label}</button>`
        )
        .join("")}
    </div>
  `;
}

export function civilizationPanelHtml(state: GameState): string {
  if (state.civilizations.length === 0) return "<p>Er zijn nog geen beschavingen.</p>";
  const selectedId = state.selectedCivilizationId ?? state.civilizations[0]?.id;
  const selected = state.civilizations.find((civilization) => civilization.id === selectedId) ?? state.civilizations[0];
  const capital = selected ? state.settlements.find((settlement) => settlement.id === selected.capitalSettlementId) : undefined;
  const relations = selected
    ? state.diplomaticRelations.filter((relation) => relation.civilizationAId === selected.id || relation.civilizationBId === selected.id)
    : [];
  const activeWars = selected ? state.wars.filter((war) => war.active && (war.attackerCivilizationIds.includes(selected.id) || war.defenderCivilizationIds.includes(selected.id))) : [];
  const activeArmies = selected ? state.armies.filter((army) => army.civilizationId === selected.id) : [];
  return `
    <div class="civ-list">
      ${state.civilizations
        .map((civilization) => {
          const color = CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length];
          return `
            <button type="button" data-civilization-id="${civilization.id}" class="civ-pill ${civilization.id === selected?.id ? "is-active" : ""}">
              <span style="background:${color}"></span>${civilization.name}
            </button>
          `;
        })
        .join("")}
    </div>
    ${
      selected
        ? `
          <dl>
            <dt>Regering</dt><dd>${GOVERNMENT_LABELS[selected.government]}</dd>
            <dt>Traits</dt><dd>${selected.traits.map((trait) => TRAIT_LABELS[trait]).join(", ")}</dd>
            <dt>Hoofdstad</dt><dd>${capital?.name ?? "onbekend"}</dd>
            <dt>Populatie</dt><dd>${selected.population}</dd>
            <dt>Steden</dt><dd>${selected.settlementIds.length}</dd>
            <dt>Stabiliteit</dt><dd>${Math.round(selected.stability)}</dd>
            <dt>Voedselzekerheid</dt><dd>${Math.round(selected.foodSecurity)}</dd>
            <dt>Economie</dt><dd>${Math.round(selected.economicStrength)}</dd>
            <dt>Militair</dt><dd>${Math.round(selected.militaryStrength)}</dd>
            <dt>Legers</dt><dd>${activeArmies.length} (${activeArmies.reduce((sum, army) => sum + army.soldierIds.length, 0)} strijders)</dd>
            <dt>Eenheden</dt><dd>${armyCompositionLabel(activeArmies)}</dd>
            <dt>Oorlogssteun</dt><dd>${Math.round(selected.warSupport)}</dd>
            <dt>Technologie</dt><dd>${Math.round(selected.technologicalStrength)}</dd>
            <dt>Research</dt><dd>${selected.currentResearchId ? TECHNOLOGIES_BY_ID[selected.currentResearchId]?.name ?? selected.currentResearchId : "-"}</dd>
            <dt>Ontdekt</dt><dd>${selected.unlockedTechnologyIds.map((id) => TECHNOLOGIES_BY_ID[id]?.name ?? id).slice(-5).join(", ")}</dd>
            <dt>Doelen</dt><dd>${selected.strategicGoals.join(", ")}</dd>
            <dt>Handel</dt><dd>${state.tradeRoutes.filter((route) => route.active && (route.civilizationAId === selected.id || route.civilizationBId === selected.id)).length}</dd>
            <dt>Oorlogen</dt><dd>${activeWars.map((war) => warLabel(state, selected.id, war)).join("; ") || "-"}</dd>
            <dt>Relaties</dt><dd>${relations.map((relation) => relationLabel(state, selected.id, relation)).join("; ") || "-"}</dd>
          </dl>
          <div class="button-row">
            <button type="button" data-action="focus-civilization" data-civilization-id="${selected.id}">Hoofdstad</button>
            <button type="button" data-action="show-territory" data-civilization-id="${selected.id}">Territorium</button>
          </div>
        `
        : ""
    }
  `;
}

function armyCompositionLabel(armies: GameState["armies"]): string {
  const labels = {
    spearman: "speren",
    swordsman: "zwaarden",
    archer: "bogen",
    shieldBearer: "schilden",
    rider: "ruiters"
  } as const;
  const totals: Partial<Record<keyof typeof labels, number>> = {};
  for (const army of armies) {
    for (const [type, count] of Object.entries(army.unitComposition ?? {})) {
      const unitType = type as keyof typeof labels;
      totals[unitType] = (totals[unitType] ?? 0) + count;
    }
  }
  return (Object.entries(totals) as [keyof typeof labels, number][])
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${labels[type]} ${count}`)
    .join(", ") || "-";
}

function warLabel(state: GameState, selectedId: string, war: GameState["wars"][number]): string {
  const enemyIds = war.attackerCivilizationIds.includes(selectedId) ? war.defenderCivilizationIds : war.attackerCivilizationIds;
  const enemies = enemyIds.map((id) => state.civilizations.find((civilization) => civilization.id === id)?.name ?? "onbekend").join(", ");
  const score = war.attackerCivilizationIds.includes(selectedId) ? war.attackerWarScore - war.defenderWarScore : war.defenderWarScore - war.attackerWarScore;
  return `${enemies}: ${Math.round(score)} score, ${war.casualties} doden`;
}

function relationLabel(state: GameState, selectedId: string, relation: GameState["diplomaticRelations"][number]): string {
  const otherId = relation.civilizationAId === selectedId ? relation.civilizationBId : relation.civilizationAId;
  const other = state.civilizations.find((civilization) => civilization.id === otherId);
  const opinion = relation.civilizationAId === selectedId ? relation.opinionAOfB : relation.opinionBOfA;
  return `${other?.name ?? "onbekend"}: ${relation.status} (${Math.round(opinion)})`;
}

export function settlementsPanelHtml(state: GameState): string {
  const settlements = [...state.settlements].sort((a, b) => settlementSortScore(state, b) - settlementSortScore(state, a) || b.population - a.population);
  return `
    <ol class="compact-list">
      ${settlements
        .map((settlement) => {
          const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
          const capital = civilization ? state.settlements.find((item) => item.id === civilization.capitalSettlementId) : undefined;
          const distanceToCapital =
            capital && capital.id !== settlement.id ? `${Math.round(Math.hypot(settlement.centerX - capital.centerX, settlement.centerY - capital.centerY))}t` : "centrum";
          const active = state.selected.kind === "settlement" && state.selected.id === settlement.id;
          return `
            <li class="${active ? "is-active" : ""}">
              <button type="button" data-action="focus-settlement" data-settlement-id="${settlement.id}" aria-current="${active ? "true" : "false"}">
                ${settlement.name}
              </button>
              <span>${SETTLEMENT_TIER_LABELS[settlement.tier]} · ${settlement.population} · ${civilization?.name ?? "-"} · ${distanceToCapital}</span>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function settlementSortScore(state: GameState, settlement: Settlement): number {
  const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
  if (civilization?.capitalSettlementId === settlement.id) return 1000;
  switch (settlement.tier) {
    case "capital":
      return 950;
    case "city":
      return 800;
    case "town":
      return 700;
    case "village":
      return 600;
    case "hamlet":
      return 500;
    case "camp":
      return 400;
  }
}

export function historyPanelHtml(state: GameState): string {
  const events = [...state.historicEvents].slice(-8).reverse();
  if (events.length === 0) return "<p>Nog geen historische gebeurtenissen.</p>";
  return `
    <ul class="history-list">
      ${events
        .map(
          (event) => `
            <li>
              <button type="button" data-action="focus-history" data-history-id="${event.id}">
                ${event.text}
              </button>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}
