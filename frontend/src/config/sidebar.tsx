import React from 'react'
import { Home as HomeIcon, Settings, TrendingUp, LayoutGrid, Globe, Sparkles, Network } from 'lucide-react'
import type { SidebarSection, SidebarItem } from '@/types/sidebar'

// Icon component mapping
const iconComponents = {
  Home: HomeIcon,
  TrendingUp: TrendingUp,
  Settings: Settings,
  LayoutGrid: LayoutGrid,
  Globe: Globe,
  Sparkles: Sparkles,
  Network: Network,
} as const

type IconName = keyof typeof iconComponents

// Helper to create icon element
const createIcon = (iconName: IconName, className: string = "w-5 h-5"): React.ReactNode => {
  const IconComponent = iconComponents[iconName]
  return <IconComponent className={className} />
}

// Base sidebar item configuration (without icon and active state)
type BaseSidebarItem = Omit<SidebarItem, 'icon' | 'active'> & { iconName: IconName }

// Base sidebar section configuration
type BaseSidebarSection = {
  title?: string
  items: BaseSidebarItem[]
}

// Base sidebar configuration without active states
const baseSidebarConfig: BaseSidebarSection[] = [
  {
    title: 'Main',
    items: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        iconName: 'Home' as IconName,
      },
      {
        id: 'api',
        label: 'API',
        href: '/api',
        iconName: 'Network' as IconName,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        iconName: 'Settings' as IconName,
        disabled: true,
      },
    ],
  },
]

/**
 * Get sidebar sections with active state based on current pathname
 * @param pathname - Current route pathname (e.g., '/', '/charts')
 * @returns SidebarSection[] with appropriate active states
 */
export function getSidebarSections(pathname: string): SidebarSection[] {
  return baseSidebarConfig.map((section) => ({
    ...section,
    items: section.items.map(({ iconName, ...item }) => ({
      ...item,
      icon: createIcon(iconName),
      active: item.href === pathname,
    })),
  }))
}

