import { createHash } from "crypto";
import { sanitizePlayerName } from "../game-engine";
import type { GlobalStats, PublicScore, RunResult } from "../types";

type StoredRun = RunResult & {
  safeName: string;
  ipHash?: string;
};

type DailyLock = {
  lastAttemptAt: string;
  nextAttemptAt: string;
  playerName: string;
  startedAt: string;
  run?: RunResult;
};

const cooldownMs = 24 * 60 * 60 * 1000;
const memoryRuns = new Map<string, StoredRun>();
const memoryPlayers = new Map<string, PublicScore>();
const memoryLocks = new Map<string, DailyLock>();

export function currentServerDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getRequestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "local";
  const salt = process.env.IP_HASH_SALT ?? "daily-streak-chance";

  return {
    ipHash: createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 40)
  };
}

export async function startDailyRun(payload: unknown, ipHash: string) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, message: "Invalid start request." };
  }

  const requestedName = (payload as { playerName?: unknown }).playerName;
  const safeName = typeof requestedName === "string" ? sanitizePlayerName(requestedName) : "";

  if (safeName.length < 2) {
    return { ok: false, status: 400, message: "Display name is too short." };
  }

  const now = new Date();
  const attemptAt = now.toISOString();
  const nextAttemptAt = new Date(now.getTime() + cooldownMs).toISOString();
  const existingLock = await getDailyLock(ipHash);

  if (existingLock && !canAttempt(existingLock, now)) {
    return {
      ok: false,
      status: 409,
      message: "Your next run is still locked.",
      nextAttemptAt: existingLock.nextAttemptAt,
      run: existingLock.run
    };
  }

  const lock: DailyLock = {
    lastAttemptAt: attemptAt,
    nextAttemptAt,
    playerName: safeName,
    startedAt: attemptAt
  };

  const created = existingLock ? await saveDailyLock(ipHash, lock) : await createDailyLock(ipHash, lock);

  if (!created) {
    const latestLock = await getDailyLock(ipHash);

    return {
      ok: false,
      status: 409,
      message: "Your next run is still locked.",
      nextAttemptAt: latestLock?.nextAttemptAt
    };
  }

  return { ok: true, status: 200, playerName: safeName, date: currentServerDate(now), nextAttemptAt };
}

export async function getLeaderboard() {
  const liveScores = await getStoredScores();

  return liveScores.sort((a, b) => b.score - a.score || b.streak - a.streak).slice(0, 25);
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const completedRuns = await getStoredRuns();
  const liveWins = completedRuns.reduce((total, run) => total + run.totalWins, 0);
  const liveLosses = completedRuns.reduce((total, run) => total + run.totalLosses, 0);
  const liveScore = completedRuns.reduce((total, run) => total + run.score, 0);

  if (!completedRuns.length) {
    return {
      runs: 0,
      miniGames: 0,
      wins: 0,
      losses: 0,
      averageScore: 0
    };
  }

  return {
    runs: completedRuns.length,
    miniGames: completedRuns.length * 5,
    wins: liveWins,
    losses: liveLosses,
    averageScore: Math.round(liveScore / completedRuns.length)
  };
}

export async function recordRun(payload: unknown, ipHash?: string) {
  const run = parseRun(payload);

  if (!run) {
    return { ok: false, status: 400, message: "Invalid run payload." };
  }

  const safeName = sanitizePlayerName(run.playerName);

  if (safeName.length < 2) {
    return { ok: false, status: 400, message: "Display name is too short." };
  }

  const now = new Date();
  const date = currentServerDate(now);
  const completedRun: StoredRun = {
    ...run,
    date,
    playerName: safeName,
    safeName,
    ipHash
  };

  if (ipHash) {
    const existingLock = await getDailyLock(ipHash);

    if (existingLock?.run && !canAttempt(existingLock, now)) {
      return {
        ok: false,
        status: 409,
        message: "Your next run is still locked.",
        nextAttemptAt: existingLock.nextAttemptAt,
        run: existingLock.run
      };
    }

    const lastAttemptAt = existingLock?.lastAttemptAt ?? now.toISOString();
    const nextAttemptAt =
      existingLock?.nextAttemptAt ?? new Date(new Date(lastAttemptAt).getTime() + cooldownMs).toISOString();

    await saveDailyLock(ipHash, {
      lastAttemptAt,
      nextAttemptAt,
      playerName: safeName,
      startedAt: existingLock?.startedAt ?? new Date().toISOString(),
      run: publicRun(completedRun)
    });
  }

  const runKey = dailyRunKey(safeName, date);

  if (await hasRun(runKey)) {
    return { ok: false, status: 409, message: "This player already submitted a run for this date." };
  }

  await saveRun(runKey, completedRun);
  await updatePlayerScore(safeName, completedRun);

  return { ok: true, status: 200, run: publicRun(completedRun) };
}

async function getStoredScores() {
  if (!hasRedis()) {
    return Array.from(memoryPlayers.values());
  }

  const names = await redisCommand<string[]>("SMEMBERS", keys.players);
  const scores = await Promise.all((names ?? []).map((name) => getJson<PublicScore>(playerKey(name))));

  return scores.filter((score): score is PublicScore => Boolean(score));
}

async function getStoredRuns() {
  if (!hasRedis()) {
    return Array.from(memoryRuns.values());
  }

  const runKeys = await redisCommand<string[]>("SMEMBERS", keys.runs);
  const runs = await Promise.all((runKeys ?? []).map((key) => getJson<StoredRun>(key)));

  return runs.filter((run): run is StoredRun => Boolean(run));
}

async function hasRun(key: string) {
  if (!hasRedis()) {
    return memoryRuns.has(key);
  }

  return Boolean(await redisCommand<number>("EXISTS", key));
}

async function saveRun(key: string, run: StoredRun) {
  if (!hasRedis()) {
    memoryRuns.set(key, run);
    return;
  }

  await setJson(key, run);
  await redisCommand("SADD", keys.runs, key);
  await redisCommand("SADD", dailyRunsKey(run.date), key);
}

async function updatePlayerScore(safeName: string, run: StoredRun) {
  const key = playerKey(safeName);
  const existing = hasRedis() ? await getJson<PublicScore>(key) : memoryPlayers.get(safeName.toLowerCase());
  const perfectRun = run.totalWins === run.games.length;
  const nextStreak = perfectRun ? (existing?.streak ?? 0) + 1 : 0;
  const nextScore: PublicScore = {
    name: safeName,
    streak: nextStreak,
    bestStreak: Math.max(existing?.bestStreak ?? 0, nextStreak),
    score: (existing?.score ?? 0) + run.score,
    wins: (existing?.wins ?? 0) + run.totalWins,
    losses: (existing?.losses ?? 0) + run.totalLosses
  };

  if (!hasRedis()) {
    memoryPlayers.set(safeName.toLowerCase(), nextScore);
    return;
  }

  await setJson(key, nextScore);
  await redisCommand("SADD", keys.players, safeName.toLowerCase());
}

async function getDailyLock(ipHash: string) {
  if (!hasRedis()) {
    return memoryLocks.get(ipLockKey(ipHash)) ?? null;
  }

  return getJson<DailyLock>(ipLockKey(ipHash));
}

async function saveDailyLock(ipHash: string, lock: DailyLock) {
  const key = ipLockKey(ipHash);

  if (!hasRedis()) {
    memoryLocks.set(key, lock);
    return true;
  }

  await setJson(key, lock);
  return true;
}

async function createDailyLock(ipHash: string, lock: DailyLock) {
  const key = ipLockKey(ipHash);

  if (!hasRedis()) {
    if (memoryLocks.has(key)) return false;
    memoryLocks.set(key, lock);
    return true;
  }

  const result = await redisCommand<string | null>("SET", key, JSON.stringify(lock), "NX");
  return result === "OK";
}

function publicRun(run: StoredRun): RunResult {
  const { safeName: _safeName, ipHash: _ipHash, ...publicResult } = run;
  return publicResult;
}

function dailyRunKey(name: string, date: string) {
  return `${keys.runPrefix}:${date}:${name.toLowerCase()}`;
}

function dailyRunsKey(date: string) {
  return `${keys.dailyRunsPrefix}:${date}`;
}

function playerKey(name: string) {
  return `${keys.playerPrefix}:${name.toLowerCase()}`;
}

function ipLockKey(ipHash: string) {
  return `${keys.ipPrefix}:${ipHash}`;
}

function canAttempt(lock: DailyLock, now = new Date()) {
  return new Date(lock.nextAttemptAt).getTime() <= now.getTime();
}

const keys = {
  runs: "dsc:runs",
  players: "dsc:players",
  runPrefix: "dsc:run",
  dailyRunsPrefix: "dsc:daily-runs",
  playerPrefix: "dsc:player",
  ipPrefix: "dsc:ip:v2"
};

function redisConfig() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  return url && token ? { url, token } : null;
}

function hasRedis() {
  return Boolean(redisConfig());
}

async function getJson<T>(key: string) {
  const raw = await redisCommand<string | null>("GET", key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJson(key: string, value: unknown) {
  await redisCommand("SET", key, JSON.stringify(value));
}

async function redisCommand<T = unknown>(command: string, ...args: unknown[]) {
  const config = redisConfig();
  if (!config) return null;

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command, ...args]),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Redis command failed: ${command}`);
  }

  const data = (await response.json()) as { result?: T };
  return data.result ?? null;
}

function parseRun(payload: unknown): RunResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const run = payload as Partial<RunResult>;

  if (
    typeof run.playerName !== "string" ||
    typeof run.date !== "string" ||
    !Array.isArray(run.order) ||
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
