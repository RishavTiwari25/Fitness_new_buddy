/**
 * =============================================
 * MAIN APPLICATION COMPONENT (App.jsx)
 * =============================================
 * Root component that handles:
 * - Authentication state management
 * - Routing between login/signup and dashboard
 * - Token persistence using localStorage
 * - Landing page with feature showcase
 */

// ===== IMPORTS =====
import React, { useState } from 'react' // React hooks for state management
import Login from './Login' // Login form component
import Signup from './Signup' // Signup form component
import Dashboard from './Dashboard' // Main dashboard component (after login)
import ContactFooter from './ContactFooter' // Footer with contact info
import Logo from './components/Logo' // Logo component
import Icon from './components/Icon' // Vector SVG icon set
import { APP_NAME } from './branding' // App name from branding config

/**
 * Main App Component
 * Manages the overall application flow and authentication state
 */
export default function App() {
  // ===== STATE MANAGEMENT =====
  // Current view to display: 'login' or 'signup'
  const [view, setView] = useState('login');
  
  // JWT token for authentication - retrieved from localStorage on initial load
  // If token exists, user is logged in and Dashboard is shown
  const [token, setToken] = useState(localStorage.getItem('token'));

  // ===== HANDLE LOGIN =====
  // Called when user successfully logs in
  function handleLogin(t) {
    localStorage.setItem('token', t); // Persist token to localStorage for future sessions
    setToken(t); // Update state to trigger re-render and show Dashboard
  }

  // ===== HANDLE LOGOUT =====
  // Called when user clicks logout
  function handleLogout() {
    localStorage.removeItem('token'); // Remove token from localStorage
    setToken(null); // Clear token state
    setView('login'); // Show login form
  }

  // ===== CONDITIONAL RENDERING =====
  // If user has a token, show the Dashboard
  // Otherwise, show the landing page with login/signup forms
  if (token) return <Dashboard token={token} onLogout={handleLogout} />

  // ===== LANDING PAGE LAYOUT =====
  return (
    <div style={{ 
      minHeight: '100vh',  // Full screen height
      backgroundColor: '#1F1E1D', // Dark background
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ===== HERO SECTION ===== */}
      {/* Two-column layout: Left side has marketing copy, right side has auth form */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr', // 50-50 split
        gap: '48px',
        padding: '48px',
        alignItems: 'center',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* ===== LEFT SIDE: HERO CONTENT ===== */}
        <div style={{ padding: '40px 0' }}>
          <div style={{ marginBottom: '24px' }}>
            {/* Main headline */}
            <h1 className="font-display" style={{
              fontSize: '60px',
              fontWeight: '600',
              color: '#F5F4EE',
              marginBottom: '16px',
              lineHeight: '1.08'
            }}>
              Your fitness journey<br />
              <span style={{ color: '#D97757', fontStyle: 'italic' }}>starts here.</span>
            </h1>
            {/* Subheading with feature description */}
            <p style={{ 
              fontSize: '20px', 
              color: '#A6A29A',
              lineHeight: '1.6',
              marginBottom: '32px'
            }}>
              Track workouts, manage gym bookings, analyze your diet with AI, 
              and stay motivated with streaks and rewards.
            </p>
          </div>

          {/* ===== FEATURE CARDS GRID ===== */}
          {/* 2x2 grid of feature highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '40px' }}>
            {/* Feature 1: Track Progress */}
            <div style={{
              padding: '20px',
              backgroundColor: '#262624',
              borderRadius: '16px',
              border: '1px solid #3A3937'
            }}>
              <div style={{ color: '#F5F4EE', fontWeight: '600', marginBottom: '4px' }}>Track Progress</div>
              <div style={{ color: '#A6A29A', fontSize: '13px' }}>Monitor your gym streaks and achievements</div>
            </div>
            
            {/* Feature 2: Book Equipment */}
            <div style={{
              padding: '20px',
              backgroundColor: '#262624',
              borderRadius: '16px',
              border: '1px solid #3A3937'
            }}>
              <div style={{ color: '#F5F4EE', fontWeight: '600', marginBottom: '4px' }}>Book Equipment</div>
              <div style={{ color: '#A6A29A', fontSize: '13px' }}>Reserve gym equipment by time slots</div>
            </div>
            
            {/* Feature 3: AI Diet Analysis */}
            <div style={{
              padding: '20px',
              backgroundColor: '#262624',
              borderRadius: '16px',
              border: '1px solid #3A3937'
            }}>
              <div style={{ color: '#F5F4EE', fontWeight: '600', marginBottom: '4px' }}>AI Diet Analysis</div>
              <div style={{ color: '#A6A29A', fontSize: '13px' }}>Scan meals and get instant nutrition info</div>
            </div>
            
            {/* Feature 4: Earn Rewards */}
            <div style={{
              padding: '20px',
              backgroundColor: '#262624',
              borderRadius: '16px',
              border: '1px solid #3A3937'
            }}>
              <div style={{ color: '#F5F4EE', fontWeight: '600', marginBottom: '4px' }}>Earn Rewards</div>
              <div style={{ color: '#A6A29A', fontSize: '13px' }}>Get points and redeem gym perks</div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDE: AUTHENTICATION FORM ===== */}
        <div style={{
          backgroundColor: '#262624',
          borderRadius: '24px',
          padding: '48px',
          border: '1px solid #3A3937',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Auth form header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <Logo size={36} withText={false} /> {/* App logo */}
            </div>
            <h2 className="font-display" style={{ fontSize: '32px', fontWeight: '600', color: '#F5F4EE', marginBottom: '8px' }}>
              {APP_NAME} {/* App name from branding */}
            </h2>
            <p style={{ color: '#A6A29A', fontSize: '14px' }}>Join thousands achieving their fitness goals</p>
          </div>

          {/* ===== LOGIN/SIGNUP TOGGLE BUTTONS ===== */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            {/* Login button */}
            <button 
              onClick={() => setView('login')}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: view === 'login' ? '#D97757' : '#3A3937', // Highlight if active
                color: view === 'login' ? '#FFFFFF' : '#A6A29A',
                transition: 'all 0.3s ease'
              }}
            >
              Login
            </button>
            
            {/* Signup button */}
            <button 
              onClick={() => setView('signup')}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: view === 'signup' ? '#D97757' : '#3A3937', // Highlight if active
                color: view === 'signup' ? '#FFFFFF' : '#A6A29A',
                transition: 'all 0.3s ease'
              }}
            >
              Signup
            </button>
          </div>

          {/* ===== RENDER LOGIN OR SIGNUP FORM ===== */}
          {/* Conditionally render Login or Signup component based on current view */}
          {view === 'login' ? <Login onLogin={handleLogin} /> : <Signup onSignup={handleLogin} />}
        </div>
      </div>

      {/* ===== ABOUT SECTION ===== */}
      {/* Features showcase and footer */}
      <div style={{
        backgroundColor: '#262624',
        borderTop: '1px solid #3A3937',
        padding: '64px 48px'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 className="font-display" style={{ fontSize: '36px', fontWeight: '600', color: '#F5F4EE', marginBottom: '16px' }}>
              Why choose {APP_NAME}?
            </h2>
            <p style={{ fontSize: '18px', color: '#A6A29A', maxWidth: '600px', margin: '0 auto' }}>
              Everything you need to transform your fitness journey, all in one place
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px',
            marginBottom: '48px'
          }}>
            {/* Feature 1 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'var(--neu-base)',
                boxShadow: 'var(--neu-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <Icon name="phone" size={34} color="#D97757" strokeWidth={1.8} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F5F4EE', marginBottom: '12px' }}>
                Smart Gym Management
              </h3>
              <p style={{ color: '#A6A29A', fontSize: '14px', lineHeight: '1.6' }}>
                Check real-time gym occupancy, book equipment slots, and scan QR codes for seamless check-ins. 
                Never wait for equipment again!
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'var(--neu-base)',
                boxShadow: 'var(--neu-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <Icon name="robot" size={34} color="#D97757" strokeWidth={1.8} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F5F4EE', marginBottom: '12px' }}>
                AI-Powered Nutrition
              </h3>
              <p style={{ color: '#A6A29A', fontSize: '14px', lineHeight: '1.6' }}>
                Snap a photo of your meal and get instant calorie breakdown with macros. 
                Track your diet effortlessly with Google Gemini AI.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'var(--neu-base)',
                boxShadow: 'var(--neu-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <Icon name="activity" size={34} color="#D97757" strokeWidth={1.8} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#F5F4EE', marginBottom: '12px' }}>
                Stay Motivated
              </h3>
              <p style={{ color: '#A6A29A', fontSize: '14px', lineHeight: '1.6' }}>
                Build streaks, earn reward points, compete on social feeds, and get personalized home workouts. 
                Your fitness companion 24/7.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            paddingTop: '32px',
            borderTop: '1px solid #3A3937'
          }}>
            <p style={{ color: '#A6A29A', fontSize: '14px' }}>
              © 2025 {APP_NAME}. Built for gym owners, trainers, and fitness enthusiasts.
            </p>
          </div>

          {/* Contact & Help Section - Below everything */}
          <ContactFooter />
        </div>
      </div>
    </div>
  )
}
