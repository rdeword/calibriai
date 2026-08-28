const prices: Record<string, { input: number; output: number }> = {
  // Цена за 1 млн токенов. Добавляйте используемые модели здесь.
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const price = prices[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
