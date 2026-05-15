import { db } from "../../shared/database.js";

export const userRepository = {
  findAll() {
    return db.user.findMany({ include: { team: true } });
  },

  findById(id: string) {
    return db.user.findUnique({ where: { id }, include: { team: true } });
  },

  findByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  },

  create(data: { email: string; name: string; role?: string; teamId?: string }) {
    return db.user.create({ data, include: { team: true } });
  },

  update(id: string, data: { name?: string; role?: string; teamId?: string | null }) {
    return db.user.update({ where: { id }, data, include: { team: true } });
  },

  delete(id: string) {
    return db.user.delete({ where: { id } });
  },

  count() {
    return db.user.count();
  },
};
