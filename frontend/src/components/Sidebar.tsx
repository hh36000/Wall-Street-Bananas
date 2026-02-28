import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SidebarItem, SidebarSection } from '@/types/sidebar'
import { ChevronDown } from 'lucide-react'

interface SidebarProps {
  title?: string
  sections?: SidebarSection[]
  footer?: React.ReactNode
  className?: string
  width?: string
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

function Sidebar({ 
  title,
  sections = [],
  footer,
  className = "",
  width = "w-64",
  isMobile = false,
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const sidebarSections = sections.length > 0 ? sections : []

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const renderSidebarItem = (item: SidebarItem) => {
    const handleClick = (e: React.MouseEvent) => {
      if (item.disabled) {
        e.preventDefault()
        return
      }
      if (item.hasSubmenu) {
        e.preventDefault()
        toggleExpanded(item.id)
      }
      item.onClick?.()
      // Close mobile menu when item is clicked
      if (isMobile && onClose) {
        onClose()
      }
    }

    const baseClasses = `w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
      item.disabled
        ? 'text-foreground/40 cursor-not-allowed opacity-50'
        : item.active 
          ? 'text-foreground font-semibold bg-muted' 
          : 'text-foreground font-normal hover:text-foreground hover:bg-muted/50'
    }`

    return (
      <li key={item.id}>
        {item.href ? (
          item.disabled ? (
            <span
              className={baseClasses}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center">
                <span className="text-foreground/40">{item.icon}</span>
                {!isCollapsed && <span className="ml-3">{item.label}</span>}
              </div>
              {!isCollapsed && item.hasSubmenu && (
                <ChevronDown 
                  className={`w-4 h-4 text-foreground/40 transition-transform ${
                    expandedItems.has(item.id) ? 'rotate-180' : ''
                  }`} 
                />
              )}
            </span>
          ) : (
            <Link
              to={item.href}
              onClick={handleClick}
              className={baseClasses}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center">
                <span className="text-foreground/80">{item.icon}</span>
                {!isCollapsed && <span className="ml-3">{item.label}</span>}
              </div>
              {!isCollapsed && item.hasSubmenu && (
                <ChevronDown 
                  className={`w-4 h-4 text-foreground/80 transition-transform ${
                    expandedItems.has(item.id) ? 'rotate-180' : ''
                  }`} 
                />
              )}
            </Link>
          )
        ) : (
          <button
            onClick={handleClick}
            disabled={item.disabled}
            className={baseClasses}
            title={isCollapsed ? item.label : undefined}
          >
            <div className="flex items-center">
              <span className={item.disabled ? "text-foreground/40" : "text-foreground/80"}>{item.icon}</span>
              {!isCollapsed && <span className="ml-3">{item.label}</span>}
            </div>
            {!isCollapsed && item.hasSubmenu && (
              <ChevronDown 
                className={`w-4 h-4 ${item.disabled ? 'text-foreground/40' : 'text-foreground/80'} transition-transform ${
                  expandedItems.has(item.id) ? 'rotate-180' : ''
                }`} 
              />
            )}
          </button>
        )}
      </li>
    )
  }

  return (
    <aside 
      className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out ${
              isOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:relative lg:translate-x-0 lg:w-64` 
          : isCollapsed ? 'w-16' : width
        } 
        flex flex-col border-r select-none ${className}
      `} 
      style={{ backgroundColor: 'var(--sidebar-navbar)', borderColor: 'var(--border-soft)' }}
    >
      {/* Title/Branding Section */}
      <div className="h-16 flex items-center border-b relative px-6" style={{ borderColor: 'var(--border-soft)' }}>
        <button 
          onClick={onToggleCollapse}
          className="cursor-pointer flex items-center justify-start hover:opacity-80 transition-opacity"
        >
          {isCollapsed ? (
            <div className="flex items-center leading-none">
              <span className="text-2xl font-normal tracking-tight select-none" style={{ fontFamily: '"Outfit", sans-serif' }}>
                <span className="text-[#6366f1] dark:text-[#667799]">[c]</span>
              </span>
            </div>
          ) : (
            <h1 className="text-3xl tracking-tight select-none" style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 400 }}>
              <span className="text-[#6366f1] dark:text-[#667799]">[cord]</span>
            </h1>
          )}
        </button>
      </div>
      
      <nav className="flex-1 px-3 pt-2 pb-4 space-y-8 overflow-y-auto">
        {sidebarSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {!isCollapsed && section.title && (
              <div className="px-3 my-3">
                <h3 className="text-xs text-foreground/90 uppercase tracking-tightest">
                  {section.title}
                </h3>
              </div>
            )}
            <ul className="space-y-1">
              {section.items.map(renderSidebarItem)}
            </ul>
          </div>
        ))}
      </nav>
      
      {!isCollapsed && footer && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          {footer}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
