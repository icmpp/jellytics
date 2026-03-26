"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface JellyticsLogoProps {
  size?: number;
  className?: string;
}

export function JellyticsLogo({ size = 32, className }: JellyticsLogoProps) {
  const uid = useId().replace(/:/g, "");
  const bgId    = `${uid}-bg`;
  const shineId = `${uid}-shine`;
  const areaId  = `${uid}-area`;

  return (
    <div
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Background: vivid violet top-left → deep purple bottom-right */}
          <linearGradient id={bgId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#9333ea" />
            <stop offset="55%"  stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>

          {/* Top-face shine */}
          <linearGradient id={shineId} x1="20" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="white" stopOpacity="0.22" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Area fill under sparkline */}
          <linearGradient id={areaId} x1="20" y1="9" x2="20" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="white" stopOpacity="0.18" />
            <stop offset="100%" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* ── Background ── */}
        <rect width="40" height="40" rx="10" fill={`url(#${bgId})`} />

        {/* ── Top shine ── */}
        <rect width="40" height="21" rx="10" fill={`url(#${shineId})`} />

        {/* ── Outer rim ── */}
        <rect x="0.5" y="0.5" width="39" height="39" rx="9.5"
              stroke="white" strokeOpacity="0.16" />

        {/* ── Bars — bottom-aligned to y=31, three clear steps ── */}
        {/* Bar 1 · short */}
        <rect x="7.5" y="23" width="6.5" height="8" rx="2" fill="white" fillOpacity="0.40" />
        {/* Bar 2 · tallest — anchor / hero bar */}
        <rect x="16.75" y="10" width="6.5" height="21" rx="2" fill="white" fillOpacity="1" />
        {/* Bar 3 · medium */}
        <rect x="26"  y="16" width="6.5" height="15" rx="2" fill="white" fillOpacity="0.70" />

        {/* ── Area fill under trend ── */}
        <path
          d="M 10.75,23 L 20,10 L 29.25,16 L 29.25,31 L 10.75,31 Z"
          fill={`url(#${areaId})`}
        />

        {/* ── Trend line ── */}
        <path
          d="M 10.75,23 L 20,10 L 29.25,16"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.9"
        />

        {/* ── Trend dots ── */}
        <circle cx="10.75" cy="23" r="2.5" fill="white" fillOpacity="0.65" />
        <circle cx="20"    cy="10" r="2.5" fill="white" />
        <circle cx="29.25" cy="16" r="2.5" fill="white" fillOpacity="0.85" />
      </svg>
    </div>
  );
}
