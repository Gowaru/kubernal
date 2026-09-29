import bcrypt from 'bcrypt';
import { db } from '../../shared/database.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { toPublicUser, type PublicUser } from '../../shared/serializers.js';

export async function validateCredentials(email: string, password: string): Promise<PublicUser> {
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

  return toPublicUser(user);
}

export async function getCurrentUser(userId: string): Promise<PublicUser | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return toPublicUser(user);
}

export async function findOrCreateOidcUser(profile: {
  id: string;
  email: string;
  name: string;
  oidcProvider: string;
}): Promise<PublicUser> {
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
    return toPublicUser(existingByOidc);
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
    return toPublicUser(updated);
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

  return toPublicUser(newUser);
}
