import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import type {
  PaymentsRepository,
  PaymentTx,
  StoredPayment,
} from './payments.repository';
import { PaymentsService } from './paymets.service';

const admin: AuthenticatedUser = {
  userId: 'admin-1',
  sessionId: 'session-1',
  role: 'ADMIN',
  commerceId: null,
  displayName: 'Admin',
  email: 'admin@example.test',
};

const KEY = '11111111-1111-4111-8111-111111111111';
const SECOND_KEY = '22222222-2222-4222-8222-222222222222';

describe('PaymentsService', () => {
  let tx: jest.Mocked<PaymentTx>;
  let service: PaymentsService;
  let savedPayments: StoredPayment[];

  beforeEach(() => {
    savedPayments = [];

    tx = {
      findByIdempotency: jest.fn().mockImplementation(
        async (userId, key) =>
          savedPayments.find(
            (payment) =>
              payment.recordedById === userId &&
              payment.idempotencyKey === key,
          ) ?? null,
      ),

      findOrder: jest.fn().mockResolvedValue({
        id: 'order-1',
        totalCents: 3_000_000,
        paymentVersion: 0,
        status: 'DELIVERED',
      }),

      tryAdvancePaymentVersion: jest.fn().mockResolvedValue(true),

      sumPaidCents: jest.fn().mockImplementation(async () =>
        savedPayments.reduce(
          (total, payment) => total + payment.amountCents,
          0,
        ),
      ),

      insertPayment: jest.fn().mockImplementation(async (input) => {
        const payment: StoredPayment = {
          ...input,
          id: `payment-${savedPayments.length + 1}`,
          createdAt: new Date('2026-10-21T12:00:00Z'),
        };

        savedPayments.push(payment);
        return payment;
      }),
    };

    const repository: PaymentsRepository = {
      transaction: async (work) => work(tx),
    };

    service = new PaymentsService(repository);
  });

  it('registers a partial payment and then the remaining amount', async () => {
    await service.register(
      admin,
      'order-1',
      { amount: '20000.00', method: 'CASH' },
      KEY,
    );

    await service.register(
      admin,
      'order-1',
      { amount: '10000.00', method: 'CASH' },
      SECOND_KEY,
    );

    expect(savedPayments).toHaveLength(2);
    expect(
      savedPayments.reduce(
        (total, payment) => total + payment.amountCents,
        0,
      ),
    ).toBe(3_000_000);
  });

  it('rejects a payment greater than the remaining amount', async () => {
    await service.register(
      admin,
      'order-1',
      { amount: '20000.00', method: 'CASH' },
      KEY,
    );

    await expect(
      service.register(
        admin,
        'order-1',
        { amount: '10000.01', method: 'CASH' },
        SECOND_KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'PAYMENT_EXCEEDS_OUTSTANDING',
    });

    expect(savedPayments).toHaveLength(1);
  });

  it('returns the same payment when the operation is retried', async () => {
    const input = { amount: '20000.00', method: 'CASH' as const };

    const first = await service.register(admin, 'order-1', input, KEY);
    const second = await service.register(admin, 'order-1', input, KEY);

    expect(second.id).toBe(first.id);
    expect(tx.insertPayment).toHaveBeenCalledTimes(1);
  });

  it('normalizes equivalent decimal amounts for idempotency', async () => {
    const first = await service.register(
      admin,
      'order-1',
      { amount: '20', method: 'CASH' },
      KEY,
    );

    const second = await service.register(
      admin,
      'order-1',
      { amount: '20.00', method: 'CASH' },
      KEY,
    );

    expect(second.id).toBe(first.id);
    expect(tx.insertPayment).toHaveBeenCalledTimes(1);
  });

  it('rejects the same key with different data', async () => {
    await service.register(
      admin,
      'order-1',
      { amount: '20000.00', method: 'CASH' },
      KEY,
    );

    await expect(
      service.register(
        admin,
        'order-1',
        { amount: '10000.00', method: 'CASH' },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'IDEMPOTENCY_KEY_REUSED',
    });

    expect(savedPayments).toHaveLength(1);
  });

  it('rejects a non-administrator', async () => {
    await expect(
      service.register(
        { ...admin, role: 'COMMERCE', commerceId: 'commerce-1' },
        'order-1',
        { amount: '100.00', method: 'CASH' },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'FORBIDDEN',
    });

    expect(tx.findOrder).not.toHaveBeenCalled();
    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it('rejects a missing order', async () => {
    tx.findOrder.mockResolvedValue(null);

    await expect(
      service.register(
        admin,
        'order-1',
        { amount: '100.00', method: 'CASH' },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'NOT_FOUND',
    });

    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it('rejects payment on an order that has not been delivered', async () => {
    tx.findOrder.mockResolvedValue({
      id: 'order-1',
      totalCents: 3_000_000,
      paymentVersion: 0,
      status: 'CONFIRMED',
    });

    await expect(
      service.register(
        admin,
        'order-1',
        { amount: '100.00', method: 'CASH' },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'ORDER_NOT_PAYABLE',
    });

    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it('rejects a version conflict without inserting a payment', async () => {
    tx.tryAdvancePaymentVersion.mockResolvedValue(false);

    await expect(
      service.register(
        admin,
        'order-1',
        { amount: '100.00', method: 'CASH' },
        KEY,
      ),
    ).rejects.toMatchObject({
      errorCode: 'PAYMENT_CONFLICT',
    });

    expect(tx.insertPayment).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '10,50', '10.555'])(
    'rejects invalid amount %s',
    async (amount) => {
      await expect(
        service.register(
          admin,
          'order-1',
          { amount, method: 'CASH' },
          KEY,
        ),
      ).rejects.toMatchObject({
        errorCode: 'INVALID_PAYMENT_AMOUNT',
      });

      expect(tx.insertPayment).not.toHaveBeenCalled();
    },
  );
});