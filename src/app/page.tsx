"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dealBaccarat,
  formatCountdown,
  getGame,
  msUntilTomorrow,
  randomizeGameOrder,
  resolveChamber,
  resolveCoinFlip,
  resolveDoor,
  resolveRps,
  sanitizePlayerName,
  todayKey
} from "@/lib/game-engine";
import type { GameId, MiniGameResult, PlayerSave, PlayingCard, PublicScore, RunResult } from "@/lib/types";

const SAVE_PREFIX = "daily-one-chance-player";
const NAME_KEY = "daily-one-chance-name";
const MUTE_KEY = "daily-one-chance-muted";
const USER_RUN_DATE_KEY = "daily-streak-chance-user-run-date";
const USER_RUN_RESULT_KEY = "daily-streak-chance-user-run-result";

type SoundName =
  | "button"
  | "cardDeal"
  | "cardFlip"
  | "coinFlip"
  | "coinLand"
  | "rpsReveal"
  | "doorOpen"
  | "chamberSpin"
  | "chamberBang"
  | "win"
  | "loss"
  | "final";

type PlaySound = (sound: SoundName) => void;

type StartRunResponse =
  | { ok: true; status: number; playerName: string; date: string }
  | { ok: false; status: number; message: string; run?: RunResult };

const demoScores: PublicScore[] = [
  { name: "Mira", streak: 17, bestStreak: 21, score: 480, wins: 68, losses: 27 },
  { name: "Jax", streak: 11, bestStreak: 13, score: 420, wins: 61, losses: 34 },
  { name: "Nova", streak: 8, bestStreak: 12, score: 360, wins: 54, losses: 31 }
];

function defaultSave(playerName: string): PlayerSave {
  return { playerName, streak: 0, bestStreak: 0, totalWins: 0, totalLosses: 0, history: [] };
}

function saveKey(name: string) {
  return `${SAVE_PREFIX}:${name.toLowerCase()}`;
}

function loadPlayerSave(playerName: string): PlayerSave {
  const saved = window.localStorage.getItem(saveKey(playerName));
  if (!saved) return defaultSave(playerName);

  try {
    return { ...defaultSave(playerName), ...(JSON.parse(saved) as PlayerSave), playerName };
  } catch {
    return defaultSave(playerName);
  }
}

function loadUserRunResult() {
  const saved = window.localStorage.getItem(USER_RUN_RESULT_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as RunResult;
  } catch {
    return null;
  }
}

