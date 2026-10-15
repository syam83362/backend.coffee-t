import { UserRole } from '../database/entities/user.entity';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface IssuedTokens {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequestUser {
  id: string;
  role: UserRole;
}