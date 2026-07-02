import React from "react";

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  scheme?: "light" | "dark";
  active?: boolean;
  round?: boolean;
  children: React.ReactNode;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    { scheme = "dark", active = false, round = false, children, style, ...rest },
    ref,
  ) => {
    const isDark = scheme === "dark";

    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        style={{
          border: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: round ? 10 : "10px 18px",
          borderRadius: round ? 9999 : 999,
          cursor: rest.disabled ? "not-allowed" : "pointer",
          opacity: rest.disabled ? 0.4 : 1,
          color: active
            ? "#0a84ff"
            : isDark
              ? "rgba(255,255,255,0.88)"
              : "rgba(0,0,0,0.82)",
          background: active
            ? isDark
              ? "rgba(10,132,255,0.16)"
              : "rgba(10,132,255,0.12)"
            : isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.05)",
          fontWeight: active ? 700 : 600,
          fontSize: 14,
          letterSpacing: "-0.01em",
          transition: "transform 0.18s ease, background 0.18s ease",
          ...style,
        }}
      >
        {children}
      </button>
    );
  },
);
GlassButton.displayName = "GlassButton";
