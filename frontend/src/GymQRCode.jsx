import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function GymQRCode({ gymId }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const payload = `GYM:${gymId}`
    QRCode.toDataURL(payload, { width: 240 }).then(setUrl)
  }, [gymId])
  if (!gymId) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div>QR for Gym #{gymId}</div>
      {url && <img src={url} alt={`QR for gym ${gymId}`} />}
      <div style={{ fontSize: 12, color: '#555' }}>Scan to check-in/check-out</div>
    </div>
  )
}
