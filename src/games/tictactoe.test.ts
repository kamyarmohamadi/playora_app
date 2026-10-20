import { describe, expect, it } from "vitest";
import {
  applyTicTacToeMove,
  chooseTicTacToeBotMove,
  createTicTacToeState,
  findTicTacToeWinner,
} from "./tictactoe";

describe("Tic Tac Toe engine", () => {
  it("starts in a clean human-first state", () => {
    const state = createTicTacToeState();
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.currentPlayer).toBe("X");
    expect(state.status).toBe("playing");
    expect(state.winner).toBeNull();
  });

  it("alternates players and ignores occupied or out-of-range cells", () => {
    const first = applyTicTacToeMove(createTicTacToeState(), 0);
    expect(first.currentPlayer).toBe("O");
    expect(applyTicTacToeMove(first, 0)).toBe(first);
    expect(applyTicTacToeMove(first, 9)).toBe(first);
    expect(applyTicTacToeMove(first, -1)).toBe(first);
  });

  it("detects rows, columns and diagonals", () => {
    expect(findTicTacToeWinner(["X", "X", "X", "O", null, "O", null, null, null])).toBe("X");
    expect(findTicTacToeWinner(["O", "X", null, "O", "X", null, "O", null, "X"])).toBe("O");
    expect(findTicTacToeWinner(["X", "O", null, "O", "X", null, null, null, "X"])).toBe("X");
  });

  it("ends the game and refuses moves after a win", () => {
    let state = createTicTacToeState();
    for (const move of [0, 3, 1, 4, 2]) state = applyTicTacToeMove(state, move);
    expect(state.status).toBe("won");
    expect(state.winner).toBe("X");
    expect(applyTicTacToeMove(state, 5)).toBe(state);
  });

  it("detects a draw", () => {
    let state = createTicTacToeState();
    for (const move of [0, 1, 2, 4, 3, 5, 7, 6, 8]) state = applyTicTacToeMove(state, move);
    expect(state.status).toBe("draw");
    expect(state.winner).toBeNull();
  });

  it("bot chooses a move and never misses an immediate win", () => {
    const board = ["O", "O", null, "X", "X", null, "X", null, null] as const;
    expect(chooseTicTacToeBotMove(board)).toBe(2);
  });

  it("bot blocks an immediate human win", () => {
    const board = ["X", "X", null, "O", null, null, null, null, null] as const;
    expect(chooseTicTacToeBotMove(board)).toBe(2);
  });

  it("does not choose a move on a full or already won board", () => {
    expect(chooseTicTacToeBotMove(["X", "O", "X", "X", "O", "O", "O", "X", "X"])).toBeNull();
    expect(chooseTicTacToeBotMove(["X", "X", "X", "O", "O", null, null, null, null])).toBeNull();
  });
});
