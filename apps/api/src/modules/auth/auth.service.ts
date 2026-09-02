import bcrypt from 'bcrypt';
import type { User } from '@kubernal/shared-types';
import { db } from '../../shared/database.js';
import { UnauthorizedError } from '../../shared/errors.js';

export async function validateCredentials(
  email: string,
  password: string,
): Promise<Omit<User, 'passwordHash'>> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser as Omit<User, 'passwordHash'>;
}

export async function getCurrentUser(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser as Omit<User, 'passwordHash'>;
}

export async function findOrCreateOidcUser(profile: {
  id: string;
  email: string;
  name: string;
  oidcProvider: string;
}): Promise<User> {
  const existingByOidc = await db.user.findFirst({
    where: {
      oidcProvider: profile.oidcProvider,
      oidcId: profile.id,
    },
  });

  if (existingByOidc) {
    await db.user.update({
      where: { id: existingByOidc.id },
      data: { lastLogin: new Date() },
    });
    return existingByOidc as User;
  }

  const existingByEmail = await db.user.findUnique({
    where: { email: profile.email },
  });

  if (existingByEmail) {
    const updated = await db.user.update({
      where: { id: existingByEmail.id },
      data: {
        oidcProvider: profile.oidcProvider,
        oidcId: profile.id,
        lastLogin: new Date(),
      },
    });
    return updated as User;
  }

  const newUser = await db.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      role: 'developer',
      oidcProvider: profile.oidcProvider,
      oidcId: profile.id,
      lastLogin: new Date(),
    },
  });

  return newUser as User;
}
