# ADR 003 — Modelo de roles: dos perfiles (ADMIN / COMMERCE)

- **Estado:** Aceptado
- **Fecha:** 2026-09-07
- **Decisores:** Equipo Distrisoft

## Contexto

La auditoría de reentrada (2026-09-07) encontró que el frontend demo había explorado 8 roles operativos (`DISTRIBUTOR_ADMIN`, `SALES`, `WAREHOUSE_PICKER`, `CASHIER`, `DRIVER`, `COMMERCE_OWNER`, `COMMERCE_BUYER`, `COMMERCE_CASHIER`), mientras que el backend no tenía todavía ningún modelo de usuario o rol.

Decisión de producto: simplificar el alcance funcional actual a exactamente dos perfiles.

## Decisión

El backend modela roles como:

```prisma
enum Role {
  ADMIN
  COMMERCE
}
```

`ADMIN` representa al administrador/dueño de la distribuidora. `COMMERCE` representa a un comercio cliente. No se introduce en esta etapa un sistema de permisos granular (`permissions`, `permission_groups`, `role_permissions`, ACL dinámica) — alcanza con el rol único por usuario.

`User.commerceId` es un campo escalar simple (`String?`, sin relación FK) hasta que exista un modelo `Commerce` real (ver roadmap, etapa "D1 — Core comercial real").

Se agregan `Roles` (decorator) y `RolesGuard` en `src/shared/auth/` como scaffolding mínimo (`@Roles('ADMIN')`), **sin aplicarlos globalmente todavía**: no existe una estrategia de auth real (login, JWT/sesión) que popule `request.user`. Quedan listos para conectarse cuando esa estrategia se implemente.

## Alternativas consideradas

| Alternativa | Motivo de descarte (etapa actual) |
|---|---|
| Mantener los 8 roles operativos en el backend | El frontend ya los mantiene internamente para reutilización (fixtures, tests, áreas operativas `/operations/*`); duplicarlos en el backend antes de tener demanda real de negocio agrega complejidad sin beneficio inmediato. |
| RBAC granular (permisos por acción) desde el día 1 | Prematuro sin un solo endpoint de negocio implementado todavía; ADR 001 ya prioriza simplicidad en esta etapa. |
| Nombrar los roles `DISTRIBUTOR_ADMIN`/`COMMERCE_OWNER` en el backend (espejo del frontend) | La decisión de producto pide nomenclatura canónica única: `ADMIN` y `COMMERCE`, sin sinónimos (`OWNER`, `DISTRIBUTOR`, `MERCHANT`, etc.). |

## Consecuencias

### Positivas

- Backend y frontend comparten una nomenclatura canónica de perfiles (`ADMIN`/`COMMERCE`), aunque el frontend siga usando `DemoRole` (8 valores) internamente vía una capa de mapeo (`getAppProfile` en `distri-front/src/features/auth/app-profile.ts`).
- El modelo queda preparado para crecer (agregar roles operativos reales) sin haber cerrado la puerta — `Role` es un enum Prisma, extensible en una migración futura.

### Negativas / trade-offs

- Si el negocio necesita roles operativos reales (depósito, caja, reparto) antes de lo esperado, habrá que extender el enum y revisar este ADR.
- `commerceId` sin FK real es una deuda intencional hasta modelar `Commerce`.

## Referencias

- `docs/PROJECT_CONTEXT.md` y `docs/ROADMAP.md` (raíz de `Distrisoft/`, fuera de este repo).
- `distri-front/docs/roles-and-permissions.md`.
- `distri-front/contracts/decisions/authentication.md` y `authorization.md` (OQ-01, OQ-02).
