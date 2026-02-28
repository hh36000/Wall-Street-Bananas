import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { BREAKPOINTS } from '@/config/breakpoints'

interface BreakpointContextValue {
  /**
   * Current viewport width in pixels
   */
  width: number
  
  /**
   * Is viewport below small breakpoint (< 640px)
   */
  isBelowSm: boolean
  
  /**
   * Is viewport below medium breakpoint (< 768px)
   * Commonly used for mobile detection
   */
  isMobile: boolean
  
  /**
   * Is viewport below large breakpoint (< 1024px)
   * Commonly used for tablet detection
   */
  isBelowLg: boolean
  
  /**
   * Is viewport below xl breakpoint (< 1280px)
   */
  isBelowXl: boolean
  
  /**
   * Is viewport below 2xl breakpoint (< 1536px)
   */
  isBelow2xl: boolean
  
  /**
   * Is viewport at or above small breakpoint (>= 640px)
   */
  isSm: boolean
  
  /**
   * Is viewport at or above medium breakpoint (>= 768px)
   * Commonly used for desktop detection
   */
  isDesktop: boolean
  
  /**
   * Is viewport at or above large breakpoint (>= 1024px)
   */
  isLg: boolean
  
  /**
   * Is viewport at or above xl breakpoint (>= 1280px)
   */
  isXl: boolean
  
  /**
   * Is viewport at or above 2xl breakpoint (>= 1536px)
   */
  is2xl: boolean
}

const BreakpointContext = createContext<BreakpointContextValue | undefined>(undefined)

interface BreakpointProviderProps {
  children: ReactNode
}

export function BreakpointProvider({ children }: BreakpointProviderProps) {
  const [width, setWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setWidth(window.innerWidth)
    }

    // Set initial width
    handleResize()

    // Add event listener with debouncing for performance
    let timeoutId: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleResize, 150)
    }

    window.addEventListener('resize', debouncedResize)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedResize)
    }
  }, [])

  const value: BreakpointContextValue = {
    width,
    
    // Below breakpoints
    isBelowSm: width < BREAKPOINTS.sm,
    isMobile: width < BREAKPOINTS.md,
    isBelowLg: width < BREAKPOINTS.lg,
    isBelowXl: width < BREAKPOINTS.xl,
    isBelow2xl: width < BREAKPOINTS['2xl'],
    
    // At or above breakpoints
    isSm: width >= BREAKPOINTS.sm,
    isDesktop: width >= BREAKPOINTS.md,
    isLg: width >= BREAKPOINTS.lg,
    isXl: width >= BREAKPOINTS.xl,
    is2xl: width >= BREAKPOINTS['2xl'],
  }

  return (
    <BreakpointContext.Provider value={value}>
      {children}
    </BreakpointContext.Provider>
  )
}

/**
 * Hook to access breakpoint context
 * @throws Error if used outside BreakpointProvider
 * @returns BreakpointContextValue
 */
export function useBreakpoint(): BreakpointContextValue {
  const context = useContext(BreakpointContext)
  
  if (context === undefined) {
    throw new Error('useBreakpoint must be used within a BreakpointProvider')
  }
  
  return context
}

