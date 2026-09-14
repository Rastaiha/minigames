export const COLORS = [
  [0.66, 0.8, 0.95],
  [0.88, 0.78, 0.62],
  [0.6, 0.71, 0.93],
  [0.64, 0.87, 0.84],
  [0.88, 0.87, 0.97],
];

function seededRandom(n) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createBackground(count = 700) {
  return Array.from({ length: count }, (_, i) => {
    const angle = seededRandom(i + 1) * Math.PI * 2;
    const z = seededRandom(i + 800) * 2 - 1;
    const radius = Math.sqrt(1 - z * z);
    return {
      p: [
        Math.cos(angle) * radius * 1800,
        z * 1800,
        Math.sin(angle) * radius * 1800,
      ],
      brightness: seededRandom(i + 1500),
    };
  });
}
