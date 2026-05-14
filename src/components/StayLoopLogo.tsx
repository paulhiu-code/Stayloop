type StayLoopLogoProps = {
  className?: string;
  variant?: 'dark' | 'light';
  showTagline?: boolean;
};

export default function StayLoopLogo({
  className = '',
  variant = 'dark',
  showTagline = false,
}: StayLoopLogoProps) {
  const textColor = variant === 'light' ? '#ffffff' : '#16393d';
  const taglineColor = variant === 'light' ? '#cbd5e1' : '#64748b';

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <svg
        viewBox="0 0 330 82"
        role="img"
        aria-label="StayLoop"
        className="h-auto w-full overflow-visible"
      >
        <defs>
          <linearGradient id="stayloop-infinity-gradient" x1="105" x2="225" y1="0" y2="82">
            <stop offset="0%" stopColor="#e64f87" />
            <stop offset="52%" stopColor="#ff8a5b" />
            <stop offset="100%" stopColor="#ffbd68" />
          </linearGradient>
        </defs>

        <text
          x="0"
          y="58"
          fill={textColor}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="62"
          fontWeight="800"
          letterSpacing="-4.5"
        >
          Stayl
        </text>

        <path
          d="M199 42C187 25 172 20 160 25C148 30 143 43 149 54C155 65 169 66 182 54L201 36C213 25 228 25 237 35C246 46 241 62 227 66C215 70 204 62 194 48L185 36C175 22 162 16 149 20C131 25 123 46 132 62C141 78 164 80 184 62L207 40C217 31 226 30 232 37C238 45 234 57 224 60C214 63 207 56 199 42Z"
          fill="none"
          stroke="url(#stayloop-infinity-gradient)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text
          x="241"
          y="58"
          fill={textColor}
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="62"
          fontWeight="800"
          letterSpacing="-4.5"
        >
          p
        </text>
      </svg>

      {showTagline && (
        <span
          className="mt-[-0.35rem] text-[0.68rem] font-semibold leading-none"
          style={{ color: taglineColor }}
        >
          Find stays that fit your trip
        </span>
      )}
    </div>
  );
}
