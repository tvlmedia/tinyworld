# Tiny World Simulator

Screenshot placeholder: voeg hier na publicatie een echte screenshot toe.

Tiny World is een volledig lokale browsergame waarin een klein procedureel eiland zelfstandig tot leven komt. Vijf bewoners starten bij een kampvuur, zoeken voedsel, hakken bomen, dragen grondstoffen naar de opslag en bouwen stap voor stap een dorp.

De game gebruikt TypeScript, Vite, HTML5 Canvas 2D, CSS, Vitest en localStorage. Er is geen React, Vue, Phaser, Three.js, backend, database, AI of externe asset nodig om de game te spelen.

## Features

- Seeded eilandgeneratie met water, stranden, gras, bossen, rotsen, bergen, farmland, wegen en verbrande grond.
- Bewoners met eenvoudige finite state machine voor eten, hout verzamelen, bouwen, slapen, vluchten en rondwandelen.
- A* pathfinding met wegkosten, cache en blokkades voor water, bergen en gebouwen.
- Automatische dorpsplanner voor huizen, boerderijen, opslag, houthakkershut, werkplaats en uitkijktoren.
- Dag- en nachtcyclus met huislichtjes en lagere nachtactiviteit.
- Weer: helder, bewolkt, regen, onweer en droogte.
- Vuur met intensiteit, brandstof, rook, verspreiding en blussen.
- God-tools voor bomen, regen, voedsel, bewoners, vuur, blussen, bliksem en herstel.
- Camera slepen, muiswielzoom, touch-drag, pinch-to-zoom, selectie en tile-inspectie.
- Drie save-slots, autosave, settings en savegame-versies.
- Debugmodus via `?debug=true`.

## Installatie

```bash
npm install
```

## Lokaal Starten

```bash
npm run dev
```

## Builden

```bash
npm run build
```

De Vite `base` staat op `./`, zodat de productieversie correct vanuit een GitHub Pages-subdirectory kan draaien.

## Testen

```bash
npm run test
```

De tests richten zich op deterministische logica: seeded random, wereldgeneratie, speelbaarheid, pathfinding, bouwplaatsing, resourcekosten, savegames, migratie, brand en bevolkingsgroei.

## Deployen

Deze repo bevat `.github/workflows/deploy.yml`. Zet GitHub Pages op "GitHub Actions" en push naar `main`; de workflow installeert dependencies, draait tests, bouwt de game en publiceert `dist`.

## Controls

- Sleep of eenvinger-drag: camera bewegen.
- Muiswiel of pinch: zoomen.
- Klik of tik: bewoner, gebouw of tile selecteren.
- `Space`: pauze.
- `+` / `-`: in- en uitzoomen.
- `1`, `2`, `4`, `8`: snelheid instellen.
- WASD of pijltjestoetsen: camera bewegen.
- `0`: hele wereld in beeld.
- `F`: focus op het dorp.
- `` ` ``: debugmodus tonen/verbergen.
- Toolbar: kies een god-tool en klik daarna op de wereld.

## Projectstructuur

```text
src/
  app/            Game, loop, config en centrale state
  world/          tiles, seeded random, noise en eilandgenerator
  entities/       bewoners, gebouwen en resources
  ai/             pathfinding, jobs en bewonersregels
  simulation/     tijd, weer, natuur, vuur, planning en bevolking
  rendering/      Canvas-camera, tiles, entities, weer en licht
  input/          selectie, camera-input en god-tools
  ui/             HUD, inspector, log, tutorial en save-menu
  persistence/    savegames, serialisatie en migraties
  utils/          kleine helpers
tests/            deterministische Vitest-tests
```

## Roadmap

- Lokale Web Audio-ambience en effects toevoegen.
- Chunk-caching uitbreiden voor grotere werelden.
- Meer gebouwvarianten en werkplekken.
- Duidelijkere families of leeftijdsfases zonder complexe simulatie.
- Extra debugoverlays voor path nodes en villager states.
- Meer polish: voetstapjes, bouwstof, vogels, vissen en betere rook.
