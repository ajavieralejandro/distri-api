import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from '../../shared/errors/app.exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { money, type Money } from '../../shared/money/money';
import { PrismaService } from '../../shared/prisma/prisma.service';

export type CategoryView = { id: string; name: string };

export type ProductView = {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  unit: 'UNIT' | 'PACK' | 'BOX';
  presentation: string;
  price: Money;
  availableStock: number;
  active: boolean;
};

export type ProductPage = {
  items: ProductView[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(): Promise<CategoryView[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async listProducts(query: {
    page: number;
    size: number;
    search?: string;
    categoryId?: string;
  }): Promise<ProductPage> {
    const term = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      active: true,
      categoryId: query.categoryId,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { brand: { contains: term, mode: 'insensitive' } },
              { sku: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.page * query.size,
        take: query.size,
      }),
    ]);
    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.size);
    return {
      items: rows.map(toProduct),
      page: query.page,
      size: query.size,
      totalItems,
      totalPages,
    };
  }

  async getProduct(id: string): Promise<ProductView> {
    const product = await this.prisma.product.findFirst({
      where: { id, active: true },
    });
    if (!product) {
      throw new AppException(
        'Producto no encontrado.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
      );
    }
    return toProduct(product);
  }
}

function toProduct(product: {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  unit: 'UNIT' | 'PACK' | 'BOX';
  presentation: string;
  priceCents: number;
  availableStock: number;
  active: boolean;
}): ProductView {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    brand: product.brand,
    unit: product.unit,
    presentation: product.presentation,
    price: money(product.priceCents),
    availableStock: product.availableStock,
    active: product.active,
  };
}
