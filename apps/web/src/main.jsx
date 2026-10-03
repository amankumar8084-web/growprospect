import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

if (!PUBLISHABLE_KEY) {
  createRoot(document.getElementById('root')).render(
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#e53e3e' }}>Missing Clerk Publishable Key</h1>
      <p>You need to add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your <code>.env</code> file.</p>
      <p>Get it from the <a href="https://dashboard.clerk.com" style={{ color: '#3182ce' }}>Clerk Dashboard</a>.</p>
    </div>
  );
} else {
  createRoot(document.getElementById('root')).render(
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  );

}
