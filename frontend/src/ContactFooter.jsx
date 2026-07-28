import React from 'react'
import Icon from './components/Icon'

const heading = {
  fontSize: '19px', fontWeight: 700, color: '#D0FD3E', marginBottom: '16px',
  display: 'flex', alignItems: 'center', gap: '10px',
}
const linkRow = { color: '#fafafa', fontSize: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }

export default function ContactFooter() {
  return (
    <div style={{
      background: 'rgba(20,20,23,0.55)',
      backdropFilter: 'blur(20px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '48px 32px',
      marginTop: '48px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px', marginBottom: '32px' }}>
          {/* Contact Us */}
          <div>
            <h3 className="font-display" style={heading}><Icon name="mail" size={20} /> Contact Us</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <span className="neu-badge" style={{ width: 38, height: 38, flexShrink: 0 }}><Icon name="mail" size={17} color="#D0FD3E" /></span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '2px' }}>Email</div>
                  <a href="mailto:rishavt413@gmail.com" style={{ color: '#fafafa', fontSize: '15px', textDecoration: 'none', fontWeight: 500 }}>rishavt413@gmail.com</a>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <span className="neu-badge" style={{ width: 38, height: 38, flexShrink: 0 }}><Icon name="call" size={17} color="#D0FD3E" /></span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '2px' }}>Phone</div>
                  <a href="tel:+916205628505" style={{ color: '#fafafa', fontSize: '15px', textDecoration: 'none', fontWeight: 500 }}>+91 6205628505</a>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <span className="neu-badge" style={{ width: 38, height: 38, flexShrink: 0 }}><Icon name="pin" size={17} color="#D0FD3E" /></span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '2px' }}>Address</div>
                  <div style={{ color: '#fafafa', fontSize: '15px', lineHeight: '1.5' }}>Hostel 12, BIT Mesra<br />Ranchi, Jharkhand</div>
                </div>
              </div>
            </div>
          </div>

          {/* Help & Support */}
          <div>
            <h3 className="font-display" style={heading}><Icon name="chat" size={20} /> Need Help?</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              Have questions or need assistance? Our team is here to help you with:
            </p>
            <ul style={{ color: '#fafafa', fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px', marginBottom: '16px' }}>
              <li>Technical support &amp; troubleshooting</li>
              <li>Equipment booking issues</li>
              <li>Diet tracking questions</li>
              <li>Account &amp; membership queries</li>
              <li>Feature requests &amp; feedback</li>
            </ul>
            <div className="neu-tile" style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="mail" size={15} color="#D0FD3E" /> Email us at: <a href="mailto:rishavt413@gmail.com" style={{ color: '#D0FD3E', textDecoration: 'none' }}>rishavt413@gmail.com</a>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="call" size={15} color="#D0FD3E" /> Call us at: <a href="tel:+916205628505" style={{ color: '#D0FD3E', textDecoration: 'none' }}>+91 6205628505</a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display" style={heading}><Icon name="link" size={20} /> Quick Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="#" style={linkRow}><Icon name="book" size={16} color="#D0FD3E" /> Documentation</a>
              <a href="#" style={linkRow}><Icon name="help" size={16} color="#D0FD3E" /> FAQ</a>
              <a href="#" style={linkRow}><Icon name="activity" size={16} color="#D0FD3E" /> Tutorials</a>
              <a href="#" style={linkRow}><Icon name="lock" size={16} color="#D0FD3E" /> Privacy Policy</a>
              <a href="#" style={linkRow}><Icon name="doc" size={16} color="#D0FD3E" /> Terms of Service</a>
            </div>
            <div className="neu-tile" style={{ marginTop: '20px', padding: '14px', borderRadius: '12px' }}>
              <div style={{ color: '#D0FD3E', fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="bolt" size={15} color="#D0FD3E" /> Quick Response
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>We typically respond within 24 hours</div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            © 2025 Fitness Buddy. Built with <Icon name="heart" size={14} color="#f87171" /> for fitness enthusiasts.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            Empowering your fitness journey, one workout at a time <Icon name="dumbbell" size={13} color="#D0FD3E" />
          </p>
        </div>
      </div>
    </div>
  )
}
