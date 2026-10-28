# Lviv Arena

The project has two parts:

- `frontend/` — the public, single-page landing, written in vanilla JavaScript and built with Vite. It reuses the original Lviv Arena stylesheet, copy, gallery, and image assets. There is no React app in the public frontend.
- The repository root — Payload CMS, its generated admin at `/admin`, PostgreSQL integration, collections, globals, and API routes. Payload's admin uses React internally.

## Local development

Start the Payload CMS backend in the repository root:

```sh
npm ci
npm run dev:cms
```

Create `.env` from `.env.example` and set `DATABASE_URL` (or `DATABASE_URI`) and a private `PAYLOAD_SECRET` of at least 32 characters. Start the single-page frontend in a second terminal:

```sh
npm --prefix frontend ci
npm run dev:frontend
```

Open `http://localhost:5173`. Vite proxies `/api/*` to the CMS on `http://localhost:3000`. The CMS admin is at `http://localhost:3000/admin`.

The landing loads header/footer globals and the published `home` page from `/api/common` and `/api/page?path=home`, and reads public tariffs and available computers from Payload collections. If the database is unavailable, demo tariff data is shown.

Apply Payload migrations with `npm run db:migrate`. If Neon supplied `DATABASE_URL_UNPOOLED`, the script uses that direct connection for migrations; the CMS continues to use the pooled `DATABASE_URL` for requests.

## Build and deploy

Build the landing with `npm run build:frontend`; Vite writes static assets to `frontend/dist`. Build the Payload backend with `npm run build:cms`.

For separate Vercel projects using one Git repository:

- Public site: Root Directory `frontend`, Build Command `npm run build`, Output Directory `dist`; set `VITE_CMS_URL` to the CMS origin.
- CMS: Root Directory `.`, configure pooled `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, and `FRONTEND_URLS` with the public site's origin. Keep `DATABASE_URL_UNPOOLED` for migrations. Run `npm run db:migrate` before opening `/admin`.

The public frontend contains one page. Header links scroll to sections on that page; there are no separate public booking, login, dashboard, catalog, or news pages.
