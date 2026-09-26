import { SignIn, UserButton, useAuth } from '@clerk/react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import LocationSelector from './components/LocationSelector'
import ImportPage from './pages/ImportPage'
import LeadsPage from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function SignedIn({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? children : null;
}

function SignedOut({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return !isSignedIn ? children : null;
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'white', borderBottom: '1px solid #eaeaea' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px' }}>Lead Discovery</div>
          <SignedIn>
            <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Link to="/" style={{ textDecoration: 'none', color: '#333' }}>Dashboard</Link>
              <Link to="/import" style={{ textDecoration: 'none', color: '#333' }}>Import</Link>
              <Link to="/leads" style={{ textDecoration: 'none', color: '#333' }}>Leads</Link>
              <UserButton />
            </nav>
          </SignedIn>
        </header>
        
        <main style={{ padding: '40px' }}>
          <SignedOut>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1>Multi-Source Lead Discovery</h1>
              <p>Please sign in to access the application.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <SignIn routing="hash" />
            </div>
          </SignedOut>
          
          <SignedIn>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/leads/:id" element={<LeadDetailPage />} />
            </Routes>
          </SignedIn>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
