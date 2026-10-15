# SPEC 01 — Migración de REST a Microservicio NATS

> **Status:** Aprobado
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

- [ ] `@nestjs/microservices` y `nats` están en `package.json`
- [ ] `NATS_URL` está en `envs.ts` con validación Joi
- [ ] `PORT` fue eliminada de `envs.ts`, `.env`, `.env.example`
- [ ] `main.ts` usa `NestFactory.createMicroservice()` con `Transport.NATS`
- [ ] `AuthController` tiene `@MessagePattern('auth.register')`, `@MessagePattern('auth.login')`, `@MessagePattern('auth.profile')`
- [ ] Archivos de Passport fueron eliminados
- [ ] `AuthModule` no importa `PassportModule`
- [ ] `AuthService.login()` recibe `{ email, password }` y llama a `validateUser()`
- [ ] Dependencias de Passport fueron desinstaladas
- [ ] `@nestjs/platform-express` fue desinstalado
- [ ] `npm run build` compila sin errores
- [ ] Microservicio se conecta a NATS al iniciar
- [ ] `auth.register` con datos válidos crea usuario
- [ ] `auth.register` con email duplicado retorna error 409
- [ ] `auth.login` con credenciales válidas retorna `{ access_token, user }`
- [ ] `auth.login` con credenciales inválidas retorna error 401
- [ ] `auth.profile` con `userId` válido retorna datos del usuario
- [ ] `auth.profile` con `userId` inexistente retorna error 401

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
