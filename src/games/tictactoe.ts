export type TicTacToeMark = "X" | "O" | null;
export type TicTacToePlayer = Exclude<TicTacToeMark, null>;
export type TicTacToeStatus = "playing" | "won" | "draw";

export type TicTacToeState = {
  board: TicTacToeMark[];
  currentPlayer: TicTacToePlayer;
  status: TicTacToeStatus;
  winner: TicTacToePlayer | null;
};

const WIN_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const other = (player: TicTacToePlayer): TicTacToePlayer => player === "X" ? "O" : "X";

export function createTicTacToeState(): TicTacToeState {
  return {
    board: Array<TicTacToeMark>(9).fill(null),
    currentPlayer: "X",
    status: "playing",
    winner: null,
  };
}

export function findTicTacToeWinner(board: readonly TicTacToeMark[]): TicTacToePlayer | null {
  if (board.length !== 9) return null;
  for (const [a, b, c] of WIN_LINES) {
    const mark = board[a];
    if (mark !== null && mark === board[b] && mark === board[c]) return mark;
  }
  return null;
}

export function applyTicTacToeMove(
  state: TicTacToeState,
  index: number,
): TicTacToeState {
  if (
    state.status !== "playing" ||
    state.board.length !== 9 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 9 ||
    state.board[index] !== null
  ) return state;

  const board = [...state.board];
  board[index] = state.currentPlayer;
  const winner = findTicTacToeWinner(board);
  const draw = winner === null && board.every(cell => cell !== null);

  return {
    board,
    currentPlayer: winner || draw ? state.currentPlayer : other(state.currentPlayer),
    status: winner ? "won" : draw ? "draw" : "playing",
    winner,
  };
}

function scorePosition(
  board: TicTacToeMark[],
  turn: TicTacToePlayer,
  aiMark: TicTacToePlayer,
  depth: number,
): number {
  const winner = findTicTacToeWinner(board);
  if (winner === aiMark) return 10 - depth;
  if (winner !== null) return depth - 10;
  if (board.every(cell => cell !== null)) return 0;

  const maximizing = turn === aiMark;
  let best = maximizing ? -Infinity : Infinity;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== null) continue;
    board[index] = turn;
    const score = scorePosition(board, other(turn), aiMark, depth + 1);
    board[index] = null;
    best = maximizing ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

/** Returns an optimal move for a perfect-play bot, or null if no move is legal. */
export function chooseTicTacToeBotMove(
  boardInput: readonly TicTacToeMark[],
  aiMark: TicTacToePlayer = "O",
): number | null {
  if (boardInput.length !== 9 || findTicTacToeWinner(boardInput) !== null) return null;
  if (boardInput.every(cell => cell !== null)) return null;

  const board = [...boardInput];
  const humanMark = other(aiMark);
  const humanCount = board.filter(cell => cell === humanMark).length;
  const aiCount = board.filter(cell => cell === aiMark).length;
  const turn: TicTacToePlayer = humanCount > aiCount ? aiMark : humanMark;

  // A bot move is only valid when it is the bot's turn.
  if (turn !== aiMark) return null;

  let bestMove: number | null = null;
  let bestScore = -Infinity;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== null) continue;
    board[index] = aiMark;
    const score = scorePosition(board, humanMark, aiMark, 0);
    board[index] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = index;
    }
  }
  return bestMove;
}
