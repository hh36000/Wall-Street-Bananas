import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.tsx'
import API from './pages/API.tsx'
import NotFound from './pages/NotFound.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/api" element={<API />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App
