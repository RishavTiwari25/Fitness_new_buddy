import React from 'react'
import { LOGO_URL, APP_NAME } from '../branding'

export default function Logo({ size = 28, withText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img
        src={LOGO_URL}
        alt={APP_NAME}
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: '8px' }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      {withText && (
        <span style={{ color: '#fafafa', fontSize: size * 0.8, fontWeight: 800 }}>
          {APP_NAME}
        </span>
      )}
    </div>
  )
}
