import React, { useState } from 'react'
import Login from './Login'
import Signup from './Signup'
import Dashboard from './Dashboard'
import ContactFooter from './ContactFooter'

export default function App() {
  const [view, setView] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('token'));

  function handleLogin(t) {
    localStorage.setItem('token', t);
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setView('login');
  }

  if (token) return <Dashboard token={token} onLogout={handleLogout} />

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#18181b',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Hero Section with Login/Signup */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '48px',
        padding: '48px',
        alignItems: 'center',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Left Side - Hero Content */}
        <div style={{ padding: '40px 0' }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ 
              fontSize: '56px', 
              fontWeight: '800', 
              color: '#fafafa',
              marginBottom: '16px',
              lineHeight: '1.1'
            }}>
              Your Fitness Journey<br />
              <span style={{ color: '#D0FD3E' }}>Starts Here</span> 💪
            </h1>
            <p style={{ 
              fontSize: '20px', 
              color: '#a1a1aa',
              lineHeight: '1.6',
              marginBottom: '32px'
            }}>
              Track workouts, manage gym bookings, analyze your diet with AI, 
              and stay motivated with streaks and rewards.
            </p>
          </div>

          {/* Feature Icons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '40px' }}>
            <div style={{
              padding: '20px',
              backgroundColor: '#27272a',
              borderRadius: '16px',
              border: '1px solid #3f3f46'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
              <div style={{ color: '#fafafa', fontWeight: '600', marginBottom: '4px' }}>Track Progress</div>
              <div style={{ color: '#a1a1aa', fontSize: '13px' }}>Monitor your gym streaks and achievements</div>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: '#27272a',
              borderRadius: '16px',
              border: '1px solid #3f3f46'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
              <div style={{ color: '#fafafa', fontWeight: '600', marginBottom: '4px' }}>Book Equipment</div>
              <div style={{ color: '#a1a1aa', fontSize: '13px' }}>Reserve gym equipment by time slots</div>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: '#27272a',
              borderRadius: '16px',
              border: '1px solid #3f3f46'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍎</div>
              <div style={{ color: '#fafafa', fontWeight: '600', marginBottom: '4px' }}>AI Diet Analysis</div>
              <div style={{ color: '#a1a1aa', fontSize: '13px' }}>Scan meals and get instant nutrition info</div>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: '#27272a',
              borderRadius: '16px',
              border: '1px solid #3f3f46'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
              <div style={{ color: '#fafafa', fontWeight: '600', marginBottom: '4px' }}>Earn Rewards</div>
              <div style={{ color: '#a1a1aa', fontSize: '13px' }}>Get points and redeem gym perks</div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div style={{
          backgroundColor: '#27272a',
          borderRadius: '24px',
          padding: '48px',
          border: '1px solid #3f3f46',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '700', color: '#fafafa', marginBottom: '8px' }}>
              Fitness Buddy
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Join thousands achieving their fitness goals</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
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
                backgroundColor: view === 'login' ? '#D0FD3E' : '#3f3f46',
                color: view === 'login' ? '#000' : '#a1a1aa',
                transition: 'all 0.3s ease'
              }}
            >
              Login
            </button>
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
                backgroundColor: view === 'signup' ? '#D0FD3E' : '#3f3f46',
                color: view === 'signup' ? '#000' : '#a1a1aa',
                transition: 'all 0.3s ease'
              }}
            >
              Signup
            </button>
          </div>

          {view === 'login' ? <Login onLogin={handleLogin} /> : <Signup onSignup={handleLogin} />}
        </div>
      </div>

      {/* About Section */}
      <div style={{
        backgroundColor: '#27272a',
        borderTop: '1px solid #3f3f46',
        padding: '64px 48px'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: '700', color: '#fafafa', marginBottom: '16px' }}>
              Why Choose Fitness Buddy?
            </h2>
            <p style={{ fontSize: '18px', color: '#a1a1aa', maxWidth: '600px', margin: '0 auto' }}>
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
                backgroundColor: '#3f3f46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '40px'
              }}>
                📱
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', marginBottom: '12px' }}>
                Smart Gym Management
              </h3>
              <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
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
                backgroundColor: '#3f3f46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '40px'
              }}>
                🤖
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', marginBottom: '12px' }}>
                AI-Powered Nutrition
              </h3>
              <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
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
                backgroundColor: '#3f3f46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '40px'
              }}>
                🔥
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', marginBottom: '12px' }}>
                Stay Motivated
              </h3>
              <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                Build streaks, earn reward points, compete on social feeds, and get personalized home workouts. 
                Your fitness companion 24/7.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            paddingTop: '32px',
            borderTop: '1px solid #3f3f46'
          }}>
            <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
              © 2025 Fitness Buddy. Built for gym owners, trainers, and fitness enthusiasts.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', justifyContent: 'center' }}>
              <a href="#" style={{ color: '#D0FD3E', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>Features</a>
              <a href="#" style={{ color: '#D0FD3E', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>Pricing</a>
              <a href="#" style={{ color: '#D0FD3E', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>Support</a>
            </div>
          </div>

          {/* Contact & Help Section - Below everything */}
          <ContactFooter />
        </div>
      </div>
    </div>
  )
}
