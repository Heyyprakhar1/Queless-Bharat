import type React from 'react'

interface ChakraWatermarkProps {
  className?: string
  size?: number | string
}

/**
 * Ashoka Chakra Geometric Civic Watermark
 *
 * Understated vector artwork modeled on the 24-spoke Ashoka Chakra.
 * Designed to sit as a decorative, very low-opacity watermark in
 * background areas of the civic application frame.
 *
 * Uses currentColor with static geometry, respecting prefers-reduced-motion
 * and maintaining full accessibility and contrast for foreground text.
 */
export const ChakraWatermark: React.FC<ChakraWatermarkProps> = ({
  className = 'w-72 h-72 text-blue-950/[0.035] dark:text-blue-300/[0.025]',
  size,
}) => {
  // 24 spokes radiating from inner hub (r=11) to outer rim (r=43)
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24
    const rad = (angle * Math.PI) / 180
    const x1 = 50 + 11 * Math.sin(rad)
    const y1 = 50 - 11 * Math.cos(rad)
    const x2 = 50 + 43 * Math.sin(rad)
    const y2 = 50 - 43 * Math.cos(rad)
    return (
      <line
        key={`spoke-${i}`}
        x1={x1.toFixed(2)}
        y1={y1.toFixed(2)}
        x2={x2.toFixed(2)}
        y2={y2.toFixed(2)}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    )
  })

  // 24 outer perimeter dots/arches between spokes
  const dots = Array.from({ length: 24 }, (_, i) => {
    const angle = ((i + 0.5) * 360) / 24
    const rad = (angle * Math.PI) / 180
    const cx = 50 + 45 * Math.sin(rad)
    const cy = 50 - 45 * Math.cos(rad)
    return (
      <circle
        key={`dot-${i}`}
        cx={cx.toFixed(2)}
        cy={cy.toFixed(2)}
        r="1"
        fill="currentColor"
      />
    )
  })

  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block pointer-events-none select-none shrink-0 ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
      role="presentation"
    >
      {/* Outer dual rim */}
      <circle cx="50" cy="50" r="47.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="0.8" />

      {/* 24 perimeter dots */}
      <g>{dots}</g>

      {/* 24 radiating spokes */}
      <g>{spokes}</g>

      {/* Inner hub structure */}
      <circle cx="50" cy="50" r="11" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="6" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="2.5" fill="currentColor" />
    </svg>
  )
}

export default ChakraWatermark
