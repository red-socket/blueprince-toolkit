// Runs the Mora Jai search off the main thread.
import { solve, type Board, type Corners } from './engine';

self.onmessage = (e: MessageEvent<{ id: number; board: Board; corners: Corners }>) => {
  const { id, board, corners } = e.data;
  self.postMessage({ id, ...solve(board, corners, 1_000_000) });
};
