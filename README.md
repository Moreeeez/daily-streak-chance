# Daily Streak Chance

A polished luck-based mini-game collection where the goal is to land a perfect 5-game winning streak.

## Features

- Display-name entry before starting
- One full run with all five mini games in randomized order
- Real mini-game mechanics for Coin Flip, Rock Paper Scissors, Baccarat, Pick A Door, and Glitch Chambers
- Perfect-run streaks, wins, losses, leaderboard, history, daily rank, and shareable results
- Mobile-friendly arcade casino UI
- Next.js App Router API structure prepared for Vercel KV / Upstash Redis

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deployment

This project is ready for Vercel. Later, add Vercel KV or Upstash Redis credentials and replace the in-memory map in `src/lib/server/store.ts`.
