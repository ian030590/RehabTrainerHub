export function CalculateScoreStatistics(values: (number | null)[]) {
  const numbers = values.filter((value): value is number => value !== null);
  const ordered = [...numbers].sort((left, right) => left - right);
  const observations = numbers.length;
  const mean = observations ? numbers.reduce((sum, value) => sum + value, 0) / observations : null;
  const median = observations ? (ordered[Math.floor((observations - 1) / 2)] + ordered[Math.floor(observations / 2)]) / 2 : null;
  const sampleSd = observations > 1 && mean !== null
    ? Math.sqrt(numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (observations - 1)) : null;
  return { observations, mean, median, sampleSd, minimum: ordered[0] ?? null, maximum: ordered.at(-1) ?? null };
}

