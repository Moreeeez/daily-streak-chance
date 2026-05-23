import { sanitizePlayerName } from "../game-engine";
import type { GlobalStats, PublicScore, RunResult } from "../types";

type StoredRun = RunResult & {
  safeName: string;
};

const demoScores: PublicScore[] = [
  { name: "Mira", streak: 17, bestStreak: 21, score: 480, wins: 68, losses: 27 },
  { name: "Jax", streak: 11, bestStreak: 13, score: 420, wins: 61, losses: 34 },
  { name: "Nova", streak: 8, bestStreak: 12, score: 360, wins: 54, losses: 31 }
];

const runs = new Map<string, StoredRun>();

export async function getLeaderboard() {
  const liveScores = Array.from(runs.values()).map((run) => ({
    name: run.playerName,
    streak: run.streakAfter,
    bestStreak: run.bestStreak,
    score: run.score,
    wins: run.totalWins,
    losses: run.totalLosses
  }));

  return [...liveScores, ...demoScores]
    .sort((a, b) => b.score - a.score || b.streak - a.streak)
    .slice(0, 25);
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const completedRuns = Array.from(runs.values());
  const liveWins = completedRuns.reduce((total, run) => total + run.totalWins, 0);
  const liveLosses = completedRuns.reduce((total, run) => total + run.totalLosses, 0);
  const liveScore = completedRuns.reduce((total, run) => total + run.score, 0);

  return {
    runs: 1387 + completedRuns.length,
    miniGames: 6935 + completedRuns.length * 5,
    wins: 3712 + liveWins,
    losses: 3223 + liveLosses,
    averageScore: completedRuns.length ? Math.round(liveScore / completedRuns.length) : 318
  };
}

export async function recordRun(payload: unknown) {
  const run = parseRun(payload);

  if (!run) {
    return { ok: false, status: 400, message: "Invalid run payload." };
  }

  const safeName = sanitizePlayerName(run.playerName);

  if (safeName.length < 2) {
    return { ok: false, status: 400, message: "Display name is too short." };
  }

  const key = dailyRunKey(safeName, run.date);

  if (runs.has(key)) {
    return { ok: false, status: 409, message: "This player already submitted a run today." };
  }

  runs.set(key, { ...run, playerName: safeName, safeName });

  return { ok: true, status: 200, run: { ...run, playerName: safeName } };
}

function dailyRunKey(name: string, date: string) {
  return `${date}:${name.toLowerCase()}`;
}

function parseRun(payload: unknown): RunResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const run = payload as Partial<RunResult>;

  if (
    typeof run.playerName !== "string" ||
    typeof run.date !== "string" ||
    !Array.isArray(run.games) ||
    run.games.length !== 5 ||
    typeof run.totalWins !== "number" ||
    typeof run.totalLosses !== "number" ||
    run.totalWins + run.totalLosses !== 5 ||
    typeof run.score !== "number"
  ) {
    return null;
  }

  return run as RunResult;
}
