export type PurchaseFeedbackBeat = Readonly<{
  saleNumber: number;
  serveAtMs: number;
  paymentAtMs: number;
  drinkAtMs: number;
}>;

const MAX_FEEDBACK_PURCHASES = 12;

const boundedInteger = (value: number, minimum: number): number =>
  Math.max(minimum, Number.isFinite(value) ? Math.trunc(value) : minimum);

const sampledSaleIndexes = (sold: number): readonly number[] => {
  if (sold <= MAX_FEEDBACK_PURCHASES) {
    return Object.freeze(Array.from({ length: sold }, (_, index) => index));
  }

  const indexes = new Set<number>();
  for (let index = 0; index < MAX_FEEDBACK_PURCHASES; index += 1) {
    const position = index / (MAX_FEEDBACK_PURCHASES - 1);
    indexes.add(Math.round(position * (sold - 1)));
  }
  return Object.freeze([...indexes].sort((left, right) => left - right));
};

export const createPurchaseFeedbackSchedule = (
  soldValue: number,
  durationValueMs: number,
): readonly PurchaseFeedbackBeat[] => {
  const sold = boundedInteger(soldValue, 0);
  const durationMs = boundedInteger(durationValueMs, 1);
  if (sold === 0) {
    return Object.freeze([]);
  }

  const saleSpacingMs = durationMs / (sold + 1);
  const serveLeadMs = Math.min(90, Math.max(35, saleSpacingMs * 0.22));
  const drinkDelayMs = Math.min(240, Math.max(90, saleSpacingMs * 0.42));

  return Object.freeze(
    sampledSaleIndexes(sold).map((saleIndex) => {
      const paymentAtMs = Math.round(saleSpacingMs * (saleIndex + 1));
      return Object.freeze({
        saleNumber: saleIndex + 1,
        serveAtMs: Math.max(0, Math.round(paymentAtMs - serveLeadMs)),
        paymentAtMs,
        drinkAtMs: Math.min(durationMs, Math.round(paymentAtMs + drinkDelayMs)),
      });
    }),
  );
};
