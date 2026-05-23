import type { CardRank, CardSuit, GameDefinition, GameId, MiniGameResult, PlayingCard } from "./types";

export const GAMES: GameDefinition[] = [
  {
    id: "coin",
    name: "Coin Flip",
    shortName: "Coin",
    icon: "CF",
    description: "Choose heads or tails, then watch the coin make a tiny public decision."
  },
  {
    id: "rps",
    name: "Rock Paper Scissors",
    shortName: "RPS",
    icon: "RPS",
    description: "Pick a hand. The opponent picks fairly. Ties replay until somebody blinks."
  },
  {
    id: "baccarat",
    name: "Baccarat Hand",
    shortName: "Baccarat",
    icon: "9",
    description: "Choose Player or Banker, then reveal real cards with baccarat scoring."
  },
  {
    id: "doors",
    name: "Pick A Door",
    shortName: "Doors",
    icon: "D2",
    description: "Two doors. One safe door. One door with deeply unhelpful energy."
  },
  {
    id: "chambers",
    name: "Glitch Chambers",
    shortName: "Chambers",
    icon: "G6",
    description: "Choose one of six abstract chambers. Five are safe. One is pure glitch."
  }
];

const ranks: CardRank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: CardSuit[] = ["S", "H", "D", "C"];

export function sanitizePlayerName(name: string) {
  return name
    .replace(/[^\w .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
}

export function todayKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

export function msUntilTomorrow() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function getGame(gameId: GameId) {
  const game = GAMES.find((item) => item.id === gameId);

  if (!game) {
    throw new Error(`Unknown game: ${gameId}`);
  }

  return game;
}

export function randomizeGameOrder(seedText = `${Date.now()}-${Math.random()}`) {
  const order = GAMES.map((game) => game.id);
  let seed = hash(seedText);

  for (let index = order.length - 1; index > 0; index -= 1) {
    seed = Math.imul(seed ^ (index + 17), 16777619) >>> 0;
    const swapIndex = seed % (index + 1);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  return order;
}

export function resolveCoinFlip(choice: "Heads" | "Tails"): MiniGameResult {
  const actual = Math.random() < 0.5 ? "Heads" : "Tails";
  const won = choice === actual;

  return makeResult("coin", won, choice, actual, `The coin landed ${actual}.`);
}

export function resolveRps(choice: "Rock" | "Paper" | "Scissors") {
  const options = ["Rock", "Paper", "Scissors"] as const;
  let opponent = options[randomInt(options.length)];

  while (opponent === choice) {
    opponent = options[randomInt(options.length)];
  }

  const won =
    (choice === "Rock" && opponent === "Scissors") ||
    (choice === "Paper" && opponent === "Rock") ||
    (choice === "Scissors" && opponent === "Paper");

  return makeResult("rps", won, choice, opponent, `You played ${choice}. Opponent played ${opponent}.`);
}

export function dealBaccarat(choice: "Player" | "Banker") {
  let playerHand = [drawCard(), drawCard()];
  let bankerHand = [drawCard(), drawCard()];
  let playerValue = baccaratValue(playerHand);
  let bankerValue = baccaratValue(bankerHand);

  while (playerValue === bankerValue) {
    playerHand = [drawCard(), drawCard()];
    bankerHand = [drawCard(), drawCard()];
    playerValue = baccaratValue(playerHand);
    bankerValue = baccaratValue(bankerHand);
  }

  const actual = playerValue > bankerValue ? "Player" : "Banker";
  const won = choice === actual;

  return {
    result: makeResult(
      "baccarat",
      won,
      choice,
      actual,
      `Player ${playerValue}, Banker ${bankerValue}. ${actual} wins the hand.`
    ),
    playerHand,
    bankerHand,
    playerValue,
    bankerValue
  };
}

export function resolveDoor(choice: number) {
  const safeDoor = randomInt(2) + 1;

  return {
    result: makeResult(
      "doors",
      choice === safeDoor,
      `Door ${choice}`,
      `Door ${safeDoor}`,
      `Door ${safeDoor} was the safe door.`
    ),
    safeDoor
  };
}

export function resolveChamber(choice: number) {
  const dangerChamber = randomInt(6) + 1;

  return {
    result: makeResult(
      "chambers",
      choice !== dangerChamber,
      `Chamber ${choice}`,
      `Danger chamber ${dangerChamber}`,
      choice === dangerChamber
        ? `Chamber ${dangerChamber} glitched out. The console did not enjoy that.`
        : `Chamber ${choice} stayed stable. The danger was hiding in chamber ${dangerChamber}.`
    ),
    dangerChamber
  };
}

export function baccaratValue(cards: PlayingCard[]) {
  return cards.reduce((total, card) => total + card.value, 0) % 10;
}

export function cardLabel(card: PlayingCard) {
  return `${card.rank}${card.suit}`;
}

function makeResult(
  gameId: GameId,
  won: boolean,
  playerChoice: string,
  actual: string,
  detail: string
): MiniGameResult {
  const game = getGame(gameId);

  return {
    gameId,
    gameName: game.name,
    outcome: won ? "win" : "loss",
    playerChoice,
    resultText: won ? winCopy(gameId) : lossCopy(gameId),
    detail: `${detail} Your pick: ${playerChoice}. Result: ${actual}.`
  };
}

function drawCard(): PlayingCard {
  const rank = ranks[randomInt(ranks.length)];
  const suit = suits[randomInt(suits.length)];

  return {
    rank,
    suit,
    value: rank === "A" ? 1 : ["10", "J", "Q", "K"].includes(rank) ? 0 : Number(rank)
  };
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function hash(input: string) {
  let value = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
}

function winCopy(gameId: GameId) {
  const copy: Record<GameId, string> = {
    coin: "Correct call. The coin has accepted your tiny prophecy.",
    rps: "Clean win. Your hand had main-character timing.",
    baccarat: "Winning side. The cards briefly became your legal team.",
    doors: "Safe door found. The other doors are pretending not to be jealous.",
    chambers: "Stable chamber. The glitch had to bother someone else today."
  };

  return copy[gameId];
}

function lossCopy(gameId: GameId) {
  const copy: Record<GameId, string> = {
    coin: "Wrong side. The coin was polite, but absolutely not helpful.",
    rps: "The opponent had the counter. Very rude. Technically fair.",
    baccarat: "The other side took the hand. Fancy sadness, basically.",
    doors: "That door was not the one. It did commit to the bit, though.",
    chambers: "The chamber glitched. Abstract danger remains undefeated."
  };

  return copy[gameId];
}
