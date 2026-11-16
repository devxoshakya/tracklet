import type { ReactNode } from "react";

/**
 * Segmented control on a soft muted track (Linear/Notion pattern): the active
 * segment is the elevated card step, inactive segments are quiet text. Used
 * for the month stepper pills, view toggle, filter pills, presets and chart
 * granularity — everywhere a group of mutually exclusive options fits.
 */
export type SegmentOption = {
  value: string;
  label: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
};

export default function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 ${className ?? ""}`}
    >
      {options.map(({ value: option, label, icon: Icon }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`focus-ring flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] transition-[background-color,color,box-shadow] duration-150 ${
              active
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
