import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { PrismaService } from '../../shared/prisma/prisma.service';

export type BranchView = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

export type CommerceView = {
  id: string;
  businessName: string;
  tradeName: string;
  taxId: string;
  status: 'ACTIVE' | 'INACTIVE';
  email: string;
  phone: string;
  address: string;
  city: string;
  tags: string[];
  branches: BranchView[];
};

export type CommercePage = {
  items: CommerceView[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

const includeBranches = {
  branches: { orderBy: { name: 'asc' as const } },
} satisfies Prisma.CommerceInclude;

type CommerceRow = Prisma.CommerceGetPayload<{
  include: typeof includeBranches;
}>;

@Injectable()
export class CommercesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page: number;
    size: number;
    search?: string;
  }): Promise<CommercePage> {
    const term = query.search?.trim();
    const where: Prisma.CommerceWhereInput = term
      ? {
          OR: [
            { tradeName: { contains: term, mode: 'insensitive' } },
            { businessName: { contains: term, mode: 'insensitive' } },
            { city: { contains: term, mode: 'insensitive' } },
            { tags: { has: term } },
          ],
        }
      : {};
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.commerce.count({ where }),
      this.prisma.commerce.findMany({
        where,
        include: includeBranches,
        orderBy: { tradeName: 'asc' },
        skip: query.page * query.size,
        take: query.size,
      }),
    ]);
    return {
      items: rows.map(toView),
      page: query.page,
      size: query.size,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.size),
    };
  }

  async getById(user: AuthenticatedUser, id: string): Promise<CommerceView> {
    if (user.role === 'COMMERCE' && user.commerceId !== id) {
      throw new AppException(
        'Comercio no encontrado.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
      );
    }
    const commerce = await this.prisma.commerce.findUnique({
      where: { id },
      include: includeBranches,
    });
    if (!commerce) {
      throw new AppException(
        'Comercio no encontrado.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
      );
    }
    return toView(commerce);
  }
}

function toView(commerce: CommerceRow): CommerceView {
  return {
    id: commerce.id,
    businessName: commerce.businessName,
    tradeName: commerce.tradeName,
    taxId: commerce.taxId,
    status: commerce.active ? 'ACTIVE' : 'INACTIVE',
    email: commerce.email,
    phone: commerce.phone,
    address: commerce.address,
    city: commerce.city,
    tags: commerce.tags,
    branches: commerce.branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
    })),
  };
}
