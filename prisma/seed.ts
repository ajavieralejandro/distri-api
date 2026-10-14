import { PrismaClient, ProductUnit, Role } from '@prisma/client';

import { hashPassword } from '../src/shared/auth/password';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  assertSafeToSeed();
  const password = process.env.SEED_PASSWORD?.trim() ?? '';
  if (password.length < 8 || password.startsWith('replace-with-')) {
    throw new Error(
      'Definí SEED_PASSWORD con una contraseña de prueba de al menos 8 caracteres.',
    );
  }
  const passwordHash = await hashPassword(password);

  const drinks = await prisma.category.upsert({
    where: { id: 'cat-bebidas' },
    update: { name: 'Bebidas' },
    create: { id: 'cat-bebidas', name: 'Bebidas' },
  });
  const cleaning = await prisma.category.upsert({
    where: { id: 'cat-limpieza' },
    update: { name: 'Limpieza' },
    create: { id: 'cat-limpieza', name: 'Limpieza' },
  });

  const products: {
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
  }[] = [
    {
      id: 'prod-agua',
      sku: 'BEB-001',
      name: 'Agua mineral',
      description: 'Agua sin gas para el recorrido de prueba.',
      categoryId: drinks.id,
      brand: 'Andes',
      unit: ProductUnit.PACK,
      presentation: 'Pack x 6',
      priceCents: 85050,
      availableStock: 80,
    },
    {
      id: 'prod-gaseosa',
      sku: 'BEB-002',
      name: 'Gaseosa cola',
      description: 'Gaseosa de prueba con precio decimal.',
      categoryId: drinks.id,
      brand: 'Norte',
      unit: ProductUnit.UNIT,
      presentation: '2.25 L',
      priceCents: 120050,
      availableStock: 6,
    },
    {
      id: 'prod-detergente',
      sku: 'LIM-001',
      name: 'Detergente limón',
      description: 'Producto de prueba sin stock.',
      categoryId: cleaning.id,
      brand: 'Citrus',
      unit: ProductUnit.UNIT,
      presentation: '750 ml',
      priceCents: 99999,
      availableStock: 0,
    },
    {
      id: 'prod-yerba',
      sku: 'ALM-001',
      name: 'Yerba',
      description: 'Yerba de prueba.',
      categoryId: drinks.id,
      brand: 'Campo',
      unit: ProductUnit.BOX,
      presentation: 'Caja 10 x 500 g',
      priceCents: 450000,
      availableStock: 40,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }

  await upsertCommerce({
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
    user: {
      id: 'usr-norte',
      email: 'norte@pruebas.distrisoft.local',
      displayName: 'Almacén Norte',
      passwordHash,
    },
  });

  await upsertCommerce({
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
    user: {
      id: 'usr-sur',
      email: 'sur@pruebas.distrisoft.local',
      displayName: 'Kiosco Sur',
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@pruebas.distrisoft.local' },
    update: {
      displayName: 'Admin de pruebas',
      passwordHash,
      role: Role.ADMIN,
      commerceId: null,
    },
    create: {
      id: 'usr-admin',
      email: 'admin@pruebas.distrisoft.local',
      displayName: 'Admin de pruebas',
      passwordHash,
      role: Role.ADMIN,
    },
  });
}

async function upsertCommerce(input: {
  id: string;
  businessName: string;
  tradeName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  branch: { id: string; name: string; address: string; phone: string };
  user: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
  };
}): Promise<void> {
  await prisma.commerce.upsert({
    where: { id: input.id },
    update: {
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
    create: {
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
  await prisma.commerceBranch.upsert({
    where: { id: input.branch.id },
    update: {
      name: input.branch.name,
      address: input.branch.address,
      phone: input.branch.phone,
      commerceId: input.id,
    },
    create: {
      id: input.branch.id,
      commerceId: input.id,
      name: input.branch.name,
      address: input.branch.address,
      phone: input.branch.phone,
    },
  });
  await prisma.user.upsert({
    where: { email: input.user.email },
    update: {
      displayName: input.user.displayName,
      passwordHash: input.user.passwordHash,
      role: Role.COMMERCE,
      commerceId: input.id,
    },
    create: {
      id: input.user.id,
      email: input.user.email,
      displayName: input.user.displayName,
      passwordHash: input.user.passwordHash,
      role: Role.COMMERCE,
      commerceId: input.id,
    },
  });
}

function assertSafeToSeed(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'No se cargan datos de prueba cuando NODE_ENV=production.',
    );
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Falta DATABASE_URL.');
  }
  const host = new URL(databaseUrl).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!local && process.env.SEED_CONFIRM !== 'yes') {
    throw new Error(
      'Para sembrar una base que no es local, definí SEED_CONFIRM=yes.',
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
