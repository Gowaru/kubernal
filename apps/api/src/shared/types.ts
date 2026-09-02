import type { User } from '@kubernal/shared-types';

declare module 'express' {
  interface Request {
    user?: User;
  }
}
