import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0a0a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.25rem', color: '#888', marginTop: '0.5rem' }}>Page not found</p>
      <Link to="/" style={{ marginTop: '1.5rem', color: '#6366f1', textDecoration: 'none' }}>
        Go home
      </Link>
    </div>
  )
}

export default NotFound
