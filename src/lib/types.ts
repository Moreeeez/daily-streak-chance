export type GameId = "coin" | "rps" | "baccarat" | "doors" | "chambers";

export type PlayOutcome = "win" | "loss" | "push";

export type GameDefinition = {
  id: GameId;
  name: string;
  shortName: string;
  icon: string;
  description: string;
};

export type CardRank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type CardSuit = "S" | "H" | "D" | "C";

export type PlayingCard = {
  rank: CardRank;
  suit: CardSuit;
  value: number;
};

export type MiniGameResult = {
  gameId: GameId;
  gameName: string;
  outcome: Exclude<PlayOutcome, "push">;
  playerChoice: string;
  resultText: string;
  detail: string;
};

export type RunResult = {
  playerName: string;
  date: string;
  order: GameId[];
  games: MiniGameResult[];
  totalWins: number;
  totalLosses: number;
  winRate: number;
  streakBefore: number;
  streakAfter: number;
  bestStreak: number;
  score: number;
  dailyRank: number;
  completedAt: string;
};

export type PlayerSave = {
  playerName: string;
  streak: number;
  bestStreak: number;
  totalWins: number;
  totalLosses: number;
  lastPlayed?: string;
  history: RunResult[];
};

export type PublicScore = {
  name: string;
  streak: number;
  bestStreak: number;
  score: number;
  wins: number;
  losses: number;
};

export type GlobalStats = {
  runs: number;
  miniGames: number;
  wins: number;
  losses: number;
  averageScore: number;
};
