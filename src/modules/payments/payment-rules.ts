export type PaymentSummary = {
  paidCents: number;
  outstandingCents: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
};

export function summarizePayments(
  totalCents: number,
  paidCents: number,
): PaymentSummary {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error('Invalid order total.');
  }

  if (
    !Number.isSafeInteger(paidCents) ||
    paidCents < 0 ||
    paidCents > totalCents
  ) {
    throw new Error('Invalid paid amount.');
  }

  const outstandingCents = totalCents - paidCents;

  const status =
    outstandingCents === 0
      ? 'PAID'
      : paidCents === 0
        ? 'UNPAID'
        : 'PARTIAL';

  return {
    paidCents,
    outstandingCents,
    status,
  };
}

export function canRegisterPayment(
  amountCents: number,
  outstandingCents: number,
): boolean {
  return (
    Number.isSafeInteger(amountCents) &&
    Number.isSafeInteger(outstandingCents) &&
    amountCents > 0 &&
    outstandingCents >= amountCents
  );
}