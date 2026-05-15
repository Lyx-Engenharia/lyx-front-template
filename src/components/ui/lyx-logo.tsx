import * as React from "react"
import { cn } from "@/lib/utils"

interface LyxLogoProps {
  className?: string
  size?: number
}

export function LyxLogo({ className, size = 48 }: LyxLogoProps) {
  return (
    <svg
      viewBox="0 0 120 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn("text-current", className)}
      aria-label="Lyx"
    >
      <path
        d="M 22 96 L 7 96 L 7 50 L 60 10 L 113 50 L 113 96 L 98 96"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="60"
        y="96"
        textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontSize="26"
        fontWeight="900"
        fill="currentColor"
        letterSpacing="3"
      >
        LYX
      </text>
    </svg>
  )
}
