import type { GameDefinition, GameId, PlayResult } from "./types";

export const GAMES: GameDefinition[] = [
  {
    id: "coin",
    name: "Coin Flip",
    icon: "◐",
    description: "Call it in your heart. The coin does not take requests, but it enjoys confidence.",
    suspense: "The coin is spinning with the dramatic timing of a reality show finale."
  },
  {
    id: "rps",
    name: "Rock Paper Scissors",
    icon: "✊",
    description: "The oldest office dispute resolution protocol in human history.",
    suspense: "The hands are hovering. Someone definitely overthought scissors."
  },
  {
    id: "baccarat",
    name: "Baccarat Hand",
    icon: "♦",
    description: "A tiny table game moment for people who pronounce luck with a flourish.",
    suspense: "The cards slide out like they have rent due."
  },
  {
    id: "doors",
    name: "Pick A Door",
    icon: "▣",
    description: "Three doors. One safe. Two deeply committed to disappointment.",
    suspense: "The doors are judging your posture."
  },
  {
    id: "roulette",
    name: "Mystery Dial",
    icon: "◉",
    description: "A non-violent suspense dial. One safe glow, several theatrical buzzers.",
    suspense: "The dial clicks softly, which is rude because it knows you can hear it."
  }
];

const winMessages = [
  "You won. Somewhere, probability just sighed and signed the paperwork.",
  "Victory. You may now walk slightly taller near vending machines.",
  "A clean win. The button respects you, which is legally rare.",
  "You survived the daily nonsense with style."
];

const lossMessages = [
  "Loss. The universe has placed you on read until tomorrow.",
  "Not today. The button made direct eye contact and chose drama.",
  "The odds did a little tap dance on your plans.",
  "A noble loss. Very cinematic. Terrible for the streak."
];

const rareMessages = [
  "Rare event: Cosmic Wink. It means nothing, but it means it beautifully.",
  "Rare event: Golden Button Energy. You are statistically interesting today.",
  "Rare event: The game paused to admire your commitment."
];

function hash(input: string) {
  let value = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
}

function pick<T>(items: T[], seed: number) {
  return items[seed % items.length];
}

export function getDailyGame(dateKey: string) {
  return pick(GAMES, hash(`game-${dateKey}`));
}

export function playGame(game: GameDefinition, dateKey: string): PlayResult {
  const seed = hash(`${game.id}-${dateKey}-${Date.now()}`);
  const roll = seed % 100;
  const rare = roll === 7 || roll === 77;
  const win = resolveWin(game.id, roll);
  const message = rare
    ? pick(rareMessages, seed)
    : pick(win ? winMessages : lossMessages, seed + game.name.length);

  return {
    date: dateKey,
    gameId: game.id,
    gameName: game.name,
    outcome: win ? "win" : "loss",
    message,
    visual: getVisual(game.id, win, rare, roll),
    rare
  };
}

function resolveWin(gameId: GameId, roll: number) {
  switch (gameId) {
    case "coin":
      return roll % 2 === 0;
    case "rps":
      return roll < 50;
    case "baccarat":
      return roll < 46;
    case "doors":
      return roll < 34;
    case "roulette":
      return roll < 18;
  }
}

function getVisual(gameId: GameId, win: boolean, rare: boolean, roll: number) {
  if (rare) {
    return "✦";
  }

  if (gameId === "coin") {
    return win ? "H" : "T";
  }

  if (gameId === "rps") {
    return ["✊", "✋", "✌"][roll % 3];
  }

  if (gameId === "baccarat") {
    return win ? "9" : "3";
  }

  if (gameId === "doors") {
    return win ? "✓" : "×";
  }

  return win ? "●" : "○";
}
