# Lviv Arena frontend

This directory contains the public single-page landing, built with Vite and vanilla JavaScript. Page sections and navigation are editable in Payload CMS; the frontend reads published page data from `/api/page?path=home` and shared navigation from `/api/common`.

## Local development

Run the Payload/Next.js app from the repository root on port 3000, then run the frontend here:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to `http://localhost:3000`. If the CMS or database is unavailable, the landing displays its built-in demo content.

For a production build, run `npm run build`; Vite writes static files to `dist/`.

## Vercel

Create two Vercel projects from the same Git repository:

- **Public site:** Root Directory `frontend`, Build Command `npm run build`, Output Directory `dist`. Set `VITE_CMS_URL` to the deployed CMS origin.
- **CMS and API:** Root Directory `.`, using the root Next.js build. Configure `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, and `FRONTEND_URLS` (the public frontend origin). Apply Payload migrations before opening the admin at `/admin`.

The frontend is a single page. Local CMS links are mapped to landing sections; external links remain external.
