import type { GlobalStats, PublicScore } from "../types";

const demoScores: PublicScore[] = [
  { name: "Mira", streak: 17, wins: 24, losses: 9 },
  { name: "Jax", streak: 11, wins: 19, losses: 8 },
  { name: "Nova", streak: 8, wins: 16, losses: 6 }
];

const demoStats: GlobalStats = {
  plays: 1387,
  wins: 642,
  losses: 745,
  rareEvents: 31
};

export async function getLeaderboard() {
  return demoScores;
}

export async function getGlobalStats() {
  return demoStats;
}

export async function recordPlay() {
  // Future Vercel KV / Upstash Redis write point.
  return { ok: true };
}
