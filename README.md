# Introproject

Internt dashboard til Better Developers, der giver overblik over projekternes budget og over, hvem der arbejder på hvad.

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 7 · Postgres 18 (Docker)

## Om projektet

Den vigtigste idé er at **opdage tidligt, om et projekt er på vej over budget**. Hvert projekt er opdelt i arbejdspakker med et estimat. Udvikleren opdaterer selv, hvor mange timer der er *resterende* på sin arbejdspakke, og dashboardet regner så:

```
prognose  = brugt + resterende
afvigelse = prognose − estimat
```

Tallene summeres pr. projekt og vises i både timer og kroner (timer × timepris). Projekter, hvor prognosen overstiger estimatet, markeres med rødt.

En arbejdspakke svarer til ét GitHub-issue og kan høre til et epic. Arbejdspakker kan grupperes pr. epic eller pr. kategori (fx Analyse eller Udvikling); hver pakke har én kategori. Estimat, ansvarlig og datoer er valgfrie, så der kan registreres tid på alle issues. En pakke uden estimat tæller som 0 t i estimatet. Tid på den er derfor over budget og markeres med rødt, så arbejde uden for budgettet ikke bliver overset.

### Funktioner

| Område | Indhold |
|---|---|
| **Projekter og budget** | Projektoversigt og projektdetalje med estimat, brugt, resterende, prognose og afvigelse. Historik over resterende og en prognosegraf over tid |
| **Allokering og planlægning** | Ugegrid med medarbejdere og uger, der markerer over- og underbooking, samt en Gantt-tidslinje pr. projekt |
| **Overblik** | Forside med nøgletal (projekter over budget, forældede estimater, ugens belægning), links til ressourcer og widgets |
| **Integrationer** | Brugt tid hentes fra Clockify, og arbejdspakker kobles til GitHub-issues og PR'er |
| **Brugere** | Login med Better Auth og rollerne admin, projektleder og medarbejder |

### Status

