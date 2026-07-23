# ADR 001 — Node.js, TypeScript y NestJS

- **Estado:** Aceptado
- **Fecha:** 2026-07-22
- **Decisores:** Equipo Distrisoft

## Contexto

Necesitamos un backend para una distribuidora que, de forma progresiva, administrará clientes, productos, stock, pedidos móviles, cuenta corriente, pagos y un panel web.

Requisitos iniciales de la plataforma:

- Productividad del equipo con tipado fuerte.
- Estructura clara para un monolito modular.
- Ecosistema maduro para APIs HTTP, validación, documentación y pruebas.
- Capacidad de crecer sin reescribir la base en el corto plazo.

## Decisión

Utilizar:

- **Node.js** (versión LTS) como runtime.
- **TypeScript** como lenguaje.
- **NestJS** como framework de aplicación.

## Alternativas consideradas

| Alternativa | Motivo de descarte (etapa actual) |
|---|---|
| Express “a mano” | Más flexible, pero exige armar a mano módulos, DI, pipes, filtros y documentación. |
| Fastify puro | Excelente rendimiento, menor opinión sobre arquitectura modular lista para un ERP/distribución. |
| NestJS + microservicios desde día 1 | Complejidad operativa prematura para un dominio aún no estabilizado. |
| Java/Spring o .NET | Válidos a largo plazo, pero aumentan curva de arranque y no son el stack decidido del proyecto. |

## Consecuencias

### Positivas

- Módulos NestJS mapean bien a límites de negocio.
- DI, pipes, filters y guards reducen código boilerplate.
- Swagger, validación y testing tienen caminos conocidos.
- TypeScript reduce errores de contrato entre API y clientes (web/móvil).

### Negativas / trade-offs

- NestJS es más “pesado” que un Express mínimo.
- Hay curva de aprendizaje (módulos, providers, scopes).
- Hay que disciplinar al equipo para no meter negocio en controllers.

## Motivo de la elección

Node.js LTS ofrece un runtime estable y un ecosistema adecuado para APIs JSON consumidas por web y móvil.

TypeScript aporta contratos explícitos (DTO, servicios, Prisma) críticos en un sistema con stock, precios y cuenta corriente.

NestJS aporta la estructura de monolito modular sin forzar microservicios, permitiendo entregar una base técnica sólida y extender módulos comerciales de forma ordenada.
