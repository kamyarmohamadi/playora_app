import { describe, expect, it } from "vitest";
import {
  applyCheckersMove,
  chooseCheckersBotMove,
  createCheckersState,
  getCheckersLegalMoves,
} from "./checkers";

const blankState = (overrides: Partial<ReturnType<typeof createCheckersState>> = {}) => ({
  board: Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"],
  currentPlayer: "red" as const,
  status: "playing" as const,
  winner: null,
  forcedFrom: null,
  quietPlies: 0,
  ...overrides,
});

describe("Checkers engine", () => {
  it("creates the standard 12-piece starting layout and red moves first", () => {
    const state = createCheckersState();
    expect(state.board.filter(piece => piece?.player === "red")).toHaveLength(12);
    expect(state.board.filter(piece => piece?.player === "black")).toHaveLength(12);
    expect(state.currentPlayer).toBe("red");
    expect(state.status).toBe("playing");
    expect(getCheckersLegalMoves(state)).toHaveLength(7);
  });

  it("moves diagonally, alternates turns, and rejects illegal actions", () => {
    const state = createCheckersState();
    const next = applyCheckersMove(state, 40, 33);
    expect(next.board[40]).toBeNull();
    expect(next.board[33]).toEqual({ player: "red", king: false });
    expect(next.currentPlayer).toBe("black");
    expect(applyCheckersMove(next, 33, 24)).toBe(next);
    expect(applyCheckersMove(state, 40, 24)).toBe(state);
    expect(applyCheckersMove(state, -1, 9)).toBe(state);
  });

  it("forces captures and suppresses ordinary moves while a capture exists", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[40] = { player: "red", king: false };
    board[44] = { player: "red", king: false };
    board[33] = { player: "black", king: false };
    const state = blankState({ board });
    const moves = getCheckersLegalMoves(state);
    expect(moves).toContainEqual({ from: 40, to: 26, captured: 33 });
    expect(moves.every(move => move.captured !== null)).toBe(true);
    expect(moves.some(move => move.from === 44)).toBe(false);
  });

  it("supports multi-jump captures and keeps the player's turn until the sequence ends", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[40] = { player: "red", king: false };
    board[33] = { player: "black", king: false };
    board[19] = { player: "black", king: false };
    let state = blankState({ board });
    state = applyCheckersMove(state, 40, 26);
    expect(state.currentPlayer).toBe("red");
    expect(state.forcedFrom).toBe(26);
    expect(state.board[33]).toBeNull();
    state = applyCheckersMove(state, 26, 12);
    expect(state.status).toBe("won");
    expect(state.winner).toBe("red");
    expect(state.board[19]).toBeNull();
  });

  it("crowns a man on the far row and ends the turn on promotion", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[10] = { player: "red", king: false };
    board[17] = { player: "black", king: false };
    const state = blankState({ board });
    const next = applyCheckersMove(state, 10, 1);
    expect(next.board[1]).toEqual({ player: "red", king: true });
    expect(next.currentPlayer).toBe("black");
    expect(next.forcedFrom).toBeNull();
  });

  it("allows kings to move and capture backward", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[26] = { player: "red", king: true };
    board[17] = { player: "black", king: false };
    const state = blankState({ board });
    expect(getCheckersLegalMoves(state)).toContainEqual({ from: 26, to: 8, captured: 17 });
  });

  it("returns a bot capture when one is available", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[17] = { player: "black", king: false };
    board[26] = { player: "red", king: false };
    const state = blankState({ board, currentPlayer: "black" });
    expect(chooseCheckersBotMove(state)).toEqual({ from: 17, to: 35, captured: 26 });
  });

  it("does not reset the no-capture draw counter when a man is crowned", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[10] = { player: "red", king: false };
    board[17] = { player: "black", king: false };
    const state = blankState({ board, quietPlies: 79 });
    const next = applyCheckersMove(state, 10, 1);
    expect(next.board[1]).toEqual({ player: "red", king: true });
    expect(next.status).toBe("draw");
  });

  it("wins when the next player has pieces but no legal moves", () => {
    const board = Array(64).fill(null) as ReturnType<typeof createCheckersState>["board"];
    board[8] = { player: "red", king: false };
    board[26] = { player: "red", king: false };
    board[33] = { player: "red", king: false };
    board[35] = { player: "red", king: false };
    board[17] = { player: "black", king: false };
    const state = blankState({ board });
    const next = applyCheckersMove(state, 33, 24);
    expect(next.status).toBe("won");
    expect(next.winner).toBe("red");
    expect(next.board.filter(piece => piece?.player === "black")).toHaveLength(1);
  });

  it("draws after the documented 80 consecutive non-capture plies", () => {
    const state = createCheckersState();
    const atLimit = { ...state, quietPlies: 79 };
    const next = applyCheckersMove(atLimit, 40, 33);
    expect(next.status).toBe("draw");
    expect(next.winner).toBeNull();
  });
});
