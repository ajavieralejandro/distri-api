import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import type {
  DeliveryCompletionRepository,
  DeliveryCompletionTx,
  StoredDeliveryCompletion,
} from './delivery-completion.repository';
import { DeliveryCompletionService } from './delivery-completion.service';

const admin: AuthenticatedUser = {
  userId: 'admin-1',
  sessionId: 'session-1',
  role: 'ADMIN',
  commerceId: null,
  displayName: 'Admin',
  email: 'admin@example.test',
};

const KEY = '11111111-1111-4111-8111-111111111111';

describe('DeliveryCompletionService', () => {
  let tx: jest.Mocked<DeliveryCompletionTx>;
  let repository: DeliveryCompletionRepository;
  let service: DeliveryCompletionService;
  let saved: StoredDeliveryCompletion | null;

  beforeEach(() => {
    saved = null;

    tx = {
      findByIdempotency: jest.fn().mockResolvedValue(null),
      findOrder: jest.fn().mockResolvedValue(null),
      tryAdvancePaymentVersion: jest.fn().mockResolvedValue(true),
      sumPaidCents: jest.fn().mockResolvedValue(0),

      insertPayment: jest.fn().mockImplementation(async (input) => ({
        ...input,
        id: 'payment-1',
        createdAt: new Date('2026-10-21T12:00:00Z'),
      })),

      findCompletionByKey: jest.fn().mockImplementation(async () =>
        saved ? { ...saved } : null,
      ),

      findDeliveryOrder: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'CONFIRMED',
        deliveryMode: 'DELIVERY',
        stockDeducted: true,
        totalCents: 3_000_000,
        paymentVersion: 0,
      }),

      tryMarkDelivered: jest.fn().mockResolvedValue(true),

      insertCompletion: jest.fn().mockImplementation(async (input) => {
        saved = {
          ...input,
          id: 'completion-1',
          createdAt: new Date('2026-10-21T12:00:00Z'),
        };

        return saved;
      }),
    };

    repository = {
      transaction: async (work) => work(tx),
    };

    service = new DeliveryCompletionService(repository);
  });

  it('completes delivery without inserting a payment', async () => {
    const result = await service.complete(admin, 'order-1', {}, KEY);

    expect(result.paymentId).toBeNull();
    expect(tx.insertPayment).not.toHaveBeenCalled();
    expect(tx.tryMarkDelivered).toHaveBeenCalledWith(
      'order-1',
      'CONFIRMED',
      admin.userId,
    );
    expect(tx.insertCompletion).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['partial', '20000.00', 2_000_000],
    ['full', '30000.00', 3_000_000],
  ])('registers a %s payment with delivery', async (
    _label,
    amount,
    cents,
  ) => {
    const result = await service.complete(
      admin,
      'order-1',
      { payment: { amount, method: 'CASH' } },
      KEY,
    );

    expect(result.paymentId).toBe('payment-1');
    expect(tx.insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        recordedById: admin.userId,
        amountCents: cents,
        method: 'CASH',
        idempotencyKey: `delivery:${KEY}`,
      }),
    );
  });

  it('accounts for previous payments when checking the outstanding amount', async () => {
    tx.sumPaidCents.mockResolvedValue(500_000);

    await expect(
      service.complete(
        admin,
        'order-1',
        { payment: { amount: '26000.00', method: 'CASH' } },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'PAYMENT_EXCEEDS_OUTSTANDING',
    });

    expect(tx.tryMarkDelivered).not.toHaveBeenCalled();
    expect(tx.insertPayment).not.toHaveBeenCalled();
    expect(tx.insertCompletion).not.toHaveBeenCalled();
  });

  it('returns the original completion for the same key and payload', async () => {
    const input = {
      payment: {
        amount: '20000.00',
        method: 'CASH' as const,
      },
    };

    const first = await service.complete(admin, 'order-1', input, KEY);
    const second = await service.complete(admin, 'order-1', input, KEY);

    expect(second.id).toBe(first.id);
    expect(tx.insertPayment).toHaveBeenCalledTimes(1);
    expect(tx.tryMarkDelivered).toHaveBeenCalledTimes(1);
    expect(tx.insertCompletion).toHaveBeenCalledTimes(1);
  });

  it('rejects the same key with a different payload', async () => {
    await service.complete(admin, 'order-1', {}, KEY);

    await expect(
      service.complete(
        admin,
        'order-1',
        { payment: { amount: '10000.00', method: 'CASH' } },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'IDEMPOTENCY_KEY_REUSED',
    });

    expect(tx.insertCompletion).toHaveBeenCalledTimes(1);
    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it('rejects users who are not administrators', async () => {
    const commerce: AuthenticatedUser = {
      ...admin,
      role: 'COMMERCE',
      commerceId: 'commerce-1',
    };

    await expect(
      service.complete(commerce, 'order-1', {}, KEY),
    ).rejects.toMatchObject({
      errorCode: 'FORBIDDEN',
    });

    expect(tx.findDeliveryOrder).not.toHaveBeenCalled();
  });

  it('rejects a missing order', async () => {
    tx.findDeliveryOrder.mockResolvedValue(null);

    await expect(
      service.complete(admin, 'order-1', {}, KEY),
    ).rejects.toMatchObject({
      errorCode: 'NOT_FOUND',
    });

    expect(tx.tryMarkDelivered).not.toHaveBeenCalled();
  });

  it('rejects an order that has not been confirmed', async () => {
    const order = await tx.findDeliveryOrder('order-1');

    tx.findDeliveryOrder.mockResolvedValue({
      ...order!,
      status: 'PENDING',
    });

    await expect(
      service.complete(admin, 'order-1', {}, KEY),
    ).rejects.toMatchObject({
      errorCode: 'INVALID_ORDER_TRANSITION',
    });

    expect(tx.tryAdvancePaymentVersion).not.toHaveBeenCalled();
    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it('rejects a payment version conflict without completing delivery', async () => {
    tx.tryAdvancePaymentVersion.mockResolvedValue(false);

    await expect(
      service.complete(admin, 'order-1', {}, KEY),
    ).rejects.toMatchObject({
      errorCode: 'PAYMENT_CONFLICT',
    });

    expect(tx.tryMarkDelivered).not.toHaveBeenCalled();
    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it('rejects a zero payment before accessing persistence', async () => {
    await expect(
      service.complete(
        admin,
        'order-1',
        { payment: { amount: '0', method: 'CASH' } },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'INVALID_PAYMENT_AMOUNT',
    });

    expect(tx.findCompletionByKey).not.toHaveBeenCalled();
  });

  it('does not record completion when inserting the payment fails', async () => {
    tx.insertPayment.mockRejectedValue(new Error('Database unavailable'));

    await expect(
      service.complete(
        admin,
        'order-1',
        { payment: { amount: '20000.00', method: 'CASH' } },
        KEY,
      ),
    ).rejects.toThrow('Database unavailable');

    expect(tx.insertCompletion).not.toHaveBeenCalled();
  });
});