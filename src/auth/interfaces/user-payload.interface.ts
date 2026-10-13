import { Role } from '@prisma/client';

export interface UserPayload {
  userId: string;
  email: string;
  roles: Role[];
}
