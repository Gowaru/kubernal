import type { PublicUser } from './serializers.js';

declare module 'express' {
  interface Request {
    /** Always the sanitized projection – never contains `passwordHash`/`oidcId`. */
    user?: PublicUser;
  }
}
