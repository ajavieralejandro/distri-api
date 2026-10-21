export const CURRENCY = 'ARS' as const;

export type Money = {
  amount: string;
  currency: typeof CURRENCY;
};

const MAX_QUANTITY = 9999;

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error('Money amount must be an integer number of cents.');
  }

  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function money(cents: number): Money {
  return { amount: formatCents(cents), currency: CURRENCY };
}

export function lineTotalCents(unitCents: number, quantity: number): number {
  if (!Number.isInteger(unitCents) || unitCents < 0) {
    throw new Error(
      'Unit price must be a non-negative integer number of cents.',
    );
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error('Quantity must be an integer between 1 and 9999.');
  }

  const total = unitCents * quantity;
  if (!Number.isSafeInteger(total)) {
    throw new Error('Line total is outside the supported range.');
  }
  return total;
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => {
    if (!Number.isSafeInteger(total + value)) {
      throw new Error('Order total is outside the supported range.');
    }
    return total + value;
  }, 0);
}

/**
 * Convierte un importe decimal positivo a centavos.
 * Acepta "20", "20.5" o "20.50".
 * Rechaza comas, signos, espacios y más de dos decimales.
 */
export function parsePaymentCents(amount: string): number {
  if (
    typeof amount !== 'string' ||
    !/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(amount)
  ) {
    throw new Error('Invalid payment amount.');
  }

  const [whole, fraction = ''] = amount.split('.');

  const cents =
    Number(whole) * 100 +
    Number(fraction.padEnd(2, '0'));

  // Payment.amountCents se guarda como PostgreSQL Int.
  if (cents <= 0 || cents > 2_147_483_647) {
    throw new Error('Payment amount is outside the supported range.');
  }

  return cents;
}
