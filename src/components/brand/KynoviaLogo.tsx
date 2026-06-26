import { useId } from 'react'

type KynoviaLogoProps = {
  className?: string
  title?: string
  decorative?: boolean
}

export function KynoviaMark({
  className = 'h-10 w-10',
  title = 'Kynovia',
  decorative = false,
}: KynoviaLogoProps) {
  const id = useId()
  const bgId = `${id}-bg`
  const lineId = `${id}-line`
  const shadowId = `${id}-shadow`

  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bgId} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="0.52" stopColor="#3B4FE8" />
          <stop offset="1" stopColor="#1E2A78" />
        </linearGradient>
        <linearGradient id={lineId} x1="15" y1="13" x2="34" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D8E6FF" />
        </linearGradient>
        <filter id={shadowId} x="3" y="3" width="42" height="42" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.26" />
        </filter>
      </defs>
      <path
        d="M24 4.5 40.9 14.25v19.5L24 43.5 7.1 33.75v-19.5L24 4.5Z"
        fill={`url(#${bgId})`}
        filter={`url(#${shadowId})`}
      />
      <path
        d="M24 8.75 37.2 16.38v15.24L24 39.25l-13.2-7.63V16.38L24 8.75Z"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.18"
      />
      <path
        d="M17 14.75v18.5M31.5 15.5 19.25 24l12.25 8.5M19.75 24h13.5"
        fill="none"
        stroke={`url(#${lineId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33.25" cy="24" r="2.45" fill="#F59E0B" />
    </svg>
  )
}

export function KynoviaWordmark({
  className = 'h-8 w-32',
  title = 'Kynovia',
}: KynoviaLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 168 42"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <KynoviaMark className="h-[42px] w-[42px]" decorative />
      <text
        x="52"
        y="27"
        fill="#F4F4F5"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="22"
        fontWeight="800"
        letterSpacing="0"
      >
        Kynov
      </text>
      <text
        x="120"
        y="27"
        fill="#3B82F6"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="22"
        fontWeight="800"
        letterSpacing="0"
      >
        ia
      </text>
      <path d="M52 34.5h87" stroke="#3B82F6" strokeOpacity="0.26" strokeLinecap="round" />
    </svg>
  )
}
