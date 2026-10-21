import {
  hashOrderRequest,
  ORDER_TRANSITIONS,
  resolveIdempotency,
} from './order-rules';

describe('order rules', () => {
  it('only allows the documented status transitions', () => {
    expect(ORDER_TRANSITIONS.PENDING).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(ORDER_TRANSITIONS.CONFIRMED).toEqual(['PREPARING', 'CANCELLED']);
    expect(ORDER_TRANSITIONS.PREPARING).toEqual(['DELIVERED', 'CANCELLED']);
    expect(ORDER_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('treats the same payload as a replay and a different payload as a conflict', () => {
    const input = {
      paymentMethod: 'CASH' as const,
      notes: '  mañana ',
      delivery: { mode: 'PICKUP' as const },
      items: [
        { productId: 'b', quantity: 1 },
        { productId: 'a', quantity: 2 },
      ],
    };
    const hash = hashOrderRequest(input);
    expect(hash).toBe(
      hashOrderRequest({
        ...input,
        items: [
          { productId: 'a', quantity: 2 },
          { productId: 'b', quantity: 1 },
        ],
      }),
    );
    expect(resolveIdempotency(null, hash)).toBe('create');
    expect(resolveIdempotency({ requestHash: hash }, hash)).toBe('replay');
    expect(() => resolveIdempotency({ requestHash: 'other' }, hash)).toThrow(
      /clave de envío/,
    );
  });
});
