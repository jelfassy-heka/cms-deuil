import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import PartnerDashboard from './pages/partner/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/partner/*" element={<PartnerDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App