import { Request } from 'express';
import { AuthenticatedRequestUser } from './auth.types';

export interface AuthRequest extends Request {
  user: AuthenticatedRequestUser;
}