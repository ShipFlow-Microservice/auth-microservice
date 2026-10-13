# Plan de Implementación: Autenticación con PostgreSQL y Prisma

## Resumen

Implementar sistema de autenticación completo en el microservicio `auth-ms` utilizando:
- **PostgreSQL** como base de datos
- **Prisma ORM** para gestión de base de datos
- **JWT** para tokens de autenticación
- **Passport** para estrategias de autenticación
- **bcrypt** para hasheo de contraseñas

## Estado Actual
**Estado:** Aprobado
Proyecto scaffold de NestJS 12 con:
- Módulos auth vacíos (controller, service, module sin lógica)
- Sin base de datos configurada
- Sin variables de entorno
- Dependencias base: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`

---

## Paso 1: Instalación de Dependencias

### Dependencias de Producción
```bash
npm install @nestjs/jwt @nestjs/passport @nestjs/config passport passport-jwt passport-local bcrypt @prisma/client
```

### Dependencias de Desarrollo
```bash
npm install -D prisma @types/passport-jwt @types/passport-local @types/bcrypt
```

### Inicializar Prisma
```bash
npx prisma init --datasource-provider postgresql
```

Esto crea:
- `prisma/schema.prisma`
- `.env` (si no existe)

---

## Paso 2: Schema de Prisma

**Archivo:** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  OPERATOR
  CUSTOMER
  COURIER
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  isActive  Boolean  @default(true)
  roles     Role[]   @default([CUSTOMER])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Características:**
- ID como UUID (string)
- Enum `Role` con 4 roles: ADMIN, OPERATOR, CUSTOMER, COURIER
- Rol por defecto: CUSTOMER (menor privilegio)
- Campo `isActive` para activar/desactivar usuarios
- Timestamps automáticos

---

## Paso 3: Variables de Entorno

**Archivo:** `.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/auth_db?schema=public"
JWT_SECRET="tu-secreto-jwt-muy-seguro-cambiar-en-produccion"
JWT_EXPIRES_IN="1h"
PORT=3000
```

**Archivo:** `.env.example` (para referencia)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/auth_db?schema=public"
JWT_SECRET="your-jwt-secret-change-in-production"
JWT_EXPIRES_IN="1h"
PORT=3000
```

---

## Paso 4: Estructura de Archivos

```
src/
├── prisma/
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── auth/
│   ├── dto/
│   │   ├── register.dto.ts
│   │   └── login.dto.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── local-auth.guard.ts
│   ├── interfaces/
│   │   └── user-payload.interface.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── app.module.ts
└── main.ts
```

---

## Paso 5: Código de Cada Archivo

### 5.1 PrismaService

**Archivo:** `src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 5.2 PrismaModule

**Archivo:** `src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 5.3 DTOs

**Archivo:** `src/auth/dto/register.dto.ts`

```typescript
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
```

**Archivo:** `src/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
```

### 5.4 Interfaces

**Archivo:** `src/auth/interfaces/user-payload.interface.ts`

```typescript
import { Role } from '@prisma/client';

export interface UserPayload {
  userId: string;
  email: string;
  roles: Role[];
}
```

### 5.5 Estrategias

**Archivo:** `src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserPayload } from '../interfaces/user-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: UserPayload): Promise<UserPayload> {
    return {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
```

**Archivo:** `src/auth/strategies/local.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
}
```

### 5.6 Guards

**Archivo:** `src/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Archivo:** `src/auth/guards/local-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

### 5.7 AuthService

**Archivo:** `src/auth/auth.service.ts`

```typescript
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { Role } from '@prisma/client';
import { UserPayload } from './interfaces/user-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Verificar si el email ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario con rol CUSTOMER por defecto
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        roles: [Role.CUSTOMER],
      },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload: UserPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }
}
```

### 5.8 AuthController

**Archivo:** `src/auth/auth.controller.ts`

```typescript
import { Controller, Post, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }
}
```

### 5.9 AuthModule

**Archivo:** `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### 5.10 AppModule Actualizado

**Archivo:** `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

---

## Paso 6: Instalación de class-validator y class-transformer

Necesarios para los DTOs:

```bash
npm install class-validator class-transformer
```

### Actualizar main.ts

