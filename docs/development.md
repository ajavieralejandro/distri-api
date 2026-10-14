# Guía de desarrollo — Distrisoft API

## Requisitos

- Node.js LTS (recomendado: 22.x)
- npm
- Docker y Docker Compose (para PostgreSQL local)

## Instalar dependencias

```bash
npm install
```

## Variables de entorno

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Ajustá `DATABASE_URL` y credenciales si es necesario.

## Levantar PostgreSQL

```bash
npm run docker:up
```

Equivalente:

```bash
docker compose up -d
```

Verificar salud del contenedor:

```bash
docker compose ps
```

## Generar cliente Prisma

```bash
npm run prisma:generate
```

## Ejecutar migraciones

La primera migración crea usuarios, comercios, catálogo y pedidos:

```bash
npm run prisma:migrate
```

En un entorno ya desplegado:

```bash
npm run prisma:migrate:deploy
```

Los datos de prueba se cargan con `npm run prisma:seed`. Hace falta `SEED_PASSWORD` en el entorno. No corre si `NODE_ENV=production`. Si la base no está en localhost, además hace falta `SEED_CONFIRM=yes`.

La API exige `JWT_SECRET` de al menos 32 caracteres. No lo commitees.

## Iniciar desarrollo

Con PostgreSQL en ejecución:

```bash
npm run start:dev
```

La API queda en `http://localhost:3000`.

- Health: `GET http://localhost:3000/api/health`
- Swagger (no producción): `http://localhost:3000/api/docs`

## Ejecutar tests

Unitarios:

```bash
npm test
```

E2E:

```bash
npm run test:e2e
```

## Ejecutar lint

```bash
npm run lint
```

Formateo:

```bash
npm run format
```

## Compilar producción

```bash
npm run build
npm run start:prod
```

Asegurate de tener variables de entorno válidas y migraciones aplicadas antes de `start:prod`.

## Detener contenedores

```bash
npm run docker:down
```

Equivalente:

```bash
docker compose down
```

Para eliminar también el volumen de datos:

```bash
docker compose down -v
```

## Prisma Studio (opcional)

```bash
npm run prisma:studio
```
