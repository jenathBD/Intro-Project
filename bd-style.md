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
- Projektets egen CSS, der bygger videre på BD-komponenter, står i `app/globals.css` i en `@layer components`-blok. `bd-base.css` holdes uændret. Brug kun `var(--bd-…)` og BD's mobilgrænse på 760px, ikke Tailwinds `md:`.
- Dialoger: brug altid `components/dialog.tsx`. Den renderer dialogen i `<body>` med en portal, så den ikke arver stil fra det sted, knappen står (fx højrestilling og røde striber, når knappen står i en tabelcelle). Native `<dialog>` med `.bd-dialog` (radius `--bd-r-lg`, `--bd-shadow-pop`). Højst én primær knap; "Annullér" er ghost. Bekræftelse efter gem vises som `.bd-toast` nederst til højre (`.bd-toast-region`, `role="status"`).
- Tal over grænsen i tabeller (fx brugt over estimat, afvigelse over 0): rødt og fedt (`--bd-danger`), uden mærke og uden tooltip. Forklaringen står som `sr-only`-tekst til skærmlæsere. Brugt over estimat: `td.bd-over-estimate`.
- Tabeller, hvor rækker foldes ud eller får felter (fx ugegridet): `.bd-table--fixed` med `<colgroup>`, så kolonnebredderne ikke hopper. Første kolonne har `col.bd-col-label` (20rem); de øvrige deler resten ligeligt og er centreret (også tal og felter). Mindst 48rem bred; på smalle skærme scroller tabellen i sin ramme.
- Formularfelter side om side: `.bd-field` har `align-content: start`, så felter står på linje, også når nabofeltet har en hjælpetekst.
- Redigerbare celler i tabeller: `.bd-input.bd-input--cell` (smal, højrestillet, tabular-nums). Celler, der ikke kan redigeres, viser værdien som almindelig dæmpet tekst. Små valglister i tabeller: `.bd-select--sm`.
- Allokering: 1,0 FTE = 37 t; kapaciteten på deltid er lavere (30 t = 0,8 FTE) og står ved navnet ("30 t · 0,8 FTE"). Overbooket (over kapaciteten) er rødt og fedt med rød stribe på medarbejderrækken (`data-sev="blocker"`). Ledig tid (under kapaciteten, også med 0,1, og 0,0) er orange og fedt (`--bd-warn`) med orange stribe (`data-sev="major"`). Rød vinder over orange. Intern tid tæller som planlagt; uger med intern tid får BD's info-flade (`td.bd-cell-internal`, `--bd-info-soft`) i summen. Fraværsrækker (fx Ferie) er kursiv og dæmpede (`tr.bd-row-absence`).
- Tal, der kan klikkes for detaljer (fx "Brugt" → tidsregistreringer), er `.bd-link-button`: accentfarve med prikket understregning, der bliver fuld ved hover. Detaljerne vises i `.bd-dialog--wide`.
- Rækkehandlinger i tabeller (fx "Registrér tid") er `.bd-btn--secondary .bd-btn--sm` i sidste kolonne.
- Tabeller med totaler: total-rækken står i `<tfoot>` og får en kraftigere linje over og fed tekst.
- Træstruktur i tabeller: én `<tbody>` pr. gruppe. Grupperækken (`.bd-group-row`) har `surface-2`-baggrund, fed tekst og en fold-knap (`.bd-group-toggle` med `aria-expanded`) og en kraftig linje over. Rækkerne under er indrykket med en lodret træ-linje (`td.bd-tree-child`) og skrives i normal vægt, så kun gruppen er fed.
- App-shell: `.bd-shell` fylder skærmhøjden. Sidens indhold ligger i `.bd-main-body`, og `.bd-footer` står i bunden af `.bd-main`, også på korte sider. På mobil (≤ 760px) er `.bd-nav` foldet sammen bag en `.bd-nav-toggle`-knap (`.bd-btn--ghost .bd-btn--sm`), og `data-open` på `.bd-nav` styrer, om `.bd-nav-links` vises.

## Log
- 2026-10-07 Oprettet
- 2026-10-07 Tailwind tilføjet; bd-base.css importeres nu via globals.css
- 2026-10-07 App-shell: sammenfoldeligt sidepanel på mobil (#9)
