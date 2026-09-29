import type { User } from '@prisma/client';
import { db } from '../../shared/database.js';
import { publicUserWithTeamSelect, type PublicUserWithTeam } from '../../shared/serializers.js';
export const userRepository = {
  findAll(): Promise<PublicUserWithTeam[]> {
    return db.user.findMany({ select: publicUserWithTeamSelect });
  },

  findById(id: string): Promise<PublicUserWithTeam | null> {
    return db.user.findUnique({ where: { id }, select: publicUserWithTeamSelect });
  },

  /**
   * Internal only – returns the complete row (incl. `passwordHash`).
   * Used by the authentication flow and by the uniqueness check on create.
   * Never expose the result of this query to a client: use `findAll`/`findById`.
   */
  findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  },

  create(data: {
    email: string;
    name: string;
    role?: string;
    teamId?: string;
  }): Promise<PublicUserWithTeam> {
    return db.user.create({ data, select: publicUserWithTeamSelect });
  },

  update(
    id: string,
    data: { name?: string; role?: string; teamId?: string | null },
  ): Promise<PublicUserWithTeam> {
    return db.user.update({ where: { id }, data, select: publicUserWithTeamSelect });
  },

  delete(id: string): Promise<PublicUserWithTeam> {
    return db.user.delete({ where: { id }, select: publicUserWithTeamSelect });
  },

  count(): Promise<number> {
    return db.user.count();
  },
};
