import { formatCents, lineTotalCents, money, sumCents } from './money';

describe('money', () => {
  it('formats centavos without binary floating point', () => {
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(10)).toBe('0.10');
    expect(formatCents(85050)).toBe('850.50');
    expect(money(120050)).toEqual({ amount: '1200.50', currency: 'ARS' });
  });

  it('multiplies a decimal unit price by quantity in cents', () => {
    expect(lineTotalCents(10, 3)).toBe(30);
    expect(formatCents(lineTotalCents(120050, 2))).toBe('2401.00');
  });

  it('rejects fractional quantities and unsafe totals', () => {
    expect(() => lineTotalCents(100, 1.5)).toThrow(/Quantity/);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(/total/);
  });
});
