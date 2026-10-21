import { HealthService } from './health.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('HealthService', () => {
  const isHealthy = jest.fn<Promise<boolean>, []>();
  const prisma = { isHealthy } as unknown as PrismaService;
  let service: HealthService;

  beforeEach(() => {
    isHealthy.mockReset();
    service = new HealthService(prisma);
  });

  it('returns ok status with service name and dynamic timestamp', () => {
    const before = new Date().toISOString();
    const result = service.getHealth();
    const after = new Date().toISOString();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('distrisoft-api');
    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });

  it('reports readiness when the database answers', async () => {
    isHealthy.mockResolvedValue(true);
    await expect(service.getReady()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('returns 503 when the database does not answer', async () => {
    isHealthy.mockRejectedValue(new Error('down'));
    await expect(service.getReady()).rejects.toMatchObject({
      errorCode: 'SERVICE_UNAVAILABLE',
    });
  });
});
