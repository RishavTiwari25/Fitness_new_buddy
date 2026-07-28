import React from 'react'

/**
 * Icon — code-native vector SVG icons (framewright: render visuals in code, not
 * stock/emoji). Line style, stroke = currentColor so they inherit text colour.
 * 24x24 grid, round caps/joins. vectorEffect keeps strokes crisp under scale.
 */
const PATHS = {
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  diet: <><path d="M12 21c-3.3 0-5-2.7-5-6.5C7 11.5 9 9.2 11.3 9.2c.7 0 1.3.25 2.7.25s2-.25 2.7-.25C19 9.2 21 11.5 21 14.5 21 18.3 19 21 15.7 21" transform="translate(-2 0)" /><path d="M12 8c0-2 1.5-3.5 3.5-3.5" /></>,
  feed: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3.5" y1="6" x2="3.51" y2="6" /><line x1="3.5" y1="12" x2="3.51" y2="12" /><line x1="3.5" y1="18" x2="3.51" y2="18" /></>,
  gift: <><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" rx="1" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
  trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.6V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22" /><path d="M14 14.6V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 4.8" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
  box: <><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><polyline points="3.3 7 12 12 20.7 7" /><line x1="12" y1="22" x2="12" y2="12" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  card: <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  flame: <><path d="M8.5 14.5A4 4 0 0 0 12 21a4 4 0 0 0 4-4c0-1.5-.8-2.7-1.5-3.5-.6-.7-1-1.4-1-2.5 0-2-2-3.5-2-3.5S8 9.2 8 12c0 1-.3 1.8-.8 2.5" /><path d="M12 3s3 2.5 3 5.5" opacity="0" /></>,
  dumbbell: <><path d="M6.5 6.5 17.5 17.5" opacity="0" /><rect x="1.5" y="9" width="3.5" height="6" rx="1" /><rect x="19" y="9" width="3.5" height="6" rx="1" /><rect x="5" y="10.25" width="2.5" height="3.5" rx="1" /><rect x="16.5" y="10.25" width="2.5" height="3.5" rx="1" /><line x1="7.5" y1="12" x2="16.5" y2="12" /></>,
  robot: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" /><circle cx="9" cy="13" r="1.2" /><circle cx="15" cy="13" r="1.2" /><path d="M9 17h6" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><line x1="10.5" y1="18.5" x2="13.5" y2="18.5" /></>,
}

export default function Icon({ name, size = 20, strokeWidth = 1.9, color = 'currentColor', style }) {
  const glyph = PATHS[name]
  if (!glyph) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    >
      {glyph}
    </svg>
  )
}
