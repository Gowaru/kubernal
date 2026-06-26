/* eslint-disable no-console */
import 'dotenv/config';
import { select, input, password, confirm, checkbox } from '@inquirer/prompts';
import bcrypt from 'bcrypt';
import type { User, Team } from '@prisma/client';
import { db } from '../shared/database.js';

const SALT_ROUNDS = 10;

const ROLE_OPTIONS = [
  { value: 'developer', name: 'Developer' },
  { value: 'platform_engineer', name: 'Platform Engineer' },
  { value: 'admin', name: 'Admin' },
  { value: 'security_admin', name: 'Security Admin' },
  { value: 'viewer', name: 'Viewer' },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.name]),
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NS_PREFIX_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function printHeader(): void {
  console.log('┌──────────────────────────────────────────┐');
  console.log('│   Kubernal — Gestion des utilisateurs    │');
  console.log('├──────────────────────────────────────────┤');
  console.log('│  1. Créer un utilisateur                 │');
  console.log('│  2. Lister les utilisateurs              │');
  console.log('│  3. Modifier un utilisateur              │');
  console.log('│  4. Réinitialiser le mot de passe        │');
  console.log('│  5. Supprimer un utilisateur             │');
  console.log('│  6. Quitter                              │');
  console.log('└──────────────────────────────────────────┘');
}

