
export const BOARD_SIZE = 15;

// Coordinate map for the 52 shared path cells
// This follows the standard Ludo "clockwise" flow
export const SHARED_PATH = [
  // Red side start stretch (Left mid)
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Green side up (Top mid)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8], // Top turn
  // Green side down
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // Yellow side right (Right mid)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14], // Right turn
  // Yellow side left
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // Blue side down (Bottom mid)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6], // Bottom turn
  // Blue side up
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // Red side finish line
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0] // Final cell before home stretch? No, standard 52 cells.
].slice(0, 52); // Ensure exactly 52

// Accurate offsets for standard board
// Red: starts at [6, 1] idx? No, standard start is usually 1 cell after home exit.
export const START_OFFSETS = [1, 14, 27, 40];

// Home stretches (5 cells each)
export const HOME_STRETCHES = {
  0: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], // Red
  1: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], // Green
  2: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], // Yellow
  3: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]  // Blue
};

export const SAFE_ZONE_COORDS = [
  [6, 1], [1, 8], [8, 13], [13, 6],
  [8, 2], [6, 12], [2, 6], [12, 8]
];

export function getPlayerPath(playerIndex: number) {
  if (playerIndex < 0 || playerIndex > 3) return [];
  
  const path = [];
  const startOffset = START_OFFSETS[playerIndex];
  
  // 51 steps in shared path
  for (let i = 0; i < 51; i++) {
    path.push(SHARED_PATH[(startOffset + i) % 52]);
  }
  
  // 5 steps in home stretch
  const homeStretch = HOME_STRETCHES[playerIndex as keyof typeof HOME_STRETCHES];
  if (homeStretch) {
    path.push(...homeStretch);
  }
  
  return path;
}

