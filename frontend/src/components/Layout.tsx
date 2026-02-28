import React, { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import ContentArea from '@/components/ContentArea'

interface LayoutProps {
  children: React.ReactNode
  navbarProps?: {
    user?: {
      name: string
      avatar?: string
    }
    actions?: React.ReactNode
    className?: string
    searchValue?: string
    onSearchChange?: (value: string) => void
    onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    searchPlaceholder?: string
  }
  sidebarProps?: {
    title?: string
    sections?: Array<{
      title?: string
      items: Array<{
        id: string
        label: string
        href?: string
        icon?: React.ReactNode
        onClick?: () => void
        active?: boolean
        hasSubmenu?: boolean
        submenuItems?: Array<{
          id: string
          label: string
          href?: string
          icon?: React.ReactNode
          onClick?: () => void
          active?: boolean
        }>
      }>
    }>
    footer?: React.ReactNode
    className?: string
    width?: string
    isCollapsed?: boolean
    onToggleCollapse?: () => void
  }
  contentProps?: {
    className?: string
    containerClassName?: string
    padding?: string
    scrollable?: boolean
    maxHeight?: string
  }
  className?: string
}

function Layout({ 
  children, 
  navbarProps = {},
  sidebarProps = {},
  contentProps = {},
  className = ""
}: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const toggleSidebarCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={`h-screen flex ${className}`}>
      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}
      
      {/* Sidebar */}
      <Sidebar 
        {...sidebarProps} 
        isMobile={isMobile}
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        isCollapsed={sidebarProps.isCollapsed !== undefined ? sidebarProps.isCollapsed : isCollapsed}
        onToggleCollapse={sidebarProps.onToggleCollapse || toggleSidebarCollapse}
      />
      
      <div className={`flex flex-col flex-1 overflow-hidden ${isMobile ? 'lg:ml-0' : ''}`}>
        <Navbar 
          {...navbarProps} 
          isMobile={isMobile}
          onMenuToggle={toggleMobileMenu}
          isMenuOpen={isMobileMenuOpen}
        />
        <ContentArea {...contentProps}>
          {children}
        </ContentArea>
      </div>
    </div>
  )
}

export default Layout
