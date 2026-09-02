import { useState, useCallback, useEffect, type JSX } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useTeams } from '@/hooks/useTeams';
import { useApiKeys, useDeleteApiKey } from '@/hooks/useApiKeys';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { GenerateApiKeyModal } from '@/components/settings/GenerateApiKeyModal';
import type { ApiKeyCreated } from '@kubernal/shared-types';
import { cn } from '@/lib/utils';
import {
  Moon,
  Sun,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  User,
  Bell,
  Key,
  AlertTriangle,
  Globe,
} from 'lucide-react';

const notificationOptions = [
  {
    id: 'deploy_success',
    label: 'Déploiements réussis',
    description: 'Notifications pour les déploiements terminés avec succès',
  },
  {
    id: 'deploy_failure',
    label: 'Échecs de déploiement',
    description: "Alertes immédiates en cas d'échec de déploiement",
  },
  {
    id: 'approval_pending',
    label: 'Approbations en attente',
    description: 'Rappels pour les approbations de déploiement en attente',
  },
  {
    id: 'policy_violation',
    label: 'Violations de politique',
    description: 'Notifications lors de violations de politique de sécurité',
  },
];

export default function Settings(): JSX.Element {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [lang, setLang] = useState(() => localStorage.getItem('kubernal-lang') ?? 'fr');
  const { user: currentUser, isLoading: userLoading } = useAuth();
  const { data: users, error: usersError } = useUsers();
  const { data: teams, error: teamsError } = useTeams();
  const { data: apiKeys, error: apiKeysError } = useApiKeys();
  const deleteMutation = useDeleteApiKey();
  const deleteAccountMutation = useDeleteAccount();

  useEffect(() => {
    if (usersError) {
      toast.error('Erreur lors du chargement des données', {
        description: (usersError as Error)?.message || 'Veuillez réessayer',
      });
    }
    if (teamsError) {
      toast.error('Erreur lors du chargement des données', {
        description: (teamsError as Error)?.message || 'Veuillez réessayer',
      });
    }
    if (apiKeysError) {
      toast.error('Erreur lors du chargement des clés API', {
        description: (apiKeysError as Error)?.message || 'Veuillez réessayer',
      });
    }
  }, [usersError, teamsError, apiKeysError]);
  const { data: prefs, isLoading: prefsLoading } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);

  const toggleNotification = useCallback(
    (id: string) => {
      const currentEnabled = prefs?.some((p) => p.type === id && p.enabled) ?? false;
      updatePrefs.mutate([{ type: id, enabled: !currentEnabled }]);
    },
    [prefs, updatePrefs],
  );

  const handleCopyKey = useCallback((keyId: string, keyValue: string) => {
    try {
      navigator.clipboard.writeText(keyValue);
      toast.success('Clé API copiée dans le presse-papiers');
    } catch {
      toast.error('Erreur lors de la copie');
    }
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const toggleKeyVisibility = useCallback((keyId: string) => {
    setShowKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  }, []);

  const handleKeyGenerated = useCallback((_created: ApiKeyCreated) => {
    // Query refetches automatically via invalidateQueries
  }, []);

  const handleDeleteKey = useCallback(
    (keyId: string, keyName: string) => {
      if (!confirm(`Supprimer la clé "${keyName}" ? Cette action est irréversible.`)) return;
      deleteMutation.mutate(keyId, {
        onSuccess: () => {
          toast.success(`Clé "${keyName}" supprimée`);
        },
        onError: (err) => {
          toast.error('Erreur lors de la suppression', {
            description: err.message,
          });
        },
      });
    },
    [deleteMutation],
  );

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Réglages</h2>
        <p className="text-muted-foreground">
          Configurez vos préférences et paramètres de la plateforme.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            Profil
          </CardTitle>
          <CardDescription>Informations de votre compte utilisateur</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            ((): JSX.Element => {
              const user = currentUser ?? users?.[0];
              return (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input id="name" value={user?.name ?? ''} readOnly className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email ?? ''} readOnly className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rôle</Label>
                    <Input id="role" value={user?.role ?? ''} readOnly className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team">Équipe</Label>
                    <Input
                      id="team"
                      value={teams?.find((t) => t.id === user?.teamId)?.name ?? user?.teamId ?? ''}
                      readOnly
                      className="bg-muted/50"
                    />
                  </div>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isDark ? (
              <Moon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Sun className="h-4 w-4 text-muted-foreground" />
            )}
            Apparence
          </CardTitle>
          <CardDescription>Personnalisez l'affichage de l'interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Thème sombre</p>
              <p className="text-xs text-muted-foreground">
                Basculer entre le mode sombre et clair
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isDark ? 'bg-primary' : 'bg-input',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform',
                  isDark ? 'translate-x-5' : 'translate-x-0',
                )}
              >
                {isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Langue</p>
              <p className="text-xs text-muted-foreground">Langue de l'interface utilisateur</p>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setLang('fr');
                  localStorage.setItem('kubernal-lang', 'fr');
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  lang === 'fr'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Globe className="h-3 w-3" />
                FR
              </button>
              <button
                type="button"
                onClick={() => {
                  setLang('en');
                  localStorage.setItem('kubernal-lang', 'en');
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  lang === 'en'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Globe className="h-3 w-3" />
                EN
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notifications
          </CardTitle>
          <CardDescription>Gérez les notifications que vous souhaitez recevoir</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notificationOptions.map((opt) => (
            <label
              key={opt.id}
              className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={prefs?.some((p) => p.type === opt.id && p.enabled) ?? false}
                onCheckedChange={() => toggleNotification(opt.id)}
                disabled={updatePrefs.isPending || prefsLoading}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4 text-muted-foreground" />
            Accès API
            {apiKeysError && (
              <Badge variant="outline" className="text-xs">
                Demo
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Gérez vos clés d'API pour l'intégration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button size="sm" onClick={() => setShowGenerateKeyModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Générer une clé
          </Button>
          <div className="space-y-2">
            {apiKeys?.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{k.name}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground font-mono">
                      {showKeys[k.id] ? `${k.prefix}••••••••••••••••` : `${k.prefix}••••••••••••`}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      · créée le {formatDate(k.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleKeyVisibility(k.id)}
                  >
                    {showKeys[k.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopyKey(k.id, k.prefix)}
                  >
                    {copiedKey === k.id ? (
                      <Check className="h-4 w-4 text-status-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteKey(k.id, k.name)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Zone dangereuse
          </CardTitle>
          <CardDescription>Actions irréversibles — soyez prudent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium text-destructive">Supprimer le compte</p>
              <p className="text-xs text-muted-foreground">
                Supprime définitivement votre compte et toutes les données associées
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={deleteAccountMutation.isPending}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (
                  !confirm(
                    'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
                  )
                )
                  return;
                deleteAccountMutation.mutate(undefined, {
                  onError: (err) => {
                    toast.error('Erreur lors de la suppression du compte', {
                      description: err.message,
                    });
                  },
                });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteAccountMutation.isPending ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <GenerateApiKeyModal
        open={showGenerateKeyModal}
        onOpenChange={setShowGenerateKeyModal}
        onKeyGenerated={handleKeyGenerated}
      />
    </div>
  );
}
