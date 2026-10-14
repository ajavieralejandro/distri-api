# Guía de desarrollo — Distrisoft API

## Requisitos

- Node.js 22 o superior. En esta máquina se verificó con Node 24.19.0. En Ubuntu instalá la 22 LTS o la 24 LTS; el `package.json` declara `"node": ">=22"`.
- npm
- Docker y Docker Compose, solo para el PostgreSQL local. El servidor de pruebas puede usar PostgreSQL instalado en el sistema.

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

Los datos de prueba no se cargan al arrancar ni al migrar. `npm run prisma:seed` crea las cuentas y los productos que falten y no modifica una cuenta ya existente ni su contraseña. Se niega si `NODE_ENV=production`. Si la base no está en localhost, además hace falta `SEED_CONFIRM=yes`. La contraseña entra por `SEED_PASSWORD` y no se imprime.

Si el proceso de pruebas corre con `NODE_ENV=production`, no uses el seed. El comando separado es `npm run test-data:init`, y solo corre con `INIT_TEST_DATA=yes` y `INIT_TEST_DATABASE_NAME` igual al nombre de la base de `DATABASE_URL`. En production además hace falta `INIT_TEST_ALLOW_PRODUCTION=yes`. Tampoco pisa cuentas ni contraseñas existentes.

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
