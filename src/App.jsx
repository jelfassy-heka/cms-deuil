import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'

// Code-splitting route-based : les espaces admin et partenaire forment des
// bundles distincts pour réduire le JS embarqué côté login et accélérer
// le premier rendu de l'autre espace si l'utilisateur n'y va pas.
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const PartnerDashboard = lazy(() => import('./pages/partner/Dashboard'))

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f4f5f7' }}>
      <p className="text-sm" style={{ color: '#8a93a2' }}>Chargement…</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/partner/*" element={<PartnerDashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
