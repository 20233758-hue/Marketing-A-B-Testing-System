# Marketing A/B Testing System

A local MVP for creating A/B experiments, collecting variant impressions and conversions, and promoting a winning variant.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Setup

1. Create a PostgreSQL database (the default configuration expects `ab_testing`).
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `JWT_SECRET`.
3. Install dependencies and initialize the database:

   ```sh
   npm install
   npm run db:migrate -- --name init
   ```

4. Start the API and frontend:

   ```sh
   npm run dev
   ```

   The frontend is at <http://localhost:5173>; the API is at <http://localhost:3000>.

## Scripts

- `npm run dev` — start the API and Vite development server.
- `npm run build` — build the frontend into `dist/`.
- `npm start` — start the API.
- `npm run db:generate` — generate the Prisma client.
- `npm run db:migrate -- --name init` — apply a development migration.
- `npm run db:studio` — open Prisma Studio.

## API

- `POST /api/auth/register` — `{ "email": "...", "password": "..." }` (password must be at least 8 characters)
- `POST /api/auth/login` — returns a JWT and user profile
- `GET|POST /api/experiments` — list or create the authenticated user's experiments
- `GET|PATCH|DELETE /api/experiments/:id` — read, update, or delete an owned experiment
- `POST /api/experiments/:id/conclude` — `{ "variantId": "..." }`; atomically promotes the variant and completes the experiment
- `POST /api/track` — `{ "variantId": "...", "eventType": "impression" | "conversion" }`; returns variant totals and conversion rate

Experiment creation accepts `title`, `hypothesis`, and at least two `variants` (`name`, `content`); if variants are omitted, a control and a second starter variant are created. Tracking is intentionally unauthenticated so client-side experiences can report events. The dashboard reads authenticated experiment data and reports conversion rates per variant and in total.

## Production note

For a production deployment, serve the built frontend through a static host or reverse proxy and restrict CORS to the deployed origin. Consider adding rate limiting, email verification, and a privacy/retention policy for event data.
