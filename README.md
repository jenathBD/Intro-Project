# Intro-Project

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 7 · Postgres 18 (Docker)

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

# 6. Start appen på http://localhost:3000
npm run dev
```

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
| `docker compose up -d` | Starter Postgres i baggrunden |
| `docker compose down` | Stopper Postgres (data bevares) |
| `docker compose down -v` | Stopper Postgres **og sletter alle data** |
| `npx prisma migrate dev` | Opretter og kører migrationer ud fra `prisma/schema.prisma` |
| `npx prisma generate` | Genererer Prisma-klienten igen (sker også ved `npm install`) |
| `npx prisma studio` | Åbner en browser-visning af databasen |

## Miljøvariabler

Alle variabler er beskrevet i [`.env.example`](.env.example). `.env` indeholder hemmeligheder og må aldrig committes.

| Variabel | Formål |
|---|---|
| `DATABASE_URL` | Forbindelse til Postgres. Standardværdien matcher `docker-compose.yml` |
| `BETTER_AUTH_SECRET` | Hemmelig nøgle til at signere sessioner |
| `BETTER_AUTH_URL` | Appens egen adresse |

## Projektstruktur

```
app/                 sider, layouts og global CSS (routing)
app/generated/       genereret Prisma-klient (ikke i git)
lib/db.ts            den fælles Prisma-klient – importér prisma herfra
prisma/              schema.prisma og migrationer
docker-compose.yml   lokal Postgres
```

Styling følger Better Developers' styleguide. Se [`bd-style.md`](bd-style.md).

## Fejlsøgning

**`port is already allocated` når databasen starter.** Noget andet bruger port 5432, typisk en lokalt installeret Postgres. Stop den, eller ret porten i både `docker-compose.yml` og `DATABASE_URL`.

**`Can't reach database server at localhost:5432`.** Databasen kører ikke. Tjek, at Docker Desktop er startet, og kør `docker compose up -d`.

**`Cannot find module '…/generated/prisma/client'`.** Klienten er ikke genereret. Kør `npx prisma generate`.
