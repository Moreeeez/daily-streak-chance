export type GameId = "coin" | "rps" | "baccarat" | "doors" | "roulette";

export type GameDefinition = {
  id: GameId;
  name: string;
  icon: string;
  description: string;
  suspense: string;
};

export type PlayOutcome = "win" | "loss";

export type PlayResult = {
  date: string;
  gameId: GameId;
  gameName: string;
  outcome: PlayOutcome;
  message: string;
  visual: string;
  rare: boolean;
};

export type DailySave = {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  lastPlayed?: string;
  history: PlayResult[];
};

export type PublicScore = {
  name: string;
  streak: number;
  wins: number;
  losses: number;
};

export type GlobalStats = {
  plays: number;
  wins: number;
  losses: number;
  rareEvents: number;
};
