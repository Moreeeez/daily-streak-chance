# Daily Streak Chance

A polished luck-based mini-game collection where the goal is to land a perfect 5-game winning streak.

## Features

- Display-name entry before starting
- One full run with all five mini games in randomized order
- Real mini-game mechanics for Coin Flip, Rock Paper Scissors, Baccarat, Pick A Door, and Glitch Chambers
- Perfect-run streaks, wins, losses, global leaderboard, history, daily rank, and shareable results
- Server-side one-try-per-day gate based on a hashed IP address
- Mobile-friendly arcade casino UI
- Next.js App Router API structure prepared for Vercel KV / Upstash Redis

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deployment

This project is ready for Vercel. For persistent global scores, streaks, and the IP-based daily limit, add either Vercel KV or Upstash Redis REST credentials:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

or:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional:

```bash
IP_HASH_SALT=any-long-random-secret
```

Without those environment variables, the app still runs locally with an in-memory development store.
