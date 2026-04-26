"use client";

/**
 * NYXUS brand mark — black cat silhouette with pointy ears.
 * Pure shadow shape, no facial features (true silhouette).
 */
export function NyxLogo({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#0a0118"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NYXUS"
      role="img"
    >
      {/* Cat head: ears (peaks at y=2), forehead curve, round head body */}
      <path d="M4 8 L5 2 L8 8 Q12 7.2 16 8 L19 2 L20 8 Q22 11 21 14 Q20 18 17 20 Q14 21 12 21 Q10 21 7 20 Q4 18 3 14 Q2 11 4 8 Z" />
    </svg>
  );
}