Projektet er i den første fase. Det tekniske fundament er på plads (TypeScript, Tailwind, Prisma og Postgres). Login, app-shell og datamodel er næste skridt. Opgaverne styres som [issues på GitHub](https://github.com/jenathBD/Intro-Project/issues), samlet i seks epics.

## Kom i gang

### Forudsætninger

- [Node.js](https://nodejs.org/) 24 eller nyere
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (eller OrbStack), og det skal køre

### Første gang

```bash
# 1. Installér pakker (genererer også Prisma-klienten)
npm install

# 2. Opret din lokale .env ud fra skabelonen
cp .env.example .env

# 3. Generér en hemmelighed og indsæt den som BETTER_AUTH_SECRET i .env
openssl rand -base64 32

# 4. Start databasen
docker compose up -d

# 5. Opret tabellerne i databasen
npx prisma migrate dev

# 6. Fyld databasen med mockdata (projekter, medarbejdere, timer …)
npm run db:seed

# 7. Start appen på http://localhost:3000
npm run dev
```

Alle sider kræver login. Første gang skal du oprette en bruger under **Opret bruger** på http://localhost:3000/login.

### Til daglig

```bash
docker compose up -d   # hvis databasen ikke allerede kører
npm run dev
```

## Kommandoer

| Kommando | Hvad den gør |
|---|---|
| `npm run dev` | Starter udviklingsserveren |
| `npm run build` | Bygger appen til produktion (inkl. typetjek) |
| `npm run typecheck` | Typetjekker hele projektet (`tsc --noEmit`) |
| `npm test` | Kører de automatiske tests (`lib/**/*.test.ts`, Nodes indbyggede testværktøj) |
| `docker compose up -d` | Starter Postgres i baggrunden |
| `docker compose down` | Stopper Postgres (data bevares) |
| `docker compose down -v` | Stopper Postgres **og sletter alle data** |
| `npx prisma migrate dev` | Opretter og kører migrationer ud fra `prisma/schema.prisma` |
| `npx prisma generate` | Genererer Prisma-klienten igen (sker også ved `npm install`) |
| `npx prisma studio` | Åbner en browser-visning af databasen |
| `npm run db:seed` | Sletter alt domænedata og opretter mockdata igen. Brugere og logins bevares. Kør det aldrig mod en database med rigtige data |

### Når du ændrer databaseskemaet

Efter hver ændring i `prisma/schema.prisma` skal du gøre to ting:

```bash
npx prisma migrate dev --name beskriv_aendringen   # 1. opret og kør migrationen
npx prisma generate                                # 2. generér klienten (Prisma 7 gør det ikke automatisk)
```

En kørende `npm run dev` opdager selv et ændret skema og skriver *"Prisma-skemaet er ændret – opretter en ny databaseforbindelse."* i terminalen. Du behøver ikke genstarte.

Prisma 7 kører heller ikke seed automatisk efter en migration. Har ændringen betydning for mockdata, så opdatér `prisma/seed.ts`, og kør `npm run db:seed`.

Better Auths tabeller (`user`, `session`, `account`, `verification`) genereres med `npx auth generate`. Ret dem ikke i hånden.

## Miljøvariabler

Alle variabler er beskrevet i [`.env.example`](.env.example). `.env` indeholder hemmeligheder og må aldrig committes.

| Variabel | Formål |
|---|---|
| `DATABASE_URL` | Forbindelse til Postgres. Standardværdien matcher `docker-compose.yml` |
| `BETTER_AUTH_SECRET` | Hemmelig nøgle til at signere sessioner |
| `BETTER_AUTH_URL` | Appens egen adresse |
| `GITHUB_TOKEN` | Valgfri. Token til at hente issues og PR'er fra GitHub. Lokalt kan du bruge `gh auth token` |

## Projektstruktur

```
app/(app)/           sider bag login med fælles shell (topbar + sidepanel)
app/login/           login-side og Server Actions til log ind/ud
app/api/auth/        Better Auths endpoints
app/generated/       genereret Prisma-klient (ikke i git)
components/          delte komponenter (topbar, sidepanel …)
lib/db.ts            den fælles Prisma-klient – importér prisma herfra
lib/auth.ts          Better Auth-konfiguration
lib/session.ts       getSession() og requireSession()
lib/github.ts        henter issues fra GitHub; reglerne for importen står i lib/github-sync.ts
proxy.ts             sender besøgende uden session-cookie til /login
prisma/              schema.prisma og migrationer
docker-compose.yml   lokal Postgres
```

Styling følger Better Developers' styleguide. Se [`bd-style.md`](bd-style.md).

## GitHub

Et projekt kobles til et repo under **Redigér projekt** (fx `jenathBD/Intro-Project`). **Hent fra GitHub** på projektsiden henter alle issues:

- Issues med labelen `epic` eller med sub-issues bliver til epics. Alle andre issues bliver til arbejdspakker, så der kan registreres tid på dem.
- **GitHub bestemmer** titel, åben/lukket og de PR'er, der lukker issuet. De opdateres ved hver hentning.
- **Dashboardet bestemmer** estimat, datoer, ansvarlig, kategori, epic og status. De sættes kun, når pakken oprettes: lukkede issues bliver afsluttede, kategorien kommer fra en label som `kategori: Analyse` (ellers Udvikling), og den ansvarlige foreslås ud fra issuets assignee via medarbejderens GitHub-brugernavn.
- Issues, der er lukket som "not planned", oprettes ikke.
- Data gemmes i databasen, så siden ikke venter på GitHub. Hentning sker kun, når man trykker på knappen.
- Arbejdspakker, der er oprettet i dashboardet uden issuenummer, kobles ikke til issues med samme navn.

## Adgangskontrol

Siderne er beskyttet i to lag:

1. **`proxy.ts`** sender besøgende uden session-cookie til `/login`. Den tjekker kun, om cookien findes, og ikke om den er gyldig.
2. **`requireSession()`** slår sessionen op i databasen og sender til `/login`, hvis den ikke er gyldig.

**Regel:** kald `requireSession()` først i hver funktion, der henter eller ændrer data, altså datafunktioner i `lib/` og Server Actions. Læg ikke tjekket i en side eller et layout. Et layout kører ikke ved navigation, og siden renderes parallelt med det, så et tjek dér beskytter ikke dataene.

## Fejlsøgning

**`port is already allocated` når databasen starter.** Noget andet bruger port 5432, typisk en lokalt installeret Postgres. Stop den, eller ret porten i både `docker-compose.yml` og `DATABASE_URL`.

**`Can't reach database server at localhost:5432`.** Databasen kører ikke. Tjek, at Docker Desktop er startet, og kør `docker compose up -d`.

**`Cannot find module '…/generated/prisma/client'`.** Klienten er ikke genereret. Kør `npx prisma generate`.

**`BetterAuthError: Prisma schema mismatch … Missing tables`, selvom tabellerne findes.** Prisma-klienten er forældet. Kør `npx prisma generate`, og genindlæs siden. Hjælper det ikke, så genstart `npm run dev`.
