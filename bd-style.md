# Stilprofil – Intro-Project
Skill: bd-styleguide v0.2
Stil: BD-kerne
Outputs: web
Tema: lys + mørk

## Overrides (kun det der afviger fra BD-kernen)
| Token | Værdi | Note |
|---|---|---|
| – | – | Ingen. BD-kernen bruges uændret. |

## Projektregler
- CSS ligger i `app/bd-base.css`. Den importeres i `app/globals.css` i `components`-laget, efter Tailwind, og `globals.css` importeres i `app/layout.tsx`. Overrides skrives i blokken nederst i `bd-base.css`, ikke i komponenterne.
- Tailwind: BD-tokens findes som klasser via `@theme inline` i `globals.css` (`text-bd-muted`, `bg-bd-accent` …). Brug dem i stedet for Tailwinds standardfarver eller hex.
- Logo: tekst-wordmark `.bd-wordmark` (pladsholder, indtil BD's officielle logo foreligger).

## Log
- 2026-10-07 Oprettet
- 2026-10-07 Tailwind tilføjet; bd-base.css importeres nu via globals.css
