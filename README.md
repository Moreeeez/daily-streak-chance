# Daily One Chance

A polished luck-based web game where each player gets exactly one dramatic chance per day.

## Features

- One play per day with a daily reset countdown
- Random game selection across five luck games
- Streaks, wins, losses, leaderboard, and global stats
- Rare events, suspense animations, and funny result messages
- Mobile-friendly dark UI
- Next.js App Router API structure prepared for Vercel KV / Upstash Redis

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deployment

This project is ready for Vercel. Later, add Vercel KV or Upstash Redis credentials and replace the mock store in `src/lib/server/store.ts`.
