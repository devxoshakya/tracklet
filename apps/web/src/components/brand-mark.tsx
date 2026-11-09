import { cn } from "@tracklet /ui/lib/utils";

/**
 * Tracklet brand mark — the rounded-triangle logo (from logo.svg).
 * Fill is `currentColor`, so the mark recolors with the theme
 * (`text-foreground` → ink on light canvas, light on dark canvas).
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 448 421"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      aria-hidden="true"
    >
      <path
        d="M1369 3955 c-187 -38 -371 -176 -504 -379 -29 -45 -148 -247 -265 -451 -117 -203 -238 -415 -270 -470 -133 -227 -172 -344 -172 -520 0 -133 24 -246 83 -384 49 -115 60 -135 306 -561 341 -588 360 -617 470 -722 78 -74 167 -130 262 -167 149 -57 137 -56 906 -56 l710 0 88 23 c162 43 273 106 382 216 85 86 135 164 413 646 328 570 389 701 418 895 34 224 7 305 -250 752 -509 886 -494 863 -606 973 -85 84 -183 144 -305 187 l-80 28 -760 2 c-602 1 -774 -1 -826 -12z"
        transform="translate(0,421) scale(0.1,-0.1)"
        fill="currentColor"
      />
    </svg>
  );
}
