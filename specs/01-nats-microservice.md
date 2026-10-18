# SPEC 01 — Migración de REST a Microservicio NATS

> **Status:** Implementado
> **Depends on:** auth-implementation-plan (registro/login/profile implementados)
> **Date:** 2026-10-14
> **Objective:** Convertir el auth-ms de REST API a microservicio con transporte NATS, reemplazando los endpoints HTTP por `@MessagePattern` y eliminando Passport.

## Scope

**In:**

- Instalar `@nestjs/microservices` y `nats`
- Configurar `NATS_URL` en `envs.ts` con validación Joi
- Cambiar `main.ts` a `NestFactory.createMicroservice()` con transporte NATS
- Reemplazar `AuthController` HTTP por `@MessagePattern` (`auth.register`, `auth.login`, `auth.profile`)
- Eliminar `LocalStrategy`, `LocalAuthGuard`, `JwtStrategy`, `JwtAuthGuard`
- Eliminar todas las dependencias de Passport
- Eliminar `@nestjs/platform-express` y `PORT` del `envs.ts`
- Mantener `JwtModule` (para firmar tokens en `login`)
- Mantener `AuthService` sin cambios (lógica agnóstica al transporte)
- Mantener DTOs y `ValidationPipe` global

**Out of scope (for future specs):**

- Implementar gateway API REST que se conecte a NATS
- Implementar `JwtService.verify()` en el microservicio
- Mantener modo dual (HTTP + NATS)
- Tests E2E automatizados con cliente NATS

---

## Data model

No hay cambios en el modelo de datos. El schema de Prisma permanece igual.

---

## Implementation plan

1. **Instalar dependencias NATS** → `npm install @nestjs/microservices nats`
2. **Agregar `NATS_URL` a `envs.ts`** con validación Joi
3. **Eliminar `PORT` de `envs.ts`**
4. **Actualizar `main.ts`** → `NestFactory.createMicroservice(AppModule, { transport: Transport.NATS, options: { servers: [envs.natsUrl] } })`
5. **Actualizar `.env` y `.env.example`** → eliminar `PORT`, agregar `NATS_URL=nats://localhost:4222`
6. **Eliminar archivos de Passport** → `local.strategy.ts`, `jwt.strategy.ts`, `local-auth.guard.ts`, `jwt-auth.guard.ts`
7. **Refactorizar `AuthController`** → reemplazar `@Post`, `@Get` por `@MessagePattern('auth.register')`, `@MessagePattern('auth.login')`, `@MessagePattern('auth.profile')`
8. **Actualizar `AuthService.login()`** → recibe `{ email, password }` y llama a `validateUser()` internamente
9. **Actualizar `AuthModule`** → eliminar `PassportModule`, `JwtStrategy`, `LocalStrategy`
10. **Desinstalar Passport** → `npm uninstall @nestjs/passport passport passport-jwt passport-local @types/passport-jwt @types/passport-local`
11. **Desinstalar `@nestjs/platform-express`**
12. **Verificar compilación** → `npm run build`
13. **Verificar manualmente con NATS** → levantar NATS, ejecutar `npm run start:dev`, probar con cliente NATS

---

## Acceptance criteria

- [x] `@nestjs/microservices` y `nats` están en `package.json`
- [x] `NATS_URL` está en `envs.ts` con validación Joi
- [x] `PORT` fue eliminada de `envs.ts`, `.env`, `.env.example`
- [x] `main.ts` usa `NestFactory.createMicroservice()` con `Transport.NATS`
- [x] `AuthController` tiene `@MessagePattern('auth.register')`, `@MessagePattern('auth.login')`, `@MessagePattern('auth.profile')`
- [x] Archivos de Passport fueron eliminados
- [x] `AuthModule` no importa `PassportModule`
- [x] `AuthService.login()` recibe `{ email, password }` y llama a `validateUser()`
- [x] Dependencias de Passport fueron desinstaladas
- [x] `@nestjs/platform-express` fue desinstalado
- [x] `npm run build` compila sin errores
- [x] Microservicio se conecta a NATS al iniciar
- [x] `auth.register` con datos válidos crea usuario
- [x] `auth.register` con email duplicado retorna error 409
- [x] `auth.login` con credenciales válidas retorna `{ access_token, user }`
- [x] `auth.login` con credenciales inválidas retorna error 401
- [x] `auth.profile` con `userId` válido retorna datos del usuario
- [x] `auth.profile` con `userId` inexistente retorna error 401

---

## Decisions

- **Yes:** NATS puro (sin HTTP)
- **No:** Modo híbrido (HTTP + NATS)
- **Yes:** Eliminar `LocalStrategy` y `LocalAuthGuard`
- **Yes:** Eliminar `JwtStrategy` y `JwtAuthGuard`
- **Yes:** Prefijo `auth.*` para los patrones
- **Yes:** NestJS convierte automáticamente las excepciones en `RpcException`
- **Yes:** `getProfile` recibe `userId` en el payload (gateway valida JWT)
- **Yes:** Eliminar todas las dependencias de Passport
- **Yes:** Eliminar `@nestjs/platform-express` y `PORT`
- **No:** `JwtService.verify()` en el microservicio