function formatDate(d: Date | null): string {
  if (!d) return 'Jamais';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function printSeparator(widths: number[]): void {
  console.log(widths.map((w) => '─'.repeat(w)).join('─┼─'));
}

function clearScreen(): void {
  console.clear();
}

async function pause(): Promise<void> {
  await input({ message: 'Appuyez sur Entrée pour continuer...' });
}

// ── Feature 1: Créer un utilisateur ─────────────────────────────────────────

async function promptTeam(): Promise<Team> {
  const teams = await db.team.findMany({ orderBy: { name: 'asc' } });
  const choices = teams.map((t) => ({ value: t.id, name: `${t.name} (${t.namespacePrefix})` }));
  choices.push({ value: '__new__', name: '➕ Créer une nouvelle équipe' });

  const teamId = await select({
    message: 'Sélectionnez une équipe :',
    choices,
  });

  if (teamId === '__new__') {
    return createTeam();
  }

  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new Error('Équipe introuvable');
  return team;
}

async function createTeam(): Promise<Team> {
  const name = await input({
    message: 'Nom de l\'équipe :',
    validate: async (value) => {
      if (!value.trim()) return 'Le nom ne peut pas être vide';
      const existing = await db.team.findUnique({ where: { name: value.trim() } });
      if (existing) return 'Cette équipe existe déjà';
      return true;
    },
  });

  const description = await input({ message: 'Description (optionnel) :', default: '' });

  const namespacePrefix = await input({
    message: 'Préfixe namespace (minuscules, chiffres, tirets) :',
    validate: (value) => {
      if (!value.trim()) return 'Le préfixe ne peut pas être vide';
      if (!NS_PREFIX_REGEX.test(value.trim())) return 'Format invalide (minuscules, chiffres, tirets uniquement)';
      return true;
    },
  });

  const quotaCpu = await input({ message: 'Quota CPU (défaut "4") :', default: '4' });
  const quotaMemory = await input({ message: 'Quota mémoire (défaut "8Gi") :', default: '8Gi' });

  console.log('\nRésumé de l\'équipe :');
  console.log(`  Nom      : ${name.trim()}`);
  console.log(`  Namespace: ${namespacePrefix.trim()}`);
  console.log(`  CPU      : ${quotaCpu.trim()}`);
  console.log(`  Mémoire  : ${quotaMemory.trim()}`);

  const ok = await confirm({ message: 'Créer cette équipe ?', default: true });
  if (!ok) {
    console.log('Création annulée.');
    process.exit(0);
  }

  return db.team.create({
    data: {
      name: name.trim(),
      description: description.trim() || null,
      namespacePrefix: namespacePrefix.trim(),
      quotaCpu: quotaCpu.trim(),
      quotaMemory: quotaMemory.trim(),
    },
  });
}

async function featureCreate(): Promise<void> {
  console.log('\n── Créer un utilisateur ──\n');

  const team = await promptTeam();

  const email = await input({
    message: 'Email :',
    validate: async (value) => {
      if (!EMAIL_REGEX.test(value.trim())) return 'Email invalide';
      const existing = await db.user.findUnique({ where: { email: value.trim() } });
      if (existing) return 'Cet email est déjà utilisé';
      return true;
    },
  });

  const name = await input({
    message: 'Nom complet :',
    validate: (value) => (value.trim() ? true : 'Le nom ne peut pas être vide'),
  });

  const role = await select({
    message: 'Rôle :',
    choices: [...ROLE_OPTIONS],
  });

  const pwd = await password({
    message: 'Mot de passe :',
    validate: (value) => (value.length >= 8 ? true : 'Minimum 8 caractères'),
  });

  await password({
    message: 'Confirmer le mot de passe :',
    validate: (value) => (value === pwd ? true : 'Les mots de passe ne correspondent pas'),
  });

  console.log('\n┌─── Résumé ───────────────────────────────');
  console.log(`│ Email  : ${email.trim()}`);
  console.log(`│ Nom    : ${name.trim()}`);
  console.log(`│ Rôle   : ${ROLE_LABELS[role] ?? role}`);
  console.log(`│ Équipe : ${team.name}`);
  console.log('└───────────────────────────────────────────');

  const ok = await confirm({ message: 'Confirmer la création ?', default: true });
  if (!ok) {
    console.log('Création annulée.');
    return;
  }

  const passwordHash = await bcrypt.hash(pwd, SALT_ROUNDS);
  const user = await db.user.create({
    data: {
      email: email.trim(),
      name: name.trim(),
      role,
      teamId: team.id,
      passwordHash,
    },
  });

  console.log(`\n✅ Utilisateur créé : ${user.id}`);
  console.log(`   Email : ${user.email}`);
  console.log(`   Nom   : ${user.name}`);
  console.log(`   Rôle  : ${ROLE_LABELS[user.role] ?? user.role}`);
  console.log(`   Équipe: ${team.name}`);

  const again = await confirm({ message: 'Créer un autre utilisateur ?', default: false });
  if (again) {
    await featureCreate();
  }
}

// ── Feature 2: Lister les utilisateurs ──────────────────────────────────────

async function featureList(): Promise<void> {
  console.log('\n── Liste des utilisateurs ──\n');

  const users = await db.user.findMany({
    include: { team: true },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log('Aucun utilisateur trouvé.');
    return;
  }

  const colEmail = 30;
  const colName = 24;
  const colRole = 20;
  const colTeam = 20;
  const colLastLogin = 16;
  const colCreated = 12;

  const header =
    padRight('Email', colEmail) +
    ' │ ' +
    padRight('Nom', colName) +
    ' │ ' +
    padRight('Rôle', colRole) +
    ' │ ' +
    padRight('Équipe', colTeam) +
    ' │ ' +
    padRight('Dernière connexion', colLastLogin) +
    ' │ ' +
    padRight('Créé le', colCreated);

  const widths = [colEmail, colName, colRole, colTeam, colLastLogin, colCreated];

  console.log(header);
  printSeparator(widths);

  for (const u of users) {
    const row =
      padRight(truncate(u.email, colEmail), colEmail) +
      ' │ ' +
      padRight(truncate(u.name, colName), colName) +
      ' │ ' +
      padRight(truncate(ROLE_LABELS[u.role] ?? u.role, colRole), colRole) +
      ' │ ' +
      padRight(truncate(u.team?.name ?? '—', colTeam), colTeam) +
      ' │ ' +
      padRight(formatDate(u.lastLogin), colLastLogin) +
      ' │ ' +
      padRight(formatDate(u.createdAt), colCreated);
    console.log(row);
  }

  console.log(`\nTotal : ${users.length} utilisateur(s)`);
}

// ── Feature 3: Modifier un utilisateur ──────────────────────────────────────

async function selectUser(message = 'Sélectionnez un utilisateur :'): Promise<User & { team: Team | null }> {
  const users = await db.user.findMany({
    include: { team: true },
    orderBy: { email: 'asc' },
  });

  if (users.length === 0) {
    console.log('Aucun utilisateur trouvé.');
    process.exit(0);
  }

  const userId = await select({
    message,
    choices: users.map((u) => ({
      value: u.id,
      name: `${u.email} — ${u.name}`,
    })),
  });

  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('Utilisateur introuvable');
  return user;
}

async function featureEdit(): Promise<void> {
  console.log('\n── Modifier un utilisateur ──\n');

  const user = await selectUser();

  console.log('\nDonnées actuelles :');
  console.log(`  Email  : ${user.email}`);
  console.log(`  Nom    : ${user.name}`);
  console.log(`  Rôle   : ${ROLE_LABELS[user.role] ?? user.role}`);
  console.log(`  Équipe : ${user.team?.name ?? 'Aucune'}`);

  const fields = await checkbox({
    message: 'Champs à modifier :',
    choices: [
      { value: 'name', name: 'Nom' },
      { value: 'email', name: 'Email' },
      { value: 'role', name: 'Rôle' },
      { value: 'team', name: 'Équipe' },
    ],
  });

  if (fields.length === 0) {
    console.log('Aucun champ sélectionné.');
    return;
  }

  const updates: { name?: string; email?: string; role?: string; teamId?: string | null } = {};

  if (fields.includes('name')) {
    const newName = await input({
      message: 'Nouveau nom :',
      default: user.name,
      validate: (v) => (v.trim() ? true : 'Le nom ne peut pas être vide'),
    });
    updates.name = newName.trim();
  }

  if (fields.includes('email')) {
    const newEmail = await input({
      message: 'Nouvel email :',
      default: user.email,
      validate: async (v) => {
        if (!EMAIL_REGEX.test(v.trim())) return 'Email invalide';
        const existing = await db.user.findUnique({ where: { email: v.trim() } });
        if (existing && existing.id !== user.id) return 'Cet email est déjà utilisé';
        return true;
      },
    });
    updates.email = newEmail.trim();
  }

  if (fields.includes('role')) {
    updates.role = await select({
      message: 'Nouveau rôle :',
      choices: ROLE_OPTIONS.map((r) => ({ ...r })),
    });
  }

  if (fields.includes('team')) {
    const teams = await db.team.findMany({ orderBy: { name: 'asc' } });
    const choices = teams.map((t) => ({ value: t.id, name: t.name }));
    choices.push({ value: '', name: 'Aucune équipe' });

    updates.teamId = await select({
      message: 'Nouvelle équipe :',
      choices,
      default: user.teamId ?? '',
    }) || null;
  }

  console.log('\n┌─── Modifications ─────────────────────────');
  if (updates.name) console.log(`│ Nom   : ${user.name} → ${updates.name}`);
  if (updates.email) console.log(`│ Email : ${user.email} → ${updates.email}`);
  if (updates.role) console.log(`│ Rôle  : ${ROLE_LABELS[user.role] ?? user.role} → ${ROLE_LABELS[updates.role] ?? updates.role}`);
  if (updates.teamId !== undefined) {
    const teams = await db.team.findMany();
    const newTeam = teams.find((t) => t.id === updates.teamId);
    console.log(`│ Équipe: ${user.team?.name ?? 'Aucune'} → ${newTeam?.name ?? 'Aucune'}`);
  }
  console.log('└───────────────────────────────────────────');

  const ok = await confirm({ message: 'Appliquer les modifications ?', default: true });
  if (!ok) {
    console.log('Modification annulée.');
    return;
  }

  await db.user.update({ where: { id: user.id }, data: updates as Record<string, unknown> });
  console.log(`\n✅ Utilisateur ${user.email} mis à jour.`);
}

// ── Feature 4: Réinitialiser le mot de passe ────────────────────────────────

async function featureResetPassword(): Promise<void> {
  console.log('\n── Réinitialiser le mot de passe ──\n');

  const user = await selectUser();

  console.log(`\nUtilisateur : ${user.email} (${user.name})`);

  const pwd = await password({
    message: 'Nouveau mot de passe :',
    validate: (v) => (v.length >= 8 ? true : 'Minimum 8 caractères'),
  });

  await password({
    message: 'Confirmer le mot de passe :',
    validate: (v) => (v === pwd ? true : 'Les mots de passe ne correspondent pas'),
  });

  const ok = await confirm({ message: 'Réinitialiser le mot de passe ?', default: true });
  if (!ok) {
    console.log('Opération annulée.');
    return;
  }

  const passwordHash = await bcrypt.hash(pwd, SALT_ROUNDS);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`\n✅ Mot de passe réinitialisé pour ${user.email}.`);
}

// ── Feature 5: Supprimer un utilisateur ─────────────────────────────────────

async function featureDelete(): Promise<void> {
  console.log('\n── Supprimer un utilisateur ──\n');

  const user = await selectUser();

  console.log(`\nUtilisateur : ${user.email} (${user.name})`);
  console.log(`Rôle       : ${ROLE_LABELS[user.role] ?? user.role}`);
  console.log(`Équipe     : ${user.team?.name ?? 'Aucune'}`);

  const apps = await db.application.findMany({ where: { ownerId: user.id } });
  if (apps.length > 0) {
    console.log(`\n⚠️  Cet utilisateur possède ${apps.length} application(s) :`);
    for (const app of apps) {
      console.log(`   - ${app.name} (${app.status})`);
    }

    const action = await select({
      message: 'Que faire avec ces applications ?',
      choices: [
        { value: 'abort', name: 'Annuler la suppression' },
        { value: 'reassign', name: 'Réaffecter la propriété puis supprimer' },
      ],
    });

    if (action === 'abort') {
      console.log('Suppression annulée.');
      return;
    }

    if (action === 'reassign') {
      const otherUsers = await db.user.findMany({
        where: { id: { not: user.id } },
        orderBy: { email: 'asc' },
      });

      if (otherUsers.length === 0) {
        console.log('Aucun autre utilisateur disponible. Suppression annulée.');
        return;
      }

      const newOwnerId = await select({
        message: 'Nouveau propriétaire :',
        choices: otherUsers.map((u) => ({ value: u.id, name: `${u.email} — ${u.name}` })),
      });

      for (const app of apps) {
        await db.application.update({
          where: { id: app.id },
          data: { ownerId: newOwnerId },
        });
      }
      console.log(`${apps.length} application(s) réaffectée(s).`);
    }
  }

  console.log('\n⚠️  Cette action est irréversible !');

  const sure = await confirm({ message: 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?', default: false });
  if (!sure) {
    console.log('Suppression annulée.');
    return;
  }

  const confirmText = await input({
    message: 'Tapez "SUPPRIMER" pour confirmer :',
    validate: (v) => (v === 'SUPPRIMER' ? true : 'Tapez SUPPRIMER pour confirmer'),
  });

  if (confirmText !== 'SUPPRIMER') {
    console.log('Suppression annulée.');
    return;
  }

  await db.user.delete({ where: { id: user.id } });
  console.log(`\n✅ Utilisateur ${user.email} supprimé.`);
}

// ── Main loop ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.on('SIGINT', () => {
    console.log('\n\nAu revoir !');
    process.exit(0);
  });

  while (true) {
    clearScreen();
    printHeader();

    const choice = await select({
      message: 'Choisir une action :',
      choices: [
        { value: '1', name: 'Créer un utilisateur' },
        { value: '2', name: 'Lister les utilisateurs' },
        { value: '3', name: 'Modifier un utilisateur' },
        { value: '4', name: 'Réinitialiser le mot de passe' },
        { value: '5', name: 'Supprimer un utilisateur' },
        { value: '6', name: 'Quitter' },
      ],
    });

    try {
      switch (choice) {
        case '1':
          await featureCreate();
          break;
        case '2':
          await featureList();
          break;
        case '3':
          await featureEdit();
          break;
        case '4':
          await featureResetPassword();
          break;
        case '5':
          await featureDelete();
          break;
        case '6':
          console.log('\nAu revoir !');
          process.exit(0);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        console.log('\nAu revoir !');
        process.exit(0);
      }
      console.error('\n❌ Erreur :', err instanceof Error ? err.message : err);
    }

    await pause();
  }
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
