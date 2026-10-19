export type CheckersPlayer = "red" | "black";
export type CheckersPiece = { player: CheckersPlayer; king: boolean } | null;
export type CheckersStatus = "playing" | "won" | "draw";

export type CheckersMove = {
  from: number;
  to: number;
  captured: number | null;
};

export type CheckersState = {
  board: CheckersPiece[];
  currentPlayer: CheckersPlayer;
  status: CheckersStatus;
  winner: CheckersPlayer | null;
  forcedFrom: number | null;
  quietPlies: number;
};

const BOARD_SIZE = 8;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const DRAW_QUIET_PLY_LIMIT = 80;
const DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function isValidSquare(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < BOARD_CELLS;
}

function rowOf(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

function colOf(index: number): number {
  return index % BOARD_SIZE;
}

function indexAt(row: number, col: number): number | null {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return row * BOARD_SIZE + col;
}

function forwardFor(player: CheckersPlayer): number {
  return player === "red" ? -1 : 1;
}

function directionsFor(piece: Exclude<CheckersPiece, null>): ReadonlyArray<readonly [number, number]> {
  if (piece.king) return DIAGONALS;
  const forward = forwardFor(piece.player);
  return DIAGONALS.filter(([dr]) => dr === forward);
}

function countPieces(board: readonly CheckersPiece[], player: CheckersPlayer): number {
  return board.reduce((count, piece) => count + (piece?.player === player ? 1 : 0), 0);
}

function capturesForPiece(board: readonly CheckersPiece[], from: number): CheckersMove[] {
  if (!isValidSquare(from)) return [];
  const piece = board[from];
  if (!piece) return [];

  const row = rowOf(from);
  const col = colOf(from);
  const moves: CheckersMove[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const middle = indexAt(row + dr, col + dc);
    const landing = indexAt(row + dr * 2, col + dc * 2);
    if (middle === null || landing === null) continue;
    const obstacle = board[middle];
    if (obstacle && obstacle.player !== piece.player && board[landing] === null) {
      moves.push({ from, to: landing, captured: middle });
    }
  }
  return moves;
}

export function createCheckersState(): CheckersState {
  const board = Array<CheckersPiece>(BOARD_CELLS).fill(null);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if ((row + col) % 2 === 1) board[row * BOARD_SIZE + col] = { player: "black", king: false };
    }
  }
  for (let row = 5; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if ((row + col) % 2 === 1) board[row * BOARD_SIZE + col] = { player: "red", king: false };
    }
  }
  return {
    board,
    currentPlayer: "red",
    status: "playing",
    winner: null,
    forcedFrom: null,
    quietPlies: 0,
  };
}

export function getCheckersLegalMoves(state: CheckersState): CheckersMove[] {
  if (state.status !== "playing" || state.board.length !== BOARD_CELLS) return [];

  if (state.forcedFrom !== null) {
    const forcedPiece = state.board[state.forcedFrom];
    if (!forcedPiece || forcedPiece.player !== state.currentPlayer) return [];
    return capturesForPiece(state.board, state.forcedFrom);
  }

  const captures: CheckersMove[] = [];
  for (let from = 0; from < state.board.length; from += 1) {
    const piece = state.board[from];
    if (piece?.player === state.currentPlayer) captures.push(...capturesForPiece(state.board, from));
  }
  if (captures.length > 0) return captures;

  const moves: CheckersMove[] = [];
  for (let from = 0; from < state.board.length; from += 1) {
    const piece = state.board[from];
    if (!piece || piece.player !== state.currentPlayer) continue;
    const row = rowOf(from);
    const col = colOf(from);
    for (const [dr, dc] of directionsFor(piece)) {
      const to = indexAt(row + dr, col + dc);
      if (to !== null && state.board[to] === null) {
        moves.push({ from, to, captured: null });
      }
    }
  }
  return moves;
}

export function applyCheckersMove(state: CheckersState, from: number, to: number): CheckersState {
  if (!isValidSquare(from) || !isValidSquare(to) || state.status !== "playing") return state;
  const legalMove = getCheckersLegalMoves(state).find(move => move.from === from && move.to === to);
  if (!legalMove) return state;

  const board = [...state.board];
  const piece = board[from];
  if (!piece) return state;
  board[from] = null;
  if (legalMove.captured !== null) board[legalMove.captured] = null;

  const becomesKing = !piece.king &&
    ((piece.player === "red" && rowOf(to) === 0) ||
     (piece.player === "black" && rowOf(to) === BOARD_SIZE - 1));
  const movedPiece = { player: piece.player, king: piece.king || becomesKing } as const;
  board[to] = movedPiece;

  const quietPlies = legalMove.captured !== null || becomesKing ? 0 : state.quietPlies + 1;

  // American checkers ends the turn when a man is crowned, even if the new king
  // would be able to continue capturing from the promotion square.
  if (legalMove.captured !== null && !becomesKing && capturesForPiece(board, to).length > 0) {
    return {
      board,
      currentPlayer: state.currentPlayer,
      status: "playing",
      winner: null,
      forcedFrom: to,
      quietPlies,
    };
  }

  const nextPlayer: CheckersPlayer = state.currentPlayer === "red" ? "black" : "red";
  if (countPieces(board, nextPlayer) === 0) {
    return {
      board, currentPlayer: nextPlayer, status: "won", winner: state.currentPlayer,
      forcedFrom: null, quietPlies,
    };
  }

  const nextState: CheckersState = {
    board,
    currentPlayer: nextPlayer,
    status: "playing",
    winner: null,
    forcedFrom: null,
    quietPlies,
  };
  if (getCheckersLegalMoves(nextState).length === 0) {
    return { ...nextState, status: "won", winner: state.currentPlayer };
  }
  if (quietPlies >= DRAW_QUIET_PLY_LIMIT) {
    return { ...nextState, status: "draw", winner: null };
  }
  return nextState;
}

export function chooseCheckersBotMove(state: CheckersState): CheckersMove | null {
  if (state.status !== "playing" || state.currentPlayer !== "black") return null;
  const legalMoves = getCheckersLegalMoves(state);
  if (legalMoves.length === 0) return null;

  // Deterministic, capture-first bot. It favors captures, crowns, and moves that
  // do not immediately offer a simple capture to the opponent.
  const ranked = legalMoves.map(move => {
    const piece = state.board[move.from];
    if (!piece) return { move, score: -Infinity };
    const becomesKing = !piece.king &&
      ((piece.player === "red" && rowOf(move.to) === 0) ||
       (piece.player === "black" && rowOf(move.to) === BOARD_SIZE - 1));
    const next = applyCheckersMove(state, move.from, move.to);
    const keepsTurn = next.status === "playing" && next.currentPlayer === "black";
    const opponentCaptures = !keepsTurn && next.status === "playing"
      ? getCheckersLegalMoves(next).filter(candidate => candidate.captured !== null).length
      : 0;
    const advance = rowOf(move.to) - rowOf(move.from);
    const score = (move.captured === null ? 0 : 100) +
      (becomesKing ? 35 : 0) +
      (piece.king ? 3 : 0) +
      (keepsTurn ? 15 : 0) -
      opponentCaptures * 12 +
      advance;
    return { move, score };
  });

  ranked.sort((a, b) => b.score - a.score || a.move.from - b.move.from || a.move.to - b.move.to);
  return ranked[0]?.move ?? null;
}
