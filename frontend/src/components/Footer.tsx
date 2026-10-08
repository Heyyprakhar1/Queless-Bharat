import type React from 'react'

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-6">
      <div className="max-w-6xl mx-auto px-6 text-center text-xs text-slate-400 space-y-1">
        <div>QueueLess Bharat &mdash; M6.1 India Demo Coverage</div>
        <div className="text-[11px] text-slate-400">
          Showcase Cities: Pune, Mumbai, Bengaluru, Chennai, Kolkata, Delhi, Lucknow, Patna &bull; Pure Deterministic Queue Engine
        </div>
      </div>
    </footer>
  )
}
