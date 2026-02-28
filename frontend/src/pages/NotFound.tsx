import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <div className="text-center">
        <h1 className="text-6xl font-extrabold text-gray-800 dark:text-white">404</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Page not found</p>
        <p className="mt-2 text-gray-500 dark:text-gray-400">The page you’re looking for doesn’t exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound

