"use client";

import { useEffect, useMemo, useState } from "react";
import { GAMES, getDailyGame, playGame } from "@/lib/game-engine";
import type { DailySave, PlayResult, PublicScore } from "@/lib/types";

const SAVE_KEY = "daily-one-chance-save";

const defaultScores: PublicScore[] = [
  { name: "Mira", streak: 17, wins: 24, losses: 9 },
  { name: "Jax", streak: 11, wins: 19, losses: 8 },
  { name: "Nova", streak: 8, wins: 16, losses: 6 },
  { name: "You", streak: 0, wins: 0, losses: 0 }
];

function todayKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function msUntilTomorrow() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function loadSave(): DailySave {
  if (typeof window === "undefined") {
    return { wins: 0, losses: 0, streak: 0, bestStreak: 0, history: [] };
  }

  const saved = window.localStorage.getItem(SAVE_KEY);
  if (!saved) {
    return { wins: 0, losses: 0, streak: 0, bestStreak: 0, history: [] };
  }

  try {
    return JSON.parse(saved) as DailySave;
  } catch {
    return { wins: 0, losses: 0, streak: 0, bestStreak: 0, history: [] };
  }
}

export default function Home() {
  const [save, setSave] = useState<DailySave>(() => ({
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    history: []
  }));
  const [result, setResult] = useState<PlayResult | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [countdown, setCountdown] = useState(msUntilTomorrow());
  const [mounted, setMounted] = useState(false);

  const today = todayKey();
  const alreadyPlayed = save.lastPlayed === today;
  const dailyGame = useMemo(() => getDailyGame(today), [today]);
  const recentHistory = save.history.slice(0, 5);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const loaded = loadSave();
      setSave(loaded);
      setResult(loaded.history.find((entry) => entry.date === today) ?? null);
      setMounted(true);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [today]);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(msUntilTomorrow()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mounted) {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    }
  }, [mounted, save]);

  async function handlePlay() {
    if (alreadyPlayed || isRevealing) {
      return;
    }

    setIsRevealing(true);

    window.setTimeout(() => {
      const nextResult = playGame(dailyGame, today);
      setResult(nextResult);
      setSave((current) => {
        const won = nextResult.outcome === "win";
        const nextStreak = won ? current.streak + 1 : 0;

        return {
          wins: current.wins + (won ? 1 : 0),
          losses: current.losses + (won ? 0 : 1),
          streak: nextStreak,
          bestStreak: Math.max(current.bestStreak, nextStreak),
          lastPlayed: today,
          history: [nextResult, ...current.history].slice(0, 30)
        };
      });
      setIsRevealing(false);
    }, 1900);
  }

  const scores = useMemo(() => {
    const player: PublicScore = {
      name: "You",
      streak: save.streak,
      wins: save.wins,
      losses: save.losses
    };

    return [player, ...defaultScores.filter((score) => score.name !== "You")]
      .sort((a, b) => b.streak - a.streak || b.wins - a.wins)
      .slice(0, 5);
  }, [save]);

  const totalGames = save.wins + save.losses;
  const winRate = totalGames > 0 ? Math.round((save.wins / totalGames) * 100) : 0;

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Daily reset at midnight</p>
          <h1>Daily One Chance</h1>
          <p className="lede">
            One day. One randomly selected luck game. One button that may become a tiny legend or a
            very stylish mistake.
          </p>
        </div>
        <div className="countdown-panel" aria-label="Daily reset countdown">
          <span>Next chance in</span>
          <strong>{formatCountdown(countdown)}</strong>
        </div>
      </section>

      <section className="arena" aria-live="polite">
        <div className="game-card">
          <div className="game-header">
            <span className="game-icon">{dailyGame.icon}</span>
            <div>
              <p className="eyebrow">Today&apos;s fate</p>
              <h2>{dailyGame.name}</h2>
            </div>
          </div>

          <div className={`reveal-stage ${isRevealing ? "is-revealing" : ""}`}>
            <div className="orb">{result?.visual ?? dailyGame.icon}</div>
            <div>
              <p className="stage-label">
                {isRevealing ? "Fate is checking its calendar..." : result?.outcome ?? "Ready"}
              </p>
              <p className="stage-message">
                {isRevealing
                  ? dailyGame.suspense
                  : result?.message ?? dailyGame.description}
              </p>
            </div>
          </div>

          <button className="play-button" onClick={handlePlay} disabled={alreadyPlayed || isRevealing}>
            {alreadyPlayed ? "Come Back Tomorrow" : isRevealing ? "Revealing..." : "Take Today's Chance"}
          </button>
        </div>

        <div className="side-stack">
          <div className="stat-grid">
            <div>
              <span>Streak</span>
              <strong>{save.streak}</strong>
            </div>
            <div>
              <span>Best</span>
              <strong>{save.bestStreak}</strong>
            </div>
            <div>
              <span>Wins</span>
              <strong>{save.wins}</strong>
            </div>
            <div>
              <span>Win Rate</span>
              <strong>{winRate}%</strong>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <h3>Global Pulse</h3>
              <span>{Math.max(1387, totalGames + 1387).toLocaleString()} plays</span>
            </div>
            <div className="pulse-bars">
              <span style={{ "--bar": "64%" } as React.CSSProperties}>Wins</span>
              <span style={{ "--bar": "36%" } as React.CSSProperties}>Losses</span>
              <span style={{ "--bar": "4%" } as React.CSSProperties}>Rare Events</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel">
          <div className="panel-title">
            <h3>Leaderboard</h3>
            <span>Streak race</span>
          </div>
          <ol className="leaderboard">
            {scores.map((score) => (
              <li key={score.name}>
                <span>{score.name}</span>
                <strong>{score.streak} days</strong>
                <small>
                  {score.wins}W / {score.losses}L
                </small>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel">
          <div className="panel-title">
            <h3>Game Pool</h3>
            <span>{GAMES.length} games</span>
          </div>
          <div className="game-list">
            {GAMES.map((game) => (
              <article key={game.id}>
                <span>{game.icon}</span>
                <div>
                  <strong>{game.name}</strong>
                  <p>{game.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel history-panel">
          <div className="panel-title">
            <h3>Recent Chances</h3>
            <span>{recentHistory.length || "No"} logged</span>
          </div>
          {recentHistory.length > 0 ? (
            <div className="history-list">
              {recentHistory.map((entry) => (
                <div key={entry.date}>
                  <span>{entry.date}</span>
                  <strong className={entry.outcome}>{entry.outcome}</strong>
                  <small>{entry.gameName}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Your saga begins with one suspiciously shiny button.</p>
          )}
        </div>
      </section>
    </main>
  );
}
