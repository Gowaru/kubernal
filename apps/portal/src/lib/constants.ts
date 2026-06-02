export const NAV_SECTIONS = [
  {
    label: 'Général',
    items: [
      { label: 'Dashboard', href: '/', icon: 'LayoutDashboard', shortcut: '⌘1', badge: undefined },
    ],
  },
  {
    label: 'Applications',
    items: [
      { label: 'Catalogue', href: '/catalogue', icon: 'LayoutGrid', shortcut: '⌘2', badge: undefined },
      { label: 'Déploiements', href: '/deployments', icon: 'Rocket', shortcut: '⌘3', badge: 'pending' as const },
      { label: 'Observabilité', href: '/observability', icon: 'Eye', shortcut: '⌘4', badge: undefined },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { label: 'Environnements', href: '/environments', icon: 'Cloud', shortcut: '⌘5', badge: undefined },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Équipes', href: '/teams', icon: 'Users', shortcut: '⌘6', badge: undefined },
      { label: 'Templates', href: '/templates', icon: 'FileJson', shortcut: '⌘7', badge: undefined },
      { label: 'Politiques', href: '/policies', icon: 'Shield', shortcut: '⌘8', badge: undefined },
      { label: 'Réglages', href: '/settings', icon: 'Settings', shortcut: '⌘9', badge: undefined },
    ],
  },
] as const;

export const PLATFORM_VERSION = 'v0.1.0';
