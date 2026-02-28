import React from 'react'

interface ContentAreaProps {
  children: React.ReactNode
  className?: string
  containerClassName?: string
  padding?: string
  scrollable?: boolean
  maxHeight?: string
}

function ContentArea({ 
  children, 
  className = "",
  containerClassName = "",
  padding = "p-4 lg:p-6",
  scrollable = true,
  maxHeight
}: ContentAreaProps) {
  const scrollClasses = scrollable ? "overflow-y-scroll rb-scroll-thin" : ""
  const heightClass = maxHeight ? `max-h-[${maxHeight}]` : ""
  const defaultContainerClasses = "min-h-full min-w-full mx-auto px-6 2xl:px-0"
  
  return (
    <main className={`flex-1 ${scrollClasses} ${heightClass} ${className}`} style={{ backgroundColor: 'var(--content-bg)' }}>
      <div className={`${padding} ${containerClassName || defaultContainerClasses}`}>
        {children}
      </div>
    </main>
  )
}

export default ContentArea
