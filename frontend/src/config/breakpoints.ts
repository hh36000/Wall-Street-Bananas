/**
 * Breakpoint Configuration
 * 
 * Centralized breakpoint values matching Tailwind CSS defaults and index.css media queries.
 * These breakpoints ensure consistency across all components.
 * 
 * Tailwind Breakpoints:
 * - sm: 640px
 * - md: 768px  
 * - lg: 1024px
 * - xl: 1280px
 * - 2xl: 1536px
 */

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

/**
 * Check if the current viewport width is below a specific breakpoint
 * @param breakpoint - The breakpoint key to check against
 * @returns boolean indicating if viewport is below the breakpoint
 */
export const isBelow = (breakpoint: keyof typeof BREAKPOINTS): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < BREAKPOINTS[breakpoint]
}

/**
 * Check if the current viewport width is at or above a specific breakpoint
 * @param breakpoint - The breakpoint key to check against
 * @returns boolean indicating if viewport is at or above the breakpoint
 */
export const isAbove = (breakpoint: keyof typeof BREAKPOINTS): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= BREAKPOINTS[breakpoint]
}

/**
 * Check if viewport is mobile (below md breakpoint)
 * @returns boolean indicating if viewport is mobile
 */
export const isMobileViewport = (): boolean => isBelow('md')

/**
 * Check if viewport is tablet (between md and lg breakpoints)
 * @returns boolean indicating if viewport is tablet
 */
export const isTabletViewport = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= BREAKPOINTS.md && window.innerWidth < BREAKPOINTS.lg
}

/**
 * Check if viewport is desktop (at or above lg breakpoint)
 * @returns boolean indicating if viewport is desktop
 */
export const isDesktopViewport = (): boolean => isAbove('lg')

