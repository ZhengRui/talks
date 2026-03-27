const S = "currentColor";
const W = 1.2;

export function RowLayoutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
      <rect x="1.5" y="5.5" width="4.5" height="9" rx="1" />
      <rect x="7.75" y="5.5" width="4.5" height="9" rx="1" />
      <rect x="14" y="5.5" width="4.5" height="9" rx="1" />
    </svg>
  );
}

export function ColLayoutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
      <rect x="3.5" y="1.5" width="13" height="4.5" rx="1" />
      <rect x="3.5" y="7.75" width="13" height="4.5" rx="1" />
      <rect x="3.5" y="14" width="13" height="4.5" rx="1" />
    </svg>
  );
}

export function Grid2x2Icon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
      <rect x="11.5" y="1.5" width="7" height="7" rx="1" />
      <rect x="1.5" y="11.5" width="7" height="7" rx="1" />
      <rect x="11.5" y="11.5" width="7" height="7" rx="1" />
    </svg>
  );
}

export function Grid3x3Icon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.75" />
      <rect x="7.75" y="1.5" width="4.5" height="4.5" rx="0.75" />
      <rect x="14" y="1.5" width="4.5" height="4.5" rx="0.75" />
      <rect x="1.5" y="7.75" width="4.5" height="4.5" rx="0.75" />
      <rect x="7.75" y="7.75" width="4.5" height="4.5" rx="0.75" />
      <rect x="14" y="7.75" width="4.5" height="4.5" rx="0.75" />
      <rect x="1.5" y="14" width="4.5" height="4.5" rx="0.75" />
      <rect x="7.75" y="14" width="4.5" height="4.5" rx="0.75" />
      <rect x="14" y="14" width="4.5" height="4.5" rx="0.75" />
    </svg>
  );
}

export function CustomGridIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={W}>
      <rect x="1.5" y="1.5" width="3" height="3" rx="0.5" />
      <rect x="6.25" y="1.5" width="3" height="3" rx="0.5" />
      <rect x="11" y="1.5" width="3" height="3" rx="0.5" />
      <rect x="15.5" y="1.5" width="3" height="3" rx="0.5" />
      <rect x="1.5" y="6.25" width="3" height="3" rx="0.5" />
      <rect x="6.25" y="6.25" width="3" height="3" rx="0.5" />
      <rect x="11" y="6.25" width="3" height="3" rx="0.5" />
      <rect x="15.5" y="6.25" width="3" height="3" rx="0.5" />
      <rect x="1.5" y="11" width="3" height="3" rx="0.5" />
      <rect x="6.25" y="11" width="3" height="3" rx="0.5" />
      <rect x="11" y="11" width="3" height="3" rx="0.5" />
      <rect x="15.5" y="11" width="3" height="3" rx="0.5" />
      <rect x="1.5" y="15.5" width="3" height="3" rx="0.5" />
      <rect x="6.25" y="15.5" width="3" height="3" rx="0.5" />
      <rect x="11" y="15.5" width="3" height="3" rx="0.5" />
      <rect x="15.5" y="15.5" width="3" height="3" rx="0.5" />
    </svg>
  );
}

export function ZoomToFitIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

export function CloseIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20 20 4M4 4l16 16" />
    </svg>
  );
}

export function CodeBracketsIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

export function TextFrameDebugIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
      <rect x="2" y="2" width="16" height="16" rx="2" strokeDasharray="2 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.25 6h7.5M10 6v8" />
    </svg>
  );
}
