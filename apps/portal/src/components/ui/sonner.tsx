import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/hooks/use-theme';

export function Toaster() {
  const { isDark } = useTheme();

  return (
    <SonnerToaster
      theme={isDark ? 'dark' : 'light'}
      richColors
      closeButton
      position="top-right"
      visibleToasts={5}
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
