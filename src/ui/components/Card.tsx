import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  children,
  className = "",
  as: Component = "div",
  padding = "md",
}: CardProps) {
  const paddingClass =
    padding === "none"
      ? ""
      : padding === "sm"
        ? "card-padding-sm"
        : padding === "lg"
          ? "card-padding-lg"
          : "card-padding-md";

  return (
    <Component className={`card ${paddingClass} ${className}`.trim()}>
      {children}
    </Component>
  );
}
