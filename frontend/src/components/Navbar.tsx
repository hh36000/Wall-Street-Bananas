import React, { useRef, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Moon, Sun, Search, ChevronDown, Bell, User, Menu, X } from 'lucide-react'

interface NavbarProps {
  user?: {
    name: string
    avatar?: string
    initials?: string
  }
  actions?: React.ReactNode
  className?: string
  isMobile?: boolean
  onMenuToggle?: () => void
  isMenuOpen?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  searchPlaceholder?: string
}

function Navbar({ 
  user, 
  actions,
  className = "",
  isMobile = false,
  onMenuToggle,
  isMenuOpen = false,
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  searchPlaceholder = "Search for anything"
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Handle Cmd+K (or Ctrl+K on Windows/Linux) to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      // Use lowercase comparison to handle both 'k' and 'K'
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        
        if (searchInputRef.current) {
          searchInputRef.current.focus()
          // Use setTimeout to ensure focus happens before selection
          setTimeout(() => {
            searchInputRef.current?.select()
          }, 0)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  
  return (
    <nav className={`h-16 w-full flex items-center justify-center px-6 shadow-sm bg-transparent-navbar select-none ${className}`}>
      <div className="flex items-center justify-between w-full max-w-4xl">
        {/* Mobile Menu Button */}
        {isMobile && (
          <button
            onClick={onMenuToggle}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 transition-colors lg:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        )}

        {/* Search Bar */}
        <div className={`flex-1 relative ${isMobile ? 'mx-4' : 'mr-8'}`}>
          <div className="relative">
            <label htmlFor="search-input" className="sr-only">
              Search the application
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#70707d]" aria-hidden="true" />
            <input
              ref={searchInputRef}
              id="search-input"
              type="search"
              placeholder={searchPlaceholder}
              aria-label="Search the application"
              aria-describedby="search-shortcut"
              className="w-full pl-10 pr-20 py-2 bg-transparent border border-border rounded-lg text-sm text-[#70707d] placeholder-[#a0a0a8] placeholder:select-none select-none focus:outline-none focus:border-[#70707d] focus:ring-2 focus:ring-[#70707d]/20"
              autoComplete="off"
              spellCheck="false"
              {...(onSearchChange 
                ? {
                    value: searchValue !== undefined ? searchValue : '',
                    onChange: (e) => onSearchChange(e.target.value)
                  }
                : {
                    defaultValue: searchValue !== undefined ? searchValue : ''
                  }
              )}
              onKeyDown={onSearchKeyDown}
            />
            <div id="search-shortcut" className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1" aria-hidden="true">
              <kbd className="px-1.5 py-0.5 text-sm bg-background border border-border rounded text-muted-foreground">⌘</kbd>
              <kbd className="px-1.5 py-0.5 text-sm bg-background border border-border rounded text-muted-foreground">K</kbd>
            </div>
          </div>
        </div>

        {/* Move Money Button - Hidden on mobile */}
        <button 
          className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-transparent text-primary border border-primary rounded-lg hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 mr-8"
          aria-label="Move money - Transfer funds between accounts"
          aria-expanded="false"
          aria-haspopup="menu"
          type="button"
        >
          <span className="text-sm font-medium">Go</span>
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Utility Icons */}
        <div className="flex items-center space-x-2">
          {/* Notifications - Hidden on mobile */}
          <button className="hidden lg:flex relative items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
          </button>

          {/* User Profile */}
          <button className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            {user?.initials ? (
              <span className="text-sm font-medium">{user.initials}</span>
            ) : (
              <User className="w-4 h-4" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Sun className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
