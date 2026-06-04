import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUsers } from '@/hooks/useUsers';
import { useTeams } from '@/hooks/useTeams';
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
  { id: 'deploy_success', label: 'Déploiements réussis', description: 'Notifications pour les déploiements terminés avec succès' },
  { id: 'deploy_failure', label: 'Échecs de déploiement', description: 'Alertes immédiates en cas d\'échec de déploiement' },
  { id: 'approval_pending', label: 'Approbations en attente', description: 'Rappels pour les approbations de déploiement en attente' },
  { id: 'policy_violation', label: 'Violations de politique', description: 'Notifications lors de violations de politique de sécurité' },
];

// TODO: connect to API when ApiKey model is implemented
const demoKeys = [
  { id: '1', name: 'Production', key: 'kpl_2a8f...b3d1', created: '2025-12-15', lastUsed: '2026-05-28' },
  { id: '2', name: 'Staging', key: 'kpl_7c3e...f9a2', created: '2026-01-20', lastUsed: '2026-05-29' },
  { id: '3', name: 'CI/CD', key: 'kpl_4b1d...e7c8', created: '2026-03-10', lastUsed: '2026-05-27' },
];

export default function Settings() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const [notifications, setNotifications] = useState<string[]>(['deploy_failure', 'policy_violation']);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Réglages</h2>
        <p className="text-muted-foreground">Configurez vos préférences et paramètres de la plateforme.</p>
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
          (() => {
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
                  <Input id="team" value={teams?.find(t => t.id === user?.teamId)?.name ?? user?.teamId ?? ''} readOnly className="bg-muted/50" />
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
            {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
            Apparence
          </CardTitle>
          <CardDescription>Personnalisez l'affichage de l'interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Thème sombre</p>
              <p className="text-xs text-muted-foreground">Basculer entre le mode sombre et clair</p>
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
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Français</span>
              <Badge variant="outline" className="text-xs">Disponible</Badge>
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
                checked={notifications.includes(opt.id)}
                onCheckedChange={() => toggleNotification(opt.id)}
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
      <Badge variant="outline" className="text-xs">Demo</Badge>
    </CardTitle>
          <CardDescription>Gérez vos clés d'API pour l'intégration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Générer une clé
          </Button>
          <div className="space-y-2">
            {demoKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{k.name}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground font-mono">
                      {showKeys[k.id] ? k.key : k.key.slice(0, 4) + '••••••••••••'}
                    </code>
                    <span className="text-xs text-muted-foreground">· créée le {k.created}</span>
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
                    onClick={() => handleCopyKey(k.id, k.key)}
                  >
                    {copiedKey === k.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
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
            <Button variant="outline" size="sm" disabled className="border-destructive/30 text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
