# Animal Bites in Tulsa Map

Interactive map of animal bite incidents reported to the City of Tulsa, built for the
Terence Crutcher Foundation. Shows hotspots (hexbin / heat map / grid), points, and
clusters — multiple views can be stacked at once, and the map is filterable by any
field and colorable by any field.

- **Data source:** [City of Tulsa Open Data — Animal Welfare (Bites)](https://gis2-cityoftulsa.opendata.arcgis.com/datasets/68ada06a29934a1681d2238594f803a8/about)
- **Map stack:** Mapbox GL JS (basemap + native heatmap) + deck.gl (hex/grid/points/clusters)
- **Basemaps:** Default (Mapbox Standard), Streets, Dark 2D, Satellite (with labels) via `PUBLIC_MAPBOX_TOKEN` (a Mapbox **public** `pk.` token, set as an env var — required for the map to load)
- **Host:** Vercel (static site + weekly cron + Blob storage)
- **Geocoding:** U.S. Census Bureau geocoder (free, no key), with a persistent address→lat/lng cache so addresses are only ever geocoded once

## How it works

A Vercel Cron (`vercel.json`) hits `GET /api/update` every Monday at 1pm UTC. That
serverless function:

1. Downloads the raw CSV export from ArcGIS.
2. Validates expected columns.
3. Deduplicates the case-tracking rows into **one row per bite incident** (`bite_no`).
4. Normalizes messy fields (`victim_relation`, `bite_circumstance`, `bite_severity`, `sex`, …) and renames them to friendly names.
5. Geocodes **only addresses not already in the cache** (a JSON blob in Vercel Blob), rate-limited against the Census API.
6. Writes the cleaned dataset + updated cache to Vercel Blob.

The frontend loads the dataset server-side from Blob (falling back to the seeded
`seed/data.json` if no run has happened yet), so no blob token is exposed to the browser.

## Features

- **Layer views** — hex bin, grid, heat map, points, and clusters. Views can be stacked
  (toggle multiple on at once); hex/grid/point sizes are adjustable. Hex/grid bins are
  computed client-side (reliable at any zoom); the heat map uses mapbox's native layer.
- **Color by** — applies to the Points view; pick any categorical or numeric field.
- **Filters** — every field is filterable (value chips for categorical, a single dual-range
  slider for numeric, date range for dates).
- **Basemaps** — Default, Streets, Dark, and Satellite.
- **Dark mode** — toggle in the header, persisted to localStorage.

## Local development

```bash
npm install
npm run dev
```

The dev server reads/writes local files under `data/` instead of Vercel Blob
(no `BLOB_READ_WRITE_TOKEN` set). A pre-cleaned, fully geocoded dataset ships in
`src/lib/server/pipeline/seed/`, so the site works out of the box.

### Run the pipeline locally

```bash
npm run pipeline                 # full run (download → clean → geocode → write data/)
SKIP_GEOCODE=1 npm run pipeline  # skip the geocoder (faster validation run)
```

The local geocode cache accumulates under `data/geocode-cache.json`. When you have a
new baseline you want deployed, copy it into the seed:

```bash
cp data/geocode-cache.json src/lib/server/pipeline/seed/geocode-cache.json
cp data/data.json           src/lib/server/pipeline/seed/data.json
```

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Create a Blob store (`Storage → Create → Blob`), then add its token:
   ```bash
   vercel env add BLOB_READ_WRITE_TOKEN
   vercel env add CRON_SECRET   # any long random string
   ```
3. Deploy. The cron is defined in `vercel.json` (schedule `0 13 * * 1`).
   - `CRON_SECRET` is sent by Vercel Cron as `Authorization: Bearer …`; the endpoint rejects anything else.
   - `maxDuration: 300` (set via `export const config` in `src/routes/api/update/+server.ts`) gives the update function headroom (60s cap on the free Hobby plan — fine for incremental runs since the cache is seeded; the first-ever run on a fresh store is the only long one).

You can also trigger a manual update (works from anywhere with the secret):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/update
```

## Useful commands

```bash
npm run dev       # dev server
npm run build     # production build
npm run preview   # preview the build
npm run check     # svelte-check (types)
npm run lint      # prettier check + svelte-check
npm run format    # auto-format
npm run pipeline  # run the data pipeline
```

## Branding

Uses the Terence Crutcher Foundation brand (colors, TheNeue + Gräbenbach fonts, logos).
See https://brand.terencecrutcherfoundation.org for the full brand kit.
