import * as React from "react";

const STYLES = `
.hp-glass-wrap {
  position: relative;
  display: inline-flex;
  cursor: pointer;
  border-radius: 4px;
}

.hp-glass {
  position: relative;
  isolate: isolate;
  width: 100%;
  border-radius: 4px;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  transition: transform 250ms ease-out;
  outline: none;
}

.hp-glass:hover {
  transform: translateY(-2px);
}

.hp-glass:active {
  transform: scale(0.97);
}

.hp-glass:focus-visible {
  outline: 2px solid rgba(212, 175, 55, 0.6);
  outline-offset: 3px;
}

.hp-glass-inner {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--glass-tint) 85%, #000),
    var(--glass-tint)
  );
  border: 1px solid rgba(212, 175, 55, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),
    0 2px 8px rgba(0, 0, 0, 0.28);
  transition: border-color 250ms ease-out, box-shadow 250ms ease-out, background 250ms ease-out;
}

.hp-glass:hover .hp-glass-inner {
  border-color: rgba(212, 175, 55, 0.75);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--glass-tint) 75%, #fff),
    color-mix(in srgb, var(--glass-tint) 90%, #fff)
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),
    0 5px 14px rgba(0, 0, 0, 0.32);
}

.hp-glass-inner:not(.hp-glass-inner--ghost)::after {
  content: "";
  position: absolute;
  top: 0;
  left: 10px;
  right: 10px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  border-radius: 4px;
  pointer-events: none;
}

.hp-glass-inner--ghost {
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--glass-tint) 55%, transparent);
  box-shadow: none;
}

.hp-glass:hover .hp-glass-inner--ghost {
  background: color-mix(in srgb, var(--glass-tint) 10%, transparent);
  border-color: color-mix(in srgb, var(--glass-tint) 75%, transparent);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.hp-glass-text {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  user-select: none;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
}

.hp-glass-inner--ghost .hp-glass-text {
  filter: none;
}

@media (prefers-reduced-motion: reduce) {
  .hp-glass,
  .hp-glass-inner {
    transition: none;
  }
  .hp-glass:hover {
    transform: none;
  }
  .hp-glass:active {
    transform: none;
  }
}
`;

const TINT_MAP = {
  crimson: "#8b1a1a",
  emerald: "#1a4a2e",
  umber:   "#2c1d11",
} as const;

type Tint = keyof typeof TINT_MAP;

const SIZE_PADDING: Record<string, string> = {
  default: "px-10 py-4",
  sm:      "px-4 py-2",
  lg:      "px-12 py-5",
  icon:    "p-3",
};

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  if (document.getElementById("hp-glass-button-styles")) return;
  const el = document.createElement("style");
  el.id = "hp-glass-button-styles";
  el.textContent = STYLES;
  document.head.prepend(el);
}

function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

type Size = "default" | "sm" | "lg" | "icon";

interface BaseProps {
  tint?: Tint;
  size?: Size;
  variant?: "solid" | "ghost";
  contentClassName?: string;
  children?: React.ReactNode;
  className?: string;
}

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type AnchorProps = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & {
    href: string;
  };

export type GlassButtonProps = ButtonProps | AnchorProps;

function isAnchor(props: GlassButtonProps): props is AnchorProps {
  return typeof (props as AnchorProps).href === "string";
}

export const GlassButton = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  GlassButtonProps
>(function GlassButton(props, ref) {
  ensureStyles();

  const {
    tint = "emerald",
    size = "default",
    variant = "solid",
    contentClassName,
    children,
    className,
    ...rest
  } = props;

  const style: React.CSSProperties = {
    "--glass-tint": TINT_MAP[tint],
  } as React.CSSProperties;

  const padding = SIZE_PADDING[size] ?? SIZE_PADDING.default;

  const inner = (
    <div className={cn("hp-glass-inner", variant === "ghost" && "hp-glass-inner--ghost", padding)}>
      <span className={cn("hp-glass-text", contentClassName)}>{children}</span>
    </div>
  );

  if (isAnchor(props)) {
    const { href, target, rel, onClick, ...anchorRest } = rest as Omit<AnchorProps, keyof BaseProps>;
    return (
      <div className={cn("hp-glass-wrap", className)} style={style}>
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target={target}
          rel={rel}
          onClick={onClick}
          className="hp-glass"
          {...(anchorRest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {inner}
        </a>
      </div>
    );
  }

  const { onClick, disabled, type, ...buttonRest } = rest as Omit<ButtonProps, keyof BaseProps>;
  return (
    <div className={cn("hp-glass-wrap", className)} style={style}>
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={onClick}
        disabled={disabled}
        type={type ?? "button"}
        className="hp-glass"
        {...(buttonRest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {inner}
      </button>
    </div>
  );
});

GlassButton.displayName = "GlassButton";
