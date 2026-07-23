import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
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
});