**Archivo:** `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## Paso 7: Actualizar .gitignore

**Archivo:** `.gitignore`

Agregar:
```gitignore
# Prisma
node_modules/
prisma/*.db
prisma/migrations/

# Environment
.env
.env.local
.env.*.local
```

---

## Paso 8: Migración de Base de Datos

Después de crear todos los archivos:

```bash
# Ejecutar migración
npx prisma migrate dev --name init

# Esto:
# 1. Crea la base de datos si no existe
# 2. Genera el cliente de Prisma
# 3. Crea la tabla User con el enum Role
```

---

## Paso 9: Endpoints de la API

### POST /auth/register

**Request:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123",
  "name": "Nombre Usuario"
}
```

**Response (201):**
```json
{
  "id": "uuid-generado",
  "email": "usuario@ejemplo.com",
  "name": "Nombre Usuario",
  "roles": ["CUSTOMER"],
  "isActive": true,
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

### POST /auth/login

**Request:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "roles": ["CUSTOMER"]
  }
}
```

### GET /auth/profile

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid-del-usuario",
  "email": "usuario@ejemplo.com",
  "name": "Nombre Usuario",
  "roles": ["CUSTOMER"],
  "isActive": true,
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

---

## Flujo de Autenticación

### Registro
1. Usuario envía POST a `/auth/register`
2. Controller recibe y valida DTO
3. AuthService verifica si email existe
4. Si no existe: hashea password con bcrypt (10 salt rounds)
5. Crea usuario en BD con rol `CUSTOMER` por defecto
6. Retorna usuario sin password

### Login
1. Usuario envía POST a `/auth/login`
2. LocalAuthGuard intercepta y llama a LocalStrategy
3. LocalStrategy llama a AuthService.validateUser()
4. Busca usuario por email en BD
5. Compara password con bcrypt
6. Si es válido: retorna usuario sin password
7. AuthService.login() genera JWT con payload: `{ userId, email, roles }`
8. Retorna `{ access_token, user }`

### Profile (ruta protegida)
1. Usuario envía GET a `/auth/profile` con Bearer token
2. JwtAuthGuard intercepta y llama a JwtStrategy
3. JwtStrategy extrae y valida token
4. Decodifica payload y lo pasa a validate()
5. Controller recibe `req.user` con `userId, email, roles`
6. AuthService.getProfile() busca usuario completo en BD
7. Retorna datos del usuario

---

## Verificación Final

### Comandos para probar:

```bash
# 1. Iniciar servidor de desarrollo
npm run start:dev

# 2. Registrar usuario
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# 3. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 4. Obtener profile (usar token del paso anterior)
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer <tu-token-aqui>"

# 5. Ver base de datos con Prisma Studio
npx prisma studio
```

---

## Checklist de Implementación

- [ ] Instalar dependencias de producción
- [ ] Instalar dependencias de desarrollo
- [ ] Inicializar Prisma
- [ ] Crear schema.prisma con UUID y enum Role
- [ ] Configurar .env
- [ ] Crear PrismaService y PrismaModule
- [ ] Instalar class-validator y class-transformer
- [ ] Actualizar main.ts con ValidationPipe
- [ ] Crear DTOs (register, login)
- [ ] Crear interfaces (UserPayload)
- [ ] Crear estrategias (JWT, Local)
- [ ] Crear guards (JWT, Local)
- [ ] Implementar AuthService
- [ ] Implementar AuthController
- [ ] Actualizar AuthModule
- [ ] Actualizar AppModule
- [ ] Actualizar .gitignore
- [ ] Ejecutar migración de Prisma
- [ ] Probar endpoints

---

## Notas Importantes

1. **UUID como ID**: El campo `id` es string (UUID), no número
2. **Rol por defecto**: Los usuarios nuevos se registran con rol `CUSTOMER`
3. **JWT Payload**: Incluye `userId` (string), `email` y `roles` (array de enum)
4. **Password**: Nunca se retorna en las respuestas
5. **Seguridad**: bcrypt con 10 salt rounds, JWT con expiración de 1 hora
6. **Validación**: DTOs validados con class-validator
7. **Prisma Global**: PrismaModule es global, no necesita importarse en cada módulo

---

## Archivos a Crear/Modificar

### Nuevos:
- `prisma/schema.prisma`
- `.env`
- `.env.example`
- `src/prisma/prisma.service.ts`
- `src/prisma/prisma.module.ts`
- `src/auth/dto/register.dto.ts`
- `src/auth/dto/login.dto.ts`
- `src/auth/interfaces/user-payload.interface.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/auth/strategies/local.strategy.ts`
- `src/auth/guards/jwt-auth.guard.ts`
- `src/auth/guards/local-auth.guard.ts`

### Modificar:
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.module.ts`
- `src/app.module.ts`
- `src/main.ts`
- `.gitignore`
- `package.json` (automático con npm install)

---

**Revisa este plan y confirma cuando estés listo para implementarlo.**
