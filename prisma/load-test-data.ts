import { Prisma, PrismaClient, ProductUnit, Role } from '@prisma/client';

import { hashPassword } from '../src/shared/auth/password';
import {
  databaseTarget,
  readSeedPassword,
  type GuardEnv,
} from '../src/shared/test-data/init-guard';

export type TestDataAction = 'created' | 'unchanged';

export type TestDataReport = {
  host: string;
  database: string;
  rows: { kind: string; key: string; action: TestDataAction }[];
};

const USERS = [
  {
    id: 'usr-admin',
    email: 'admin@pruebas.distrisoft.local',
    displayName: 'Admin de pruebas',
    role: Role.ADMIN,
    commerceId: null as string | null,
  },
  {
    id: 'usr-norte',
    email: 'norte@pruebas.distrisoft.local',
    displayName: 'Almacén Norte',
    role: Role.COMMERCE,
    commerceId: 'com-norte',
  },
  {
    id: 'usr-sur',
    email: 'sur@pruebas.distrisoft.local',
    displayName: 'Kiosco Sur',
    role: Role.COMMERCE,
    commerceId: 'com-sur',
  },
];

export async function loadTestData(
  prisma: PrismaClient,
  env: GuardEnv,
): Promise<TestDataReport> {
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL.');
  }
  const target = databaseTarget(env.DATABASE_URL);
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: USERS.map((user) => user.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existingUsers.map((user) => user.email));
  const passwordHash =
    existingEmails.size === USERS.length
      ? null
      : await hashPassword(readSeedPassword(env));

  const rows: TestDataReport['rows'] = [];
  await prisma.$transaction(async (tx) => {
    const drinks = await ensureCategory(tx, rows, 'cat-bebidas', 'Bebidas');
    const cleaning = await ensureCategory(tx, rows, 'cat-limpieza', 'Limpieza');
    await ensureProduct(tx, rows, {
      id: 'prod-agua',
      sku: 'BEB-001',
      name: 'Agua mineral',
      description: 'Agua sin gas para el recorrido de prueba.',
      categoryId: drinks,
      brand: 'Andes',
      unit: ProductUnit.PACK,
      presentation: 'Pack x 6',
      priceCents: 85050,
      availableStock: 80,
    });
    await ensureProduct(tx, rows, {
      id: 'prod-gaseosa',
      sku: 'BEB-002',
      name: 'Gaseosa cola',
      description: 'Gaseosa de prueba con precio decimal.',
      categoryId: drinks,
      brand: 'Norte',
      unit: ProductUnit.UNIT,
      presentation: '2.25 L',
      priceCents: 120050,
      availableStock: 6,
    });
    await ensureProduct(tx, rows, {
      id: 'prod-detergente',
      sku: 'LIM-001',
      name: 'Detergente limón',
      description: 'Producto de prueba sin stock.',
      categoryId: cleaning,
      brand: 'Citrus',
      unit: ProductUnit.UNIT,
      presentation: '750 ml',
      priceCents: 99999,
      availableStock: 0,
    });
    await ensureProduct(tx, rows, {
      id: 'prod-yerba',
      sku: 'ALM-001',
      name: 'Yerba',
      description: 'Yerba de prueba.',
      categoryId: drinks,
      brand: 'Campo',
      unit: ProductUnit.BOX,
      presentation: 'Caja 10 x 500 g',
      priceCents: 450000,
      availableStock: 40,
    });

    await ensureCommerce(tx, rows, {
      id: 'com-norte',
      businessName: 'Almacén Norte SRL',
      tradeName: 'Almacén Norte',
      taxId: '30-70000001-1',
      email: 'norte@pruebas.distrisoft.local',
      phone: '1144440001',
      address: 'Av. Prueba 100',
      city: 'CABA',
      branch: {
        id: 'br-norte',
        name: 'Sucursal Centro',
        address: 'Av. Prueba 100, CABA',
        phone: '1144440001',
      },
    });
    await ensureCommerce(tx, rows, {
      id: 'com-sur',
      businessName: 'Kiosco Sur SAS',
      tradeName: 'Kiosco Sur',
      taxId: '30-70000002-9',
      email: 'sur@pruebas.distrisoft.local',
      phone: '1144440002',
      address: 'Calle Prueba 200',
      city: 'Avellaneda',
      branch: {
        id: 'br-sur',
        name: 'Local',
        address: 'Calle Prueba 200, Avellaneda',
        phone: '1144440002',
      },
    });

    for (const user of USERS) {
      const found = await tx.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      if (found) {
        rows.push({ kind: 'user', key: user.email, action: 'unchanged' });
        continue;
      }
      if (!passwordHash) {
        throw new Error('Falta la contraseña para crear una cuenta nueva.');
      }
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          passwordHash,
          role: user.role,
          commerceId: user.commerceId,
        },
      });
      rows.push({ kind: 'user', key: user.email, action: 'created' });
    }
  });

  return { ...target, rows };
}

export function formatTestDataReport(report: TestDataReport): string {
  const lines = [
    `Datos de prueba en ${report.database} @ ${report.host}`,
    ...report.rows.map((row) => `${row.kind} ${row.key}: ${row.action}`),
  ];
  return lines.join('\n');
}

type Tx = Prisma.TransactionClient;

async function ensureCategory(
  tx: Tx,
  rows: TestDataReport['rows'],
  id: string,
  name: string,
): Promise<string> {
  const found = await tx.category.findUnique({
    where: { id },
    select: { id: true },
  });
  if (found) {
    rows.push({ kind: 'category', key: id, action: 'unchanged' });
    return found.id;
  }
  await tx.category.create({ data: { id, name } });
  rows.push({ kind: 'category', key: id, action: 'created' });
  return id;
}

async function ensureProduct(
  tx: Tx,
  rows: TestDataReport['rows'],
  product: {
    id: string;
    sku: string;
    name: string;
    description: string;
    categoryId: string;
    brand: string;
    unit: ProductUnit;
    presentation: string;
    priceCents: number;
    availableStock: number;
  },
): Promise<void> {
  const found = await tx.product.findUnique({
    where: { id: product.id },
    select: { id: true },
  });
  if (found) {
    rows.push({ kind: 'product', key: product.id, action: 'unchanged' });
    return;
  }
  await tx.product.create({ data: product });
  rows.push({ kind: 'product', key: product.id, action: 'created' });
}

async function ensureCommerce(
  tx: Tx,
  rows: TestDataReport['rows'],
  input: {
    id: string;
    businessName: string;
    tradeName: string;
    taxId: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    branch: { id: string; name: string; address: string; phone: string };
  },
): Promise<void> {
  const found = await tx.commerce.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!found) {
    await tx.commerce.create({
      data: {
        id: input.id,
        businessName: input.businessName,
        tradeName: input.tradeName,
        taxId: input.taxId,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        active: true,
        tags: ['prueba'],
      },
    });
    rows.push({ kind: 'commerce', key: input.id, action: 'created' });
  } else {
    rows.push({ kind: 'commerce', key: input.id, action: 'unchanged' });
  }

  const branch = await tx.commerceBranch.findUnique({
    where: { id: input.branch.id },
    select: { id: true },
  });
  if (branch) {
    rows.push({ kind: 'branch', key: input.branch.id, action: 'unchanged' });
    return;
  }
  await tx.commerceBranch.create({
    data: {
      id: input.branch.id,
      commerceId: input.id,
      name: input.branch.name,
      address: input.branch.address,
      phone: input.branch.phone,
    },
  });
  rows.push({ kind: 'branch', key: input.branch.id, action: 'created' });
}
