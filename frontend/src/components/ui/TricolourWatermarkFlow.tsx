import type React from 'react'

interface TricolourWatermarkFlowProps {
  className?: string
}

/**
 * Flowing Abstract Indian Tricolour Vector Ribbon
 *
 * Generates an understated, low-opacity flowing wave treatment across the
 * background of the civic workspace. Completely static, non-distracting,
 * and zero overhead.
 */
export const TricolourWatermarkFlow: React.FC<TricolourWatermarkFlowProps> = ({
  className = 'w-full h-48',
}) => {
  return (
    <svg
      viewBox="0 0 1440 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Saffron gradient flow */}
        <linearGradient id="saffron-flow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF9933" stopOpacity="0.01" />
          <stop offset="35%" stopColor="#FF9933" stopOpacity="0.045" />
          <stop offset="70%" stopColor="#FF9933" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#FF9933" stopOpacity="0" />
        </linearGradient>

        {/* Ashoka / Neutral white-blue gradient flow */}
        <linearGradient id="neutral-flow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.025" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>

        {/* Green gradient flow */}
        <linearGradient id="green-flow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#138808" stopOpacity="0" />
          <stop offset="40%" stopColor="#138808" stopOpacity="0.02" />
          <stop offset="75%" stopColor="#138808" stopOpacity="0.045" />
          <stop offset="100%" stopColor="#138808" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Saffron flowing curve */}
      <path
        d="M0,40 C320,110 580,10 920,60 C1160,95 1320,30 1440,45 L1440,0 L0,0 Z"
        fill="url(#saffron-flow)"
      />
      <path
        d="M0,40 C320,110 580,10 920,60 C1160,95 1320,30 1440,45"
        stroke="#FF9933"
        strokeWidth="1.2"
        strokeOpacity="0.06"
        fill="none"
      />

      {/* Neutral / Navy flowing ribbon line */}
      <path
        d="M0,75 C280,30 640,120 1020,70 C1240,40 1380,85 1440,90"
        stroke="#000080"
        strokeWidth="0.8"
        strokeOpacity="0.03"
        strokeDasharray="4 4"
        fill="none"
      />

      {/* Green flowing curve */}
      <path
        d="M0,200 C360,150 720,230 1080,180 C1280,150 1390,195 1440,200 L1440,240 L0,240 Z"
        fill="url(#green-flow)"
      />
      <path
        d="M0,200 C360,150 720,230 1080,180 C1280,150 1390,195 1440,200"
        stroke="#138808"
        strokeWidth="1.2"
        strokeOpacity="0.06"
        fill="none"
      />
    </svg>
  )
}

export default TricolourWatermarkFlow
