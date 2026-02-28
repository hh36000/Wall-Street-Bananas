import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '@/components/Layout'
import { getSidebarSections } from '@/config/sidebar'
import { checkHealth, type HealthResponse } from '@/services/api'

function API() {
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  const sidebarSections = getSidebarSections(location.pathname)

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setHealthStatus(null)
      const response = await checkHealth()
      setHealthStatus(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status')
      setHealthStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

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
            API Status
          </h1>
          <p className="text-muted-foreground">
            Backend health check
          </p>
        </header>

        <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6">
          {loading && (
            <p className="text-muted-foreground mb-4">Loading...</p>
          )}
          {!loading && error && (
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <p className="text-destructive">
                  <span className="font-semibold">Not Healthy</span> - {error}
                </p>
              </div>
            </div>
          )}
          {!loading && !error && healthStatus && (
            <div className="mb-4">
              {healthStatus.status === 'healthy' ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <p className="text-foreground">
                    Status: <span className="font-semibold text-green-600 dark:text-green-400">Healthy</span>
                  </p>
                </div>
              ) : (
                <p className="text-foreground">
                  Status: <span className="font-semibold">{healthStatus.status}</span>
                </p>
              )}
            </div>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking...' : 'Check Again'}
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default API