export default function Home() {
  const [displayName, setDisplayName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [save, setSave] = useState<PlayerSave | null>(null);
  const [screen, setScreen] = useState<"name" | "game" | "final">("name");
  const [order, setOrder] = useState<GameId[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<MiniGameResult[]>([]);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeDate, setActiveDate] = useState("");

  const today = todayKey();
  const activeGameId = order[activeIndex];
  const activeGame = activeGameId ? getGame(activeGameId) : null;

  useEffect(() => {
    const updateCountdown = () => setCountdown(msUntilTomorrow());
    const firstTick = window.setTimeout(updateCountdown, 0);
    const timer = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setNameInput(sanitizePlayerName(window.localStorage.getItem(NAME_KEY) ?? ""));
      setMuted(window.localStorage.getItem(MUTE_KEY) === "true");
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (displayName && save) {
      window.localStorage.setItem(NAME_KEY, displayName);
      window.localStorage.setItem(saveKey(displayName), JSON.stringify(save));
    }
  }, [displayName, save]);

  useEffect(() => {
    window.localStorage.setItem(MUTE_KEY, String(muted));
  }, [muted]);

  const playSound = useCallback(
    (sound: SoundName) => {
      if (muted) return;
      playTone(sound);
    },
    [muted]
  );

  const leaderboard = useMemo(() => {
    const playerScore: PublicScore | null = save
      ? {
          name: save.playerName,
          streak: save.streak,
          bestStreak: save.bestStreak,
          score: save.history[0]?.score ?? 0,
          wins: save.totalWins,
          losses: save.totalLosses
        }
      : null;

    return [...(playerScore ? [playerScore] : []), ...demoScores]
      .sort((a, b) => b.score - a.score || b.streak - a.streak)
      .slice(0, 8);
  }, [save]);

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = sanitizePlayerName(nameInput);

    if (cleanName.length < 2) {
      setMessage("Use at least two characters.");
      return;
    }

    playSound("button");
    setMessage("Checking today's chance...");

    const startResponse = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: cleanName })
    }).catch(() => null);

    if (!startResponse) {
      setMessage("Could not verify today's chance. Try again in a moment.");
      return;
    }

    const startData = (await startResponse.json().catch(() => null)) as StartRunResponse | null;

    if (!startData) {
      setMessage("Could not read the daily chance response.");
      return;
    }

    const userRunDate = window.localStorage.getItem(USER_RUN_DATE_KEY);
    const userRunResult = loadUserRunResult();
    const loaded = loadPlayerSave(cleanName);
    setDisplayName(cleanName);
    setSave(loaded);
    setMessage("");

    if (!startData.ok) {
      if (startData.run) {
        setLastRun(startData.run);
        setActiveDate(startData.run.date);
        window.localStorage.setItem(USER_RUN_DATE_KEY, startData.run.date);
        window.localStorage.setItem(USER_RUN_RESULT_KEY, JSON.stringify(startData.run));
        setScreen("final");
        return;
      }

      if (userRunDate === today && userRunResult) {
        setLastRun(userRunResult);
        setActiveDate(userRunResult.date);
        setScreen("final");
        return;
      }

      setMessage(startData.message);
      return;
    }

    if (userRunDate === startData.date && userRunResult) {
      setLastRun(userRunResult);
      setActiveDate(userRunResult.date);
      setScreen("final");
      return;
    }

    setLastRun(null);
    setActiveDate(startData.date);
    setOrder(randomizeGameOrder(`${startData.date}:${cleanName}`));
    setActiveIndex(0);
    setResults([]);
    setScreen("game");
  }

  function recordMiniGame(result: MiniGameResult) {
    const nextResults = [...results, result];
    const nextIndex = activeIndex + 1;
    setResults(nextResults);
    setActiveIndex(nextIndex);

    if (nextIndex >= order.length) {
      void finishRun(nextResults);
    }
  }

  async function finishRun(runResults: MiniGameResult[]) {
    if (!save || isSubmitting) return;

    setIsSubmitting(true);
    const totalWins = runResults.filter((result) => result.outcome === "win").length;
    const totalLosses = runResults.length - totalWins;
    const perfectRun = totalWins === runResults.length;
    const streakAfter = perfectRun ? save.streak + 1 : 0;
    const score = totalWins * 100 - totalLosses * 25 + streakAfter * 25;
    const runDate = activeDate || today;
    const run: RunResult = {
      playerName: save.playerName,
      date: runDate,
      order,
      games: runResults,
      totalWins,
      totalLosses,
      winRate: Math.round((totalWins / runResults.length) * 100),
      streakBefore: save.streak,
      streakAfter,
      bestStreak: Math.max(save.bestStreak, streakAfter),
      score,
      dailyRank: Math.max(1, 6 - totalWins),
      completedAt: new Date().toISOString()
    };

    setSave((current) => {
      if (!current || current.lastPlayed === runDate) return current;

      return {
        ...current,
        streak: streakAfter,
        bestStreak: Math.max(current.bestStreak, streakAfter),
        totalWins: current.totalWins + totalWins,
        totalLosses: current.totalLosses + totalLosses,
        lastPlayed: runDate,
        history: [run, ...current.history].slice(0, 20)
      };
    });
    setLastRun(run);
    setScreen("final");
    window.localStorage.setItem(USER_RUN_DATE_KEY, runDate);
    window.localStorage.setItem(USER_RUN_RESULT_KEY, JSON.stringify(run));
    playSound("final");

    await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run)
    }).catch(() => undefined);

    setIsSubmitting(false);
  }

  return (
    <main className={`app-shell ${screen}`}>
      <button
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        className="mute-button"
        onClick={() => setMuted((current) => !current)}
        type="button"
      >
        {muted ? "Sound Off" : "Sound On"}
      </button>
      {screen === "name" ? (
        <NameScene
          countdown={countdown}
          message={message}
          nameInput={nameInput}
          onNameChange={setNameInput}
          onSubmit={handleNameSubmit}
        />
      ) : null}

      {screen === "game" && activeGame ? (
        <GameScene
          gameId={activeGame.id}
          gameNumber={activeIndex + 1}
          playerName={displayName}
          results={results}
          playSound={playSound}
          totalGames={order.length}
          onComplete={recordMiniGame}
        />
      ) : null}

      {screen === "final" && lastRun ? (
        <FinalScene
          countdown={countdown}
          leaderboard={leaderboard}
          run={lastRun}
          showLeaderboard={showLeaderboard}
          playSound={playSound}
          onToggleLeaderboard={() => setShowLeaderboard((visible) => !visible)}
        />
      ) : null}
    </main>
  );
}

