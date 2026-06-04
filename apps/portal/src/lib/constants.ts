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
    label: 'Kubernetes',
    items: [
      { label: 'Pods', href: '/k8s/pods', icon: 'Box', shortcut: '⌘6', badge: undefined },
      { label: 'Services', href: '/k8s/services', icon: 'Network', shortcut: '⌘7', badge: undefined },
      { label: 'Événements', href: '/k8s/events', icon: 'AlertTriangle', shortcut: '⌘8', badge: 'warning' as const },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Équipes', href: '/teams', icon: 'Users', shortcut: '⌘9', badge: undefined },
      { label: 'Templates', href: '/templates', icon: 'FileJson', shortcut: '⌘0', badge: undefined },
      { label: 'Politiques', href: '/policies', icon: 'Shield', shortcut: '⌘⇧P', badge: undefined },
      { label: 'Réglages', href: '/settings', icon: 'Settings', shortcut: '⌘⇧S', badge: undefined },
    ],
  },
] as const;

export const PLATFORM_VERSION = 'v0.1.0';
