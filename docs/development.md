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

Cuando existan migraciones de dominio:

```bash
npm run prisma:migrate
```

En entornos desplegados:

```bash
npm run prisma:migrate:deploy
```

> En la etapa actual el schema no define modelos comerciales. `prisma generate` es suficiente para verificar el cliente; las migraciones de negocio se agregarán con los módulos correspondientes.

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
