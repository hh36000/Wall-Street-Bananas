import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '@/components/Layout'
import { getSidebarSections } from '@/config/sidebar'

function Home() {
  const [count, setCount] = useState(0)
  const location = useLocation()
  const sidebarSections = getSidebarSections(location.pathname)

  return (
    <Layout
      sidebarProps={{
        sections: sidebarSections
      }}
      navbarProps={{
        user: {
          name: 'User',
          avatar: 'https://github.com/shadcn.png'
        },
        searchPlaceholder: 'Search...'
      }}
    >
      <div className="py-8 px-4 max-w-7xl mx-auto" style={{ backgroundColor: 'transparent', fontFamily: 'var(--font-sans)' }}>
        <header className="mb-16">
          <h1 className="text-4xl font-semibold text-foreground mb-2">
            Data Visualization
          </h1>
          <p className="text-muted-foreground">
            Professional charts
          </p>
        </header>

        <div className="mx-auto">
          <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-heading font-semibold text-card-foreground mb-4">
              Welcome to the New Frontend
            </h2>
            <p className="text-muted-foreground mb-4">
              This is a fresh start with modern tech stack:
            </p>
            <ul className="list-disc list-inside text-foreground space-y-2">
              <li>⚡ Vite for fast development</li>
              <li>🎨 Tailwind CSS for styling</li>
              <li>📘 TypeScript for type safety</li>
              <li>⚛️ React 18 with hooks</li>
            </ul>
          </div>

          <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-heading font-semibold text-card-foreground mb-4">
              Test Counter
            </h3>
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => setCount(count - 1)}
                className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors"
              >
                -
              </button>
              <span className="text-2xl font-mono font-semibold text-card-foreground">
                {count}
              </span>
              <button
                onClick={() => setCount(count + 1)}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Home
