import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { HealthResponseDto } from './dto/health-response.dto';

export type ReadyResponse = {
  status: 'ok';
  database: 'ok';
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'distrisoft-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getReady(): Promise<ReadyResponse> {
    try {
      await this.prisma.isHealthy();
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new AppException(
        'La base de datos no responde.',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.SERVICE_UNAVAILABLE,
      );
    }
  }
}