function NameScene({
  countdown,
  message,
  nameInput,
  onNameChange,
  onSubmit
}: {
  countdown: number;
  message: string;
  nameInput: string;
  onNameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="name-scene">
      <div className="brand-lockup">
        <p>Next reset {formatCountdown(countdown)}</p>
        <h1>Daily Streak Chance</h1>
      </div>
      <form className="name-form" onSubmit={onSubmit}>
        <label htmlFor="display-name">Player name</label>
        <input
          autoFocus
          id="display-name"
          maxLength={24}
          placeholder="Lucky Human"
          value={nameInput}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <button type="submit">Chase 5 Wins</button>
        {message ? <span>{message}</span> : null}
      </form>
    </section>
  );
}

function GameScene({
  gameId,
  gameNumber,
  playerName,
  results,
  playSound,
  totalGames,
  onComplete
}: {
  gameId: GameId;
  gameNumber: number;
  playerName: string;
  results: MiniGameResult[];
  playSound: PlaySound;
  totalGames: number;
  onComplete: (result: MiniGameResult) => void;
}) {
  const game = getGame(gameId);
  const wins = results.filter((result) => result.outcome === "win").length;
  const losses = results.length - wins;

  return (
    <section className={`game-scene ${gameId}`}>
      <div className="scene-hud">
        <span>Game {gameNumber}/{totalGames}</span>
        <span>{wins}W / {losses}L</span>
        <span>{playerName}</span>
      </div>
      <div className="scene-title">
        <p>{game.shortName}</p>
        <h2>{game.name}</h2>
      </div>

      {gameId === "coin" ? <CoinGame playSound={playSound} onComplete={onComplete} /> : null}
      {gameId === "rps" ? <RpsGame playSound={playSound} onComplete={onComplete} /> : null}
      {gameId === "baccarat" ? <BaccaratGame playSound={playSound} onComplete={onComplete} /> : null}
      {gameId === "doors" ? <DoorGame playSound={playSound} onComplete={onComplete} /> : null}
      {gameId === "chambers" ? <ChamberGame playSound={playSound} onComplete={onComplete} /> : null}
    </section>
  );
}

