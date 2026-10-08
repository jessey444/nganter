import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import PatientLocation from './pages/PatientLocation'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lokasi/:token" element={<PatientLocation />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