---

## Risks

| Risk | Mitigation |
|------|------------|
| NATS server no está corriendo | Asegurar que NATS esté disponible antes de iniciar |
| Gateway/API no implementado | Usar script manual con cliente NATS para verificación |
| Errores no se propagan correctamente | Revisar logs del microservicio y del cliente |

---

## What is **not** in this spec

- Implementar gateway API REST que se conecte a NATS (otro spec si se necesita).
- Validar JWT en el microservicio con `JwtService.verify()` (otro spec si se necesita).
- Mantener modo dual HTTP + NATS.
- Tests E2E automatizados con cliente NATS (otro spec si se necesita).

Cada uno de esos, si se necesita, va en su propio spec.

---

### Spec Checker Report

> **Fecha de verificación:** 2026-10-15
> **Criterios totales:** 18
> **Cumplidos:** 11 ✅
> **Pendientes:** 7 ⚠️ (no verificables sin NATS corriendo)
> **Corregidos:** 0

| # | Criterio | Estado | Evidencia |
|---|----------|--------|-----------|
| 1 | `@nestjs/microservices` y `nats` están en `package.json` | ✅ | `package.json` líneas 31, 37: `"@nestjs/microservices": "^12.1.3"`, `"nats": "^2.29.3"` |
| 2 | `NATS_URL` está en `envs.ts` con validación Joi | ✅ | `src/config/envs.ts` líneas 8, 13: `NATS_URL: string;` y `NATS_URL: joi.string().required()` |
| 3 | `PORT` fue eliminada de `envs.ts`, `.env`, `.env.example` | ✅ | Grep confirma que no existe `PORT` en ninguno de los tres archivos |
| 4 | `main.ts` usa `NestFactory.createMicroservice()` con `Transport.NATS` | ✅ | `src/main.ts` líneas 9-14: `NestFactory.createMicroservice(AppModule, { transport: Transport.NATS, ... })` |
| 5 | `AuthController` tiene los tres `@MessagePattern` | ✅ | `src/auth/auth.controller.ts` líneas 11, 16, 21: `@MessagePattern('auth.register')`, `@MessagePattern('auth.login')`, `@MessagePattern('auth.profile')` |
| 6 | Archivos de Passport fueron eliminados | ✅ | Grep de `*strategy*.ts` y `*guard*.ts` no encontró archivos. Directorio `src/auth/` solo contiene: `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`, `dto/`, `interfaces/` |
| 7 | `AuthModule` no importa `PassportModule` | ✅ | `src/auth/auth.module.ts` solo importa `JwtModule` (línea 9-18). No hay referencia a `PassportModule` |
| 8 | `AuthService.login()` recibe `{ email, password }` y llama a `validateUser()` | ✅ | `src/auth/auth.service.ts` líneas 90-91: `async login(loginDto: LoginDto)` recibe DTO con email/password y llama `this.validateUser(loginDto.email, loginDto.password)` |
| 9 | Dependencias de Passport fueron desinstaladas | ✅ | Grep de `passport` en `package.json` no encontró coincidencias |
| 10 | `@nestjs/platform-express` fue desinstalado | ✅ | Grep de `platform-express` en `package.json` no encontró coincidencias |
| 11 | `npm run build` compila sin errores | ✅ | Ejecutado exitosamente: `nest build` completó sin errores |
| 12 | Microservicio se conecta a NATS al iniciar | ⚠️ | **No verificable:** Requiere servidor NATS corriendo. El spec incluye esto en "Risks" y "Out of scope" |
| 13 | `auth.register` con datos válidos crea usuario | ⚠️ | **No verificable:** Requiere NATS + base de datos corriendo. Código muestra lógica correcta en `AuthService.register()` (líneas 25-62) |
| 14 | `auth.register` con email duplicado retorna error 409 | ⚠️ | **No verificable:** Requiere NATS + base de datos. Código muestra manejo de error P2002 de Prisma que lanza `ConflictException` (líneas 53-59) |
| 15 | `auth.login` con credenciales válidas retorna `{ access_token, user }` | ⚠️ | **No verificable:** Requiere NATS corriendo. Código muestra retorno correcto en `AuthService.login()` (líneas 103-111) |
| 16 | `auth.login` con credenciales inválidas retorna error 401 | ⚠️ | **No verificable:** Requiere NATS corriendo. Código muestra `throw new UnauthorizedException('Invalid credentials')` (línea 94) |
| 17 | `auth.profile` con `userId` válido retorna datos del usuario | ⚠️ | **No verificable:** Requiere NATS corriendo. Código muestra consulta Prisma en `AuthService.getProfile()` (líneas 114-135) |
| 18 | `auth.profile` con `userId` inexistente retorna error 401 | ⚠️ | **No verificable:** Requiere NATS corriendo. Código muestra `throw new UnauthorizedException('Usuario no encontrado')` (línea 128) |

