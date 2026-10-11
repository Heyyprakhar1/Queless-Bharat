import type React from 'react'

interface IndianFlagProps {
  className?: string
  width?: number
  height?: number
}

/**
 * Indian National Flag (Tricolour / Tiranga)
 * Precise SVG vector asset: Saffron (#FF9933), White (#FFFFFF), Green (#138808),
 * and navy Ashoka Chakra (#000080) with 24 radiating spokes.
 */
export const IndianFlag: React.FC<IndianFlagProps> = ({
  className = 'w-6 h-4',
  width,
  height,
}) => {
  // Generate 24 spokes for the Ashoka Chakra
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24
    const rad = (angle * Math.PI) / 180
    const x2 = 45 + 8.5 * Math.sin(rad)
    const y2 = 30 - 8.5 * Math.cos(rad)
    return (
      <line
        key={i}
        x1="45"
        y1="30"
        x2={x2.toFixed(2)}
        y2={y2.toFixed(2)}
        stroke="#000080"
        strokeWidth="0.75"
      />
    )
  })

  return (
    <svg
      viewBox="0 0 90 60"
      className={`inline-block shrink-0 rounded-xs overflow-hidden ${className}`}
      width={width}
      height={height}
      aria-label="Flag of India"
      role="img"
    >
      {/* Saffron band */}
      <rect width="90" height="20" fill="#FF9933" />
      {/* White band */}
      <rect y="20" width="90" height="20" fill="#FFFFFF" />
      {/* India Green band */}
      <rect y="40" width="90" height="20" fill="#138808" />

      {/* Ashoka Chakra in center */}
      <g>
        {/* Outer Ring */}
        <circle cx="45" cy="30" r="9" fill="none" stroke="#000080" strokeWidth="1.2" />
        {/* Inner Hub */}
        <circle cx="45" cy="30" r="2" fill="#000080" />
        {/* 24 Spokes */}
        {spokes}
      </g>
    </svg>
  )
}

export default IndianFlag
