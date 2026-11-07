import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground",
  secondary: "border border-input",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS };

export function Button({ variant = "primary", className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={`rounded px-4 py-2 font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