function CoinGame({ playSound, onComplete }: { playSound: PlaySound; onComplete: (result: MiniGameResult) => void }) {
  const [choice, setChoice] = useState<"Heads" | "Tails" | null>(null);
  const [result, setResult] = useState<MiniGameResult | null>(null);
  const [revealing, setRevealing] = useState(false);

  function play(nextChoice: "Heads" | "Tails") {
    playSound("button");
    playSound("coinFlip");
    setChoice(nextChoice);
    setRevealing(true);
    window.setTimeout(() => {
      const nextResult = resolveCoinFlip(nextChoice);
      setResult(nextResult);
      setRevealing(false);
      playSound("coinLand");
      playSound(nextResult.outcome);
    }, 1500);
  }

  const coinFace = result ? (result.detail.includes("Heads") ? "heads" : "tails") : choice?.toLowerCase() ?? "idle";

  return (
    <PlaySurface result={result} onContinue={() => result && onComplete(result)}>
      <div className={`real-coin ${revealing ? "flip-3d" : ""}`}>
        <CoinFace face={coinFace} />
      </div>
      <ChoiceRow
        disabled={revealing || Boolean(result)}
        choices={["Heads", "Tails"] as const}
        renderChoice={(item) => <span className="choice-face">{item === "Heads" ? "H" : "T"}</span>}
        onPick={play}
      />
    </PlaySurface>
  );
}

function RpsGame({ playSound, onComplete }: { playSound: PlaySound; onComplete: (result: MiniGameResult) => void }) {
  const [result, setResult] = useState<MiniGameResult | null>(null);
  const [revealing, setRevealing] = useState(false);

  function play(choice: "Rock" | "Paper" | "Scissors") {
    playSound("button");
    setRevealing(true);
    window.setTimeout(() => {
      const nextResult = resolveRps(choice);
      setResult(nextResult);
      setRevealing(false);
      playSound("rpsReveal");
      playSound(nextResult.outcome);
    }, 1000);
  }

  const opponent = result?.detail.match(/Opponent played (\w+)/)?.[1] ?? "???";

  return (
    <PlaySurface result={result} onContinue={() => result && onComplete(result)}>
      <div className={`rps-stage ${revealing ? "hand-reveal" : ""}`}>
        <Hand name={result?.playerChoice ?? "You"} />
        <strong>VS</strong>
        <Hand name={opponent} />
      </div>
      <ChoiceRow
        disabled={revealing || Boolean(result)}
        choices={["Rock", "Paper", "Scissors"] as const}
        renderChoice={(item) => <HandIcon hand={item} compact />}
        onPick={play}
      />
    </PlaySurface>
  );
}

function BaccaratGame({ playSound, onComplete }: { playSound: PlaySound; onComplete: (result: MiniGameResult) => void }) {
  const [choice, setChoice] = useState<"Player" | "Banker" | null>(null);
  const [deal, setDeal] = useState<ReturnType<typeof dealBaccarat> | null>(null);
  const [revealing, setRevealing] = useState(false);

  function play(nextChoice: "Player" | "Banker") {
    playSound("button");
    playSound("cardDeal");
    setChoice(nextChoice);
    setRevealing(true);
    window.setTimeout(() => {
      const nextDeal = dealBaccarat(nextChoice);
      setDeal(nextDeal);
      setRevealing(false);
      playSound("cardFlip");
      playSound(nextDeal.result.outcome);
    }, 1600);
  }

  return (
    <PlaySurface result={deal?.result ?? null} onContinue={() => deal && onComplete(deal.result)}>
      <div className={`baccarat-table ${revealing ? "cards-dealing" : ""}`}>
        <CardHand cards={deal?.playerHand} title="Player" value={deal?.playerValue} />
        <CardHand cards={deal?.bankerHand} title="Banker" value={deal?.bankerValue} />
      </div>
      <ChoiceRow disabled={revealing || Boolean(deal)} choices={["Player", "Banker"] as const} onPick={play} />
      {choice && !deal ? <p className="scene-note">Bet placed on {choice}</p> : null}
    </PlaySurface>
  );
}

