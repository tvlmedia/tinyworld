import { SaveMeta } from "../persistence/SaveManager";

export function saveSlotsHtml(slots: SaveMeta[]): string {
  return [1, 2, 3]
    .map((slot) => {
      const meta = slots.find((item) => item.slot === slot);
      const label = meta ? `Dag ${meta.day}, ${new Date(meta.savedAt).toLocaleDateString()}` : "leeg";
      return `
        <div class="save-slot">
          <span>Slot ${slot}: ${label}</span>
          <button type="button" data-action="save" data-slot="${slot}">Save</button>
          <button type="button" data-action="load" data-slot="${slot}" ${meta ? "" : "disabled"}>Load</button>
        </div>
      `;
    })
    .join("");
}
