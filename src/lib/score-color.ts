export function scoreColor(score: number) {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const hue = Math.round(t * 120);
  return `hsl(${hue} 72% 36%)`;
}
