// Where the original stage drew the ball: lower on phones so it clears the HUD, and never so low that its label leaves the screen.
export function BallPlacement(width: number, height: number, xRatio: number, yRatio: number) {
  const radius = Math.min(width, height) * 0.13;
  const minimumY = width <= 620 && height > width ? height * 0.42 : height <= 560 && width > height ? height * 0.38 : radius;
  return { x: width * xRatio, y: Math.min(Math.max(height * yRatio, minimumY), height - radius * 1.5), radius };
}
