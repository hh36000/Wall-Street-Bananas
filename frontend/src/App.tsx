import { Routes, Route } from 'react-router-dom'
import Game from './pages/Game.tsx'
import NotFound from './pages/NotFound.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
