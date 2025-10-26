import React from 'react'

export default function ContactFooter() {
  return (
    <div style={{
      backgroundColor: '#27272a',
      borderTop: '1px solid #3f3f46',
      padding: '48px 32px',
      marginTop: '48px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Contact Us & Help Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '40px',
          marginBottom: '32px'
        }}>
          {/* Contact Us */}
          <div>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: '#D0FD3E', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📧 Contact Us
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <span style={{ fontSize: '18px', minWidth: '24px' }}>✉️</span>
                <div>
                  <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '2px' }}>Email</div>
                  <a 
                    href="mailto:rishavt413@gmail.com"
                    style={{ 
                      color: '#fafafa', 
                      fontSize: '15px',
                      textDecoration: 'none',
                      fontWeight: '500'
                    }}
                  >
                    rishavt413@gmail.com
                  </a>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <span style={{ fontSize: '18px', minWidth: '24px' }}>📞</span>
                <div>
                  <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '2px' }}>Phone</div>
                  <a 
                    href="tel:+916205628505"
                    style={{ 
                      color: '#fafafa', 
                      fontSize: '15px',
                      textDecoration: 'none',
                      fontWeight: '500'
                    }}
                  >
                    +91 6205628505
                  </a>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <span style={{ fontSize: '18px', minWidth: '24px' }}>📍</span>
                <div>
                  <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '2px' }}>Address</div>
                  <div style={{ color: '#fafafa', fontSize: '15px', lineHeight: '1.5' }}>
                    Hostel 12, BIT Mesra<br />
                    Ranchi, Jharkhand
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Help & Support */}
          <div>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: '#D0FD3E', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              💬 Need Help?
            </h3>
            <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              Have questions or need assistance? Our team is here to help you with:
            </p>
            <ul style={{ 
              color: '#fafafa', 
              fontSize: '14px', 
              lineHeight: '1.8',
              paddingLeft: '20px',
              marginBottom: '16px'
            }}>
              <li>Technical support & troubleshooting</li>
              <li>Equipment booking issues</li>
              <li>Diet tracking questions</li>
              <li>Account & membership queries</li>
              <li>Feature requests & feedback</li>
            </ul>
            <div style={{
              backgroundColor: '#3f3f46',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #52525b'
            }}>
              <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '8px' }}>
                📧 Email us at: <a href="mailto:rishavt413@gmail.com" style={{ color: '#D0FD3E', textDecoration: 'none' }}>rishavt413@gmail.com</a>
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '13px' }}>
                📞 Call us at: <a href="tel:+916205628505" style={{ color: '#D0FD3E', textDecoration: 'none' }}>+91 6205628505</a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: '#D0FD3E', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🔗 Quick Links
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="#" style={{ 
                color: '#fafafa', 
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                📚 Documentation
              </a>
              <a href="#" style={{ 
                color: '#fafafa', 
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                ❓ FAQ
              </a>
              <a href="#" style={{ 
                color: '#fafafa', 
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                🎓 Tutorials
              </a>
              <a href="#" style={{ 
                color: '#fafafa', 
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                🔒 Privacy Policy
              </a>
              <a href="#" style={{ 
                color: '#fafafa', 
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}>
                📜 Terms of Service
              </a>
            </div>
            
            {/* Response Time Badge */}
            <div style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: '#065f46',
              borderRadius: '8px',
              border: '1px solid #047857'
            }}>
              <div style={{ color: '#6ee7b7', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                ⚡ Quick Response
              </div>
              <div style={{ color: '#d1fae5', fontSize: '12px' }}>
                We typically respond within 24 hours
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div style={{
          borderTop: '1px solid #3f3f46',
          paddingTop: '24px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '8px' }}>
            © 2025 Fitness Buddy. Built with ❤️ for fitness enthusiasts.
          </p>
          <p style={{ color: '#71717a', fontSize: '12px' }}>
            Empowering your fitness journey, one workout at a time 💪
          </p>
        </div>
      </div>
    </div>
  )
}
