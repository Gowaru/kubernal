import { useState, useEffect, type JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Github, ArrowRight, Eye, EyeOff } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const expired = searchParams.get('expired') === 'true';
  const oidcError = searchParams.get('error');

  useEffect(() => {
    if (expired) {
      toast.error('Session expirée', {
        description: 'Veuillez vous reconnecter.',
        duration: 5000,
      });
      setSearchParams({}, { replace: true });
    }
  }, [expired, setSearchParams]);

  useEffect(() => {
    if (oidcError) {
      toast.error("Erreur d'authentification", {
        description: decodeURIComponent(oidcError),
        duration: 5000,
      });
      setSearchParams({}, { replace: true });
    }
  }, [oidcError, setSearchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    setEmailError('');
    toast.dismiss();

    if (!EMAIL_REGEX.test(email)) {
      setEmailError('Adresse email invalide');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de la connexion';
      toast.error(message, {
        description: 'Vérifiez vos identifiants et réessayez.',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-panel-dark">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
              radial-gradient(ellipse 80% 60% at 20% 50%, color-mix(in oklch, var(--accent) 40%, transparent), transparent),
              radial-gradient(ellipse 60% 50% at 80% 30%, color-mix(in oklch, var(--accent) 20%, transparent), transparent),
              radial-gradient(ellipse 50% 40% at 50% 80%, color-mix(in oklch, var(--status-info) 15%, transparent), transparent)
            `,
            }}
          />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(var(--panel-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--panel-foreground) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-12 animate-[fade-in-up_0.6s_ease-out]">
          <img
            src="/other-logo-kubernal.png"
            alt="Kubernal"
            className="mb-8 h-20 w-20 rounded-2xl border border-panel-foreground/10 bg-panel-foreground/5 p-3 backdrop-blur-sm object-contain"
          />

          <h1 className="text-4xl font-bold tracking-tight text-panel-foreground">Kubernal</h1>
          <p className="mt-3 max-w-sm text-base text-panel-foreground/50 leading-relaxed">
            Infrastructure Development Platform — Déployez, pilotez et observez vos applications
            Kubernetes.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-8 text-sm text-panel-foreground/40">
            <div className="flex flex-col items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-status-success" />
              <span>Sécurisé</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span>GitOps</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-status-info" />
              <span>Kubernetes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center bg-background px-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8 animate-[fade-in-up_0.5s_ease-out_0.1s_both]">
          {/* Mobile logo */}
          <div className="flex flex-col items-center text-center lg:hidden">
            <img
              src="/other-logo-kubernal.png"
              alt="Kubernal"
              className="mb-4 h-14 w-14 rounded-xl border border-border bg-card p-2 object-contain"
            />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Connexion</h2>
            <p className="text-sm text-muted-foreground">
              Entrez vos identifiants pour accéder à votre espace.
            </p>
          </div>

          {/* GitHub SSO */}
          <Button variant="outline" className="h-11 w-full text-sm font-medium" asChild>
            <a href="/api/auth/oidc/github">
              <Github className="h-4 w-4" />
              Continuer avec GitHub
            </a>
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground tracking-widest">ou</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                }}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={!!emailError}
                disabled={isLoading}
                className="h-11 bg-card border-border/60 transition-colors focus:border-accent focus:ring-accent/20"
              />
              {emailError && (
                <p id="email-error" className="text-xs text-destructive mt-1">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-11 bg-card border-border/60 pr-10 transition-colors focus:border-accent focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="remember-me"
                  className="cursor-pointer font-normal text-sm text-muted-foreground"
                >
                  Se souvenir de moi
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-sm font-medium bg-accent hover:bg-accent/90 text-accent-foreground shadow-md shadow-accent/20 transition-all hover:shadow-lg hover:shadow-accent/30"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 pt-2">
            Kubernal IDP &mdash; Plateforme de gestion de déploiements
          </p>
        </div>
      </div>
    </div>
  );
}
