const mockDurationMs = 120_000;
const busyProgressMin = 8;
const busyProgressMax = 96;
const completeLogIndex = 14;

export function getModelBuildMockState(elapsedMs: number, busy: boolean) {
  if (!busy) {
    return {
      progress: 100,
      logIndex: completeLogIndex,
      tokenOffset: completeLogIndex
    };
  }

  const normalized = Math.min(1, Math.max(0, elapsedMs / mockDurationMs));
  const eased = normalized ** 1.75;
  const progress = Math.min(busyProgressMax, Math.round(busyProgressMin + (busyProgressMax - busyProgressMin) * eased));

  return {
    progress,
    logIndex: Math.min(completeLogIndex, Math.floor(normalized * completeLogIndex)),
    tokenOffset: Math.floor(elapsedMs / 1800)
  };
}
