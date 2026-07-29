export const TUTORIAL_KEY = "tinyworld:tutorialSeen";

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "true";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, "true");
  } catch {
    // Browser storage can be disabled; the tutorial remains harmless.
  }
}

export function tutorialHtml(): string {
  return `
    <div class="tutorial__panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <h2 id="tutorial-title">Welkom in Tiny World</h2>
      <ol>
        <li>Dit is jouw kleine eilandwereld.</li>
        <li>De bewoners werken zelfstandig.</li>
        <li>Sleep om te bewegen en zoom met het wiel of pinch.</li>
        <li>Klik op een bewoner om diens taak te bekijken.</li>
        <li>Gebruik god-tools om de wereld zachtjes te sturen.</li>
        <li>Versnel de tijd om het dorp te zien groeien.</li>
      </ol>
      <button class="primary" data-action="close-tutorial">Start</button>
    </div>
  `;
}