#### Análisis de calidad de criterios

Todos los criterios son booleanos, concretos y verificables. No se requirieron correcciones.

Los criterios 12-18 son de comportamiento y requieren integración con NATS. El spec los marca explícitamente como "Out of scope" y los incluye en la sección "Risks" con mitigación: "Usar script manual con cliente NATS para verificación".

#### Estructura del proyecto verificada

```
auth-ms/
├── src/
│   ├── main.ts                          ✅ Microservicio NATS configurado
│   ├── config/envs.ts                   ✅ NATS_URL validada con Joi
│   ├── auth/
│   │   ├── auth.controller.ts           ✅ @MessagePattern decorators
│   │   ├── auth.service.ts              ✅ Lógica agnóstica al transporte
│   │   ├── auth.module.ts               ✅ Sin PassportModule
│   │   ├── dto/                         ✅ DTOs mantenidos
│   │   └── interfaces/                  ✅ Interfaces mantenidas
│   └── common/filters/                  ✅ Filtro global de excepciones
├── .env                                 ✅ NATS_URL presente, PORT eliminada
├── .env.example                         ✅ NATS_URL presente, PORT eliminada
└── package.json                         ✅ Dependencias correctas
```

#### Patrón de NestJS verificado

El proyecto sigue correctamente el patrón de microservicio NATS de NestJS:

1. ✅ `NestFactory.createMicroservice()` con `Transport.NATS`
2. ✅ `@MessagePattern()` decorators en el controller
3. ✅ `@Payload()` para extraer datos del mensaje
4. ✅ `ValidationPipe` global configurado
5. ✅ Filtro de excepciones global (`AllExceptionsFilter`)
6. ✅ Inyección de dependencias vía constructor
7. ✅ DTOs con `class-validator` y `class-transformer`

#### Recomendaciones para verificación manual

Para verificar los criterios 12-18, ejecutar:

```bash
# 1. Iniciar servidor NATS (Docker)
docker run -d -p 4222:4222 nats

# 2. Iniciar microservicio
npm run start:dev

# 3. Probar con cliente NATS (ejemplo con nats-cli)
nats req auth.register '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
nats req auth.login '{"email":"test@example.com","password":"Test123!"}'
nats req auth.profile '{"userId":"<user-id-del-login>"}'
```

Alternativamente, usar scripts Node.js con `nats.connect()` para automatizar las pruebas.

---

### Spec Checker Report — Verificación runtime

> **Fecha de verificación:** 2026-10-18
> **Criterios totales:** 18
> **Cumplidos:** 18 ✅
> **Pendientes:** 0
> **Entorno:** Docker (`auth-ms-postgres` :5433, `auth-ms-nats` :4222/:8222), `auth-ms` y `client-gateway` corriendo
> **Método:** Pruebas E2E a través de `client-gateway` (HTTP :3000 → NATS :4222 → auth-ms → Prisma → Postgres), lo que ejercita el transporte NATS completo de ida y vuelta

| # | Criterio | Estado | Evidencia |
|---|----------|--------|-----------|
| 12 | Microservicio se conecta a NATS al iniciar | ✅ | NATS monitoring (`localhost:8222/connz`) muestra el cliente de auth-ms con 3 suscripciones (`auth.register`, `auth.login`, `auth.profile`); log `Nest microservice successfully started` |
| 13 | `auth.register` con datos válidos crea usuario | ✅ | `POST /auth/register` → 201, usuario persistido en Postgres con `roles: ["CUSTOMER"]`, `isActive: true` |
| 14 | `auth.register` con email duplicado retorna error 409 | ✅ | Segundo registro con el mismo email → `RpcException` con status 409 `"Email already exists"` (viaja por NATS y el gateway lo mapea a HTTP 409) |
| 15 | `auth.login` con credenciales válidas retorna `{ access_token, user }` | ✅ | `POST /auth/login` → `{ access_token, user }`; payload del JWT decodificado y verificado (`userId`, `email`, `roles`, `iat`, `exp` 1h) |
| 16 | `auth.login` con credenciales inválidas retorna error 401 | ✅ | Password incorrecto → `RpcException` con status 401 `"Invalid credentials"` |
| 17 | `auth.profile` con `userId` válido retorna datos del usuario | ✅ | `GET /auth/profile?userId=<id real>` → datos completos del usuario |
| 18 | `auth.profile` con `userId` inexistente retorna error 401 | ✅ | `userId` inexistente → `RpcException` con status 401 `"Usuario no encontrado"` |

**Resiliencia (extra, fuera de criterios):** con auth-ms detenido, el gateway responde 503 `"Auth service is unavailable"`; tras reiniciar auth-ms, la comunicación se recupera sin reiniciar el gateway.

**Nota de entorno:** durante la verificación se detectó que la migración `0_init` duplicaba a `20261013202719_init` y la BD quedó en estado fallido; se resolvió con `prisma migrate resolve --applied "0_init"`. Se recomienda eliminar la carpeta `prisma/migrations/0_init/` del repositorio.
