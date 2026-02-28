const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export interface HealthResponse {
  status: string
}

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error('Failed to connect to backend. Is the server running?')
    }
    throw err
  }
}

