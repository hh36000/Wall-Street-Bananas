import React from 'react'

export interface SidebarItem {
  id: string
  label: string
  href?: string
  icon?: React.ReactNode
  onClick?: () => void
  active?: boolean
  hasSubmenu?: boolean
  submenuItems?: SidebarItem[]
  disabled?: boolean
}

export interface SidebarSection {
  title?: string
  items: SidebarItem[]
}