function DoorGame({ playSound, onComplete }: { playSound: PlaySound; onComplete: (result: MiniGameResult) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [safeDoor, setSafeDoor] = useState<number | null>(null);
  const [result, setResult] = useState<MiniGameResult | null>(null);

  function play(door: number) {
    playSound("button");
    playSound("doorOpen");
    setChoice(door);
    window.setTimeout(() => {
      const resolved = resolveDoor(door);
      setSafeDoor(resolved.safeDoor);
      setResult(resolved.result);
      playSound(resolved.result.outcome);
    }, 950);
  }

  return (
    <PlaySurface result={result} onContinue={() => result && onComplete(result)}>
      <div className="immersive-doors">
        {[1, 2].map((door) => (
          <button
            className={`real-door ${choice === door ? "opening" : ""} ${safeDoor === door ? "safe" : safeDoor ? "lose" : ""}`}
            disabled={Boolean(choice)}
            key={door}
            onClick={() => play(door)}
          >
            <span className={`door-symbol ${safeDoor === door ? "safe-mark" : safeDoor ? "fail-mark" : ""}`}>
              {safeDoor ? (safeDoor === door ? "✓" : "!") : door}
            </span>
          </button>
        ))}
      </div>
    </PlaySurface>
  );
}

function ChamberGame({ playSound, onComplete }: { playSound: PlaySound; onComplete: (result: MiniGameResult) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [dangerChamber, setDangerChamber] = useState<number | null>(null);
  const [result, setResult] = useState<MiniGameResult | null>(null);

  function play(chamber: number) {
    playSound("button");
    playSound("chamberSpin");
    setChoice(chamber);
    window.setTimeout(() => {
      const resolved = resolveChamber(chamber);
      setDangerChamber(resolved.dangerChamber);
      setResult(resolved.result);
      playSound(resolved.result.outcome === "loss" ? "chamberBang" : "win");
    }, 1300);
  }

  return (
    <PlaySurface result={result} onContinue={() => result && onComplete(result)}>
      <div className={`barrel ${choice ? "spin" : ""}`}>
        {Array.from({ length: 6 }, (_, index) => {
          const chamber = index + 1;
          return (
            <button
              aria-label={`Chamber ${chamber}`}
              className={`barrel-chamber c${chamber} ${choice === chamber ? "chosen" : ""} ${dangerChamber === chamber ? "danger" : dangerChamber ? "safe" : ""}`}
              disabled={Boolean(choice)}
              key={chamber}
              onClick={() => play(chamber)}
            >
              <span className="chamber-mark">{dangerChamber ? (dangerChamber === chamber ? "!" : "•") : chamber}</span>
            </button>
          );
        })}
        <div className="barrel-core" />
      </div>
    </PlaySurface>
  );
}

function PlaySurface({
  children,
  result,
  onContinue
}: {
  children: React.ReactNode;
  result: MiniGameResult | null;
  onContinue: () => void;
}) {
  return (
    <div className={`play-surface ${result ? `has-result ${result.outcome}` : ""}`}>
      <div className="object-stage">{children}</div>
      {result ? (
        <div className={`result-reveal ${result.outcome}`}>
          <strong className="result-mark">{result.outcome === "win" ? "✓" : "!"}</strong>
          <span className="result-word">{result.outcome === "win" ? "Win" : "Loss"}</span>
          <p>{result.resultText}</p>
          <button onClick={onContinue}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}

function CoinFace({ face }: { face: string }) {
  return (
    <div className={`coin-face ${face}`}>
      <span className="coin-dots" />
      <span className="coin-head" />
      <span className="coin-tail" />
      <small>{face === "heads" ? "HEADS" : face === "tails" ? "TAILS" : "?"}</small>
    </div>
  );
}

function ChoiceRow<T extends string>({
  choices,
  disabled,
  renderChoice,
  onPick
}: {
  choices: readonly T[];
  disabled: boolean;
  renderChoice?: (choice: T) => React.ReactNode;
  onPick: (choice: T) => void;
}) {
  return (
    <div className="choice-row">
      {choices.map((choice) => (
        <button disabled={disabled} key={choice} onClick={() => onPick(choice)}>
          {renderChoice ? renderChoice(choice) : null}
          <span>{choice}</span>
        </button>
      ))}
    </div>
  );
}

function Hand({ name }: { name: string }) {
  return (
    <div className={`hand-card ${name.toLowerCase()}`}>
      <HandIcon hand={name} />
      <small>{name}</small>
    </div>
  );
}

function HandIcon({ hand, compact = false }: { hand: string; compact?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`hand-icon ${compact ? "compact" : ""} ${hand.toLowerCase()}`}
      viewBox="0 0 160 160"
    >
      <defs>
        <linearGradient id="skinGradient" x1="28" x2="128" y1="24" y2="148" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd8aa" />
          <stop offset="0.55" stopColor="#efb77f" />
          <stop offset="1" stopColor="#d99361" />
        </linearGradient>
      </defs>
      {hand === "Scissors" ? (
        <>
          <path className="skin" d="M54 92 C45 68 37 42 48 36 C60 30 70 58 78 82 C82 55 87 24 100 25 C114 26 113 60 105 95 L125 74 C134 65 147 74 139 87 L119 124 C111 139 99 147 80 147 H66 C45 147 29 132 30 113 C31 101 41 94 54 92Z" />
          <path className="nail" d="M48 40 C54 37 59 39 62 45 M99 30 C105 29 109 33 110 39" />
          <path className="line" d="M78 82 C86 98 89 112 87 129 M56 93 C66 103 72 115 72 132 M105 96 L94 123 M61 112 C76 104 94 106 109 119" />
        </>
      ) : hand === "Paper" ? (
        <>
          <path className="skin" d="M30 94 C30 80 45 79 50 91 V42 C50 31 64 30 66 41 V82 V28 C66 17 81 17 82 28 V82 V36 C82 25 98 25 99 37 V86 V51 C99 41 113 42 114 53 V101 C114 130 97 147 72 147 H63 C42 147 30 123 30 94Z" />
          <path className="nail" d="M54 39 H62 M70 26 H78 M87 35 H95 M103 50 H111" />
          <path className="line" d="M50 91 V116 M66 82 V120 M82 82 V121 M99 86 V116 M43 111 C58 103 84 103 105 114" />
        </>
      ) : hand === "Rock" ? (
        <>
          <path className="skin" d="M41 76 C40 58 57 54 65 69 C68 51 85 48 91 66 C98 52 114 56 114 76 C128 80 134 92 130 111 C125 134 108 147 79 147 H68 C45 147 29 132 30 108 C31 91 34 80 41 76Z" />
          <path className="nail" d="M48 69 C54 66 61 67 65 72 M75 63 C82 60 87 62 91 68 M99 65 C106 64 111 67 113 74" />
          <path className="line" d="M48 78 C57 74 63 77 68 86 M73 70 C82 68 88 73 91 86 M96 72 C105 71 111 78 112 89 M48 101 H115 M50 119 C67 112 92 112 111 123" />
        </>
      ) : (
        <>
          <path className="skin" d="M45 72 C48 49 72 36 96 45 C118 53 130 75 125 101 C120 128 100 145 75 142 C49 139 33 118 37 94 C39 84 41 77 45 72Z" />
          <path className="line" d="M58 94 C70 83 91 82 104 96" />
        </>
      )}
    </svg>
  );
}

function CardHand({
  title,
  value,
  cards
}: {
  title: string;
  value?: number;
  cards?: PlayingCard[];
}) {
  return (
    <div className="card-side">
      <div className="card-side-label">
        <span>{title}</span>
        <strong>{typeof value === "number" ? value : "-"}</strong>
      </div>
      <div className="cards">
        {(cards ?? [null, null]).map((card, index) => (
          <PlayingCardFace card={card} key={index} index={index} />
        ))}
      </div>
    </div>
  );
}

function PlayingCardFace({ card, index }: { card: PlayingCard | null; index: number }) {
  const suit = card ? suitSymbol(card.suit) : "";
  const red = card?.suit === "H" || card?.suit === "D";

  return (
    <div className={`playing-card ${red ? "red" : "black"} ${card ? "revealed" : "back"}`} style={{ "--deal-delay": `${index * 140}ms` } as React.CSSProperties}>
      {card ? (
        <>
          <div className="card-corner top">
            <strong>{card.rank}</strong>
            <span>{suit}</span>
          </div>
          <div className="card-suit">{suit}</div>
          <div className="card-corner bottom">
            <strong>{card.rank}</strong>
            <span>{suit}</span>
          </div>
        </>
      ) : (
        <div className="card-back-pattern" />
      )}
    </div>
  );
}

function suitSymbol(suit: PlayingCard["suit"]) {
  return { S: "♠", H: "♥", D: "♦", C: "♣" }[suit];
}

function FinalScene({
  countdown,
  leaderboard,
  run,
  showLeaderboard,
  playSound,
  onToggleLeaderboard
}: {
  countdown: number;
  leaderboard: PublicScore[];
  run: RunResult;
  showLeaderboard: boolean;
  playSound: PlaySound;
  onToggleLeaderboard: () => void;
}) {
  const message = run.totalWins === 5
    ? "Perfect 5-game streak. That one goes on the board."
    : run.totalWins >= 3
      ? "Close run. The streak wants a cleaner sweep tomorrow."
      : "The table won this round. Reset, breathe, return.";

  return (
    <section className="final-scene">
      <p className="final-kicker">5-win streak attempt</p>
      <h1>{run.playerName}</h1>
      <div className="final-scoreline">
        <span>{run.totalWins}/5 Wins</span>
        <span>{run.totalLosses} Losses</span>
        <span>{run.winRate}%</span>
        <span>Perfect Streak {run.streakBefore} -&gt; {run.streakAfter}</span>
      </div>
      <p className="daily-message">{message}</p>
      <div className="final-actions">
        <button onClick={() => {
          playSound("button");
          onToggleLeaderboard();
        }}>{showLeaderboard ? "Hide Leaderboard" : "Leaderboard"}</button>
        <span>Play again in {formatCountdown(countdown)}</span>
      </div>
      {showLeaderboard ? (
        <ol className="leaderboard-list">
          {leaderboard.map((score) => (
            <li key={`${score.name}-${score.score}`}>
              <span>{score.name}</span>
              <strong>{score.score}</strong>
              <small>{score.streak} streak</small>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function playTone(sound: SoundName) {
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const audio = new AudioContextClass();
  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.42, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
  master.connect(audio.destination);

  const patterns: Record<SoundName, Array<{ frequency: number; time: number; duration: number; type?: OscillatorType; volume?: number }>> = {
    button: [
      { frequency: 740, time: 0, duration: 0.06, type: "triangle", volume: 0.34 },
      { frequency: 1040, time: 0.035, duration: 0.055, type: "sine", volume: 0.18 }
    ],
    cardDeal: [
      { frequency: 150, time: 0, duration: 0.05, type: "triangle", volume: 0.36 },
      { frequency: 210, time: 0.07, duration: 0.05, type: "triangle", volume: 0.32 },
      { frequency: 260, time: 0.14, duration: 0.05, type: "triangle", volume: 0.28 }
    ],
    cardFlip: [
      { frequency: 720, time: 0, duration: 0.06, type: "square", volume: 0.18 },
      { frequency: 520, time: 0.06, duration: 0.08, type: "triangle", volume: 0.34 },
      { frequency: 980, time: 0.15, duration: 0.06, type: "sine", volume: 0.2 }
    ],
    coinFlip: [
      { frequency: 1260, time: 0, duration: 0.045, type: "sine", volume: 0.28 },
      { frequency: 1540, time: 0.055, duration: 0.045, type: "sine", volume: 0.26 },
      { frequency: 1110, time: 0.11, duration: 0.045, type: "sine", volume: 0.24 },
      { frequency: 1680, time: 0.165, duration: 0.045, type: "sine", volume: 0.22 },
      { frequency: 920, time: 0.22, duration: 0.05, type: "sine", volume: 0.2 }
    ],
    coinLand: [
      { frequency: 290, time: 0, duration: 0.09, type: "triangle", volume: 0.5 },
      { frequency: 145, time: 0.065, duration: 0.22, type: "sine", volume: 0.34 },
      { frequency: 880, time: 0.015, duration: 0.035, type: "square", volume: 0.16 }
    ],
    rpsReveal: [
      { frequency: 140, time: 0, duration: 0.07, type: "sawtooth", volume: 0.34 },
      { frequency: 170, time: 0.09, duration: 0.07, type: "sawtooth", volume: 0.32 },
      { frequency: 520, time: 0.18, duration: 0.1, type: "triangle", volume: 0.32 },
      { frequency: 760, time: 0.28, duration: 0.08, type: "sine", volume: 0.2 }
    ],
    doorOpen: [
      { frequency: 68, time: 0, duration: 0.5, type: "sawtooth", volume: 0.38 },
      { frequency: 104, time: 0.18, duration: 0.34, type: "sawtooth", volume: 0.26 },
      { frequency: 520, time: 0.44, duration: 0.08, type: "triangle", volume: 0.2 }
    ],
    chamberSpin: [
      { frequency: 130, time: 0, duration: 0.055, type: "square", volume: 0.24 },
      { frequency: 165, time: 0.06, duration: 0.055, type: "square", volume: 0.24 },
      { frequency: 205, time: 0.12, duration: 0.055, type: "square", volume: 0.24 },
      { frequency: 250, time: 0.18, duration: 0.055, type: "square", volume: 0.22 },
      { frequency: 300, time: 0.24, duration: 0.055, type: "square", volume: 0.2 },
      { frequency: 355, time: 0.3, duration: 0.055, type: "square", volume: 0.18 }
    ],
    chamberBang: [
      { frequency: 72, time: 0, duration: 0.22, type: "sawtooth", volume: 0.62 },
      { frequency: 38, time: 0.015, duration: 0.38, type: "square", volume: 0.34 },
      { frequency: 860, time: 0.012, duration: 0.05, type: "square", volume: 0.24 },
      { frequency: 1200, time: 0.05, duration: 0.045, type: "sawtooth", volume: 0.16 }
    ],
    win: [
      { frequency: 523, time: 0, duration: 0.12, type: "triangle", volume: 0.34 },
      { frequency: 659, time: 0.075, duration: 0.12, type: "triangle", volume: 0.34 },
      { frequency: 784, time: 0.15, duration: 0.14, type: "triangle", volume: 0.36 },
      { frequency: 1046, time: 0.27, duration: 0.26, type: "sine", volume: 0.28 }
    ],
    loss: [
      { frequency: 196, time: 0, duration: 0.18, type: "sawtooth", volume: 0.32 },
      { frequency: 110, time: 0.12, duration: 0.28, type: "sawtooth", volume: 0.34 }
    ],
    final: [
      { frequency: 392, time: 0, duration: 0.14, type: "triangle", volume: 0.28 },
      { frequency: 523, time: 0.1, duration: 0.16, type: "triangle", volume: 0.32 },
      { frequency: 659, time: 0.2, duration: 0.18, type: "triangle", volume: 0.32 },
      { frequency: 784, time: 0.32, duration: 0.3, type: "triangle", volume: 0.34 },
      { frequency: 1046, time: 0.5, duration: 0.32, type: "sine", volume: 0.24 }
    ]
  };

  if (sound === "chamberBang") {
    playNoise(audio, master, now, 0.22, 0.58);
  }

  if (sound === "doorOpen") {
    playNoise(audio, master, now + 0.02, 0.14, 0.44);
  }

  if (sound === "cardDeal" || sound === "cardFlip") {
    playNoise(audio, master, now, 0.05, 0.2);
  }

  patterns[sound].forEach((note) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = now + note.time;
    oscillator.type = note.type ?? "sine";
    oscillator.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.2, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + note.duration + 0.02);
  });

  window.setTimeout(() => void audio.close(), 1300);
}

function playNoise(
  audio: AudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  volume: number
) {
  const sampleRate = audio.sampleRate;
  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
  }

  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900, start);
  filter.Q.setValueAtTime(0.8, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(start);
  source.stop(start + duration);
}
