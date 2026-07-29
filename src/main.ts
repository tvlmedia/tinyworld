import "./style.css";
import { Game } from "./app/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const uiRoot = document.querySelector<HTMLElement>("#ui-root");

if (!canvas || !uiRoot) {
  throw new Error("Tiny World kon de basis-UI niet vinden.");
}

const game = new Game(canvas, uiRoot);
game.start();
