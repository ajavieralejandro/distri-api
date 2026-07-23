# Arquitectura — Distrisoft API

## Qué es un monolito modular

Un **monolito modular** es una única aplicación desplegable (un solo proceso Node.js / un solo artefacto) cuya lógica interna está organizada en **módulos con límites claros**.

No es un “big ball of mud”: cada módulo concentra un área de negocio (clientes, productos, pedidos, etc.) y expone hacia el resto de la aplicación solo lo necesario.

Tampoco es una arquitectura de microservicios: no hay redes entre servicios, ni despliegues independientes por dominio en esta etapa.

## Por qué lo usamos en Distrisoft

Distrisoft es un sistema de distribuidora con módulos fuertemente relacionados:

- Pedidos dependen de productos, listas de precios y stock.
- Cuenta corriente y pagos dependen de clientes y comprobantes.
- El panel web y la app móvil consumirán la misma API.

En la fase inicial necesitamos:

1. **Velocidad de desarrollo** con un solo repositorio y un solo despliegue.
2. **Transacciones consistentes** (stock + pedido + cuenta corriente) sin orquestación distribuida.
3. **Límites de módulo** que permitan, más adelante, extraer un servicio si el negocio lo justifica.

El monolito modular equilibra simplicidad operativa y orden interno.

## Cómo se separarán los módulos

La estructura prevista bajo `src/modules/` seguirá áreas de negocio, por ejemplo:

| Módulo (futuro) | Responsabilidad |
|---|---|
| `clients` | Clientes y datos comerciales asociados |
| `users` | Usuarios del sistema y roles |
| `products` | Productos y categorías |
| `pricing` | Listas de precios |
| `inventory` | Stock por depósito |
| `orders` | Pedidos (origen móvil / web) |
| `accounts` | Cuenta corriente |
| `payments` | Pagos y comprobantes |
| `reports` | Consultas y reportes |

Además existe infraestructura transversal en `src/shared/` (Prisma, errores, filtros, logging) y configuración en `src/config/`.

Reglas prácticas:

- Un módulo **no** debe acceder a tablas de otro módulo saltando su API interna (servicios exportados).
- La comunicación entre módulos se hace por **servicios de aplicación**, no importando controladores ajenos.
- `shared/` no debe acumular reglas de negocio; solo utilidades técnicas reutilizables.

## Capas: controller, application service, dominio y repositorio

Aunque NestJS no impone DDD completo, conviene respetar estas responsabilidades:

### Controller

- Recibe HTTP (o el transporte que corresponda).
- Valida/entrada tipada mediante DTO + `ValidationPipe`.
- Delega en el servicio de aplicación.
- Traduce el resultado a respuesta HTTP / Swagger.

### Application service

- Orquesta el caso de uso.
- Coordina dominio, repositorios y otros módulos.
- Controla transacciones cuando el caso lo requiere.
- No conoce detalles de Express/Nest decorators de routing.

### Dominio

- Reglas de negocio puras (cálculos, invariantes, estados válidos).
- Independiente de frameworks y de la base de datos.
- En esta etapa temprana puede ser mínimo; crecerá con el dominio comercial.

### Repositorio / acceso a datos

- Persistencia (hoy: Prisma).
- Traduce entre modelos de persistencia y estructuras usadas por la aplicación.
- No contiene reglas de negocio complejas.

## Qué no debe ir en los controllers

Los controllers **no** deben:

- Contener reglas de negocio (descuentos, límites de crédito, reservas de stock).
- Hablar directamente con Prisma u otro ORM.
- Armar transacciones multi-paso.
- Mezclar autorización compleja con lógica comercial (cuando exista auth).
- Devolver estructuras internas de base de datos sin mapear.

Si un controller crece en “ifs” de negocio, esa lógica debe bajarse al application service (o al dominio).

## Estado actual

En esta etapa solo está implementada la base técnica:

- Bootstrap NestJS + configuración validada
- Prisma + PostgreSQL
- Health check
- Errores, logging y Swagger (no producción)
- Documentación de arquitectura y desarrollo

Los módulos comerciales se diseñarán e implementarán después de validar esta base.
