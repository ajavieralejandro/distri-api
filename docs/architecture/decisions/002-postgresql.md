# ADR 002 — PostgreSQL como base de datos

- **Estado:** Aceptado
- **Fecha:** 2026-07-22
- **Decisores:** Equipo Distrisoft

## Contexto

Distrisoft manejará datos financieros y operativos sensibles a consistencia:

- Stock por depósito
- Pedidos concurrentes
- Cuenta corriente y pagos
- Relaciones entre clientes, productos, precios y comprobantes
- Reportes operativos y contables

La persistencia debe priorizar integridad sobre flexibilidad documental.

## Decisión

Utilizar **PostgreSQL** como base de datos principal, accedida mediante **Prisma ORM**.

## Por qué PostgreSQL encaja con el dominio

### Transacciones

Operaciones típicas (confirmar pedido + descontar stock + impactar cuenta corriente) deben ser **atómicas**. PostgreSQL ofrece transacciones ACID confiables para esos flujos.

### Integridad referencial

Clientes, productos, depósitos, pedidos y comprobantes están relacionados. Foreign keys y constraints evitan estados imposibles (por ejemplo, líneas de pedido sin producto válido).

### Stock

El stock requiere lecturas/escrituras concurrentes controladas (bloqueo o estrategias de consistencia). Un motor relacional con transacciones y bloqueos a nivel de fila es adecuado para evitar sobreventa.

### Cuenta corriente

Saldos, movimientos y conciliaciones exigen precisión numérica e historial consistente. PostgreSQL maneja tipos numéricos adecuados y consultas confiables sobre movimientos.

### Reportes

Consultas analíticas (ventas por período, deuda por cliente, rotación de stock) se benefician de SQL, índices y, más adelante, vistas o materializaciones sin cambiar de motor.

## Alternativas consideradas

| Alternativa | Motivo de descarte |
|---|---|
| MongoDB | Flexible, pero débil para integridad referencial y transacciones multi-documento complejas en este dominio. |
| MySQL | Viable, pero el equipo prioriza PostgreSQL por ecosistema, tipos y herramientas. |
| SQLite | Útil para demos locales, insuficiente como sistema primario de distribución. |

## Consecuencias

### Positivas

- Modelo de datos alineado al dominio comercial.
- Una sola fuente de verdad transaccional.
- Prisma aporta tipado y migraciones versionadas.

### Negativas / trade-offs

- Requiere modelado cuidadoso (migraciones, índices).
- Escalado horizontal de escritura es más complejo que en algunos stores NoSQL (aceptable para esta etapa).

## Notas de etapa

En la base técnica actual no se modelan todavía entidades comerciales. Solo se configura la conexión PostgreSQL + Prisma para validar la infraestructura.
