"use client";

import { useState } from "react";
import styles from "./KeycapButton.module.css";

interface AotyKeycapButtonProps {
  onClick?: () => void;
  className?: string;
  href?: string;
}

export default function AotyKeycapButton({ onClick, className = "", href }: AotyKeycapButtonProps) {
  const [pressed, setPressed] = useState(false);

  const commonClass = `${styles.keycap} ${pressed ? styles.pressed : ""} ${className}`;

  const icon = (
    <svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250" width="150" height="150">
      <style>
        {`.t0 { font-size: 24px; fill: #ffffff; font-weight: 400; font-family: "ArialRoundedMTBold", "Arial Rounded MT"; }`}
      </style>
      <text id="AOTY" style={{ transform: "matrix(3.765,0,0,3.765,2.337,93.806)" }}>
        <tspan x="0" y="17.8" className="t0">A</tspan>
        <tspan y="17.8" className="t0">O</tspan>
        <tspan y="17.8" className="t0">T</tspan>
        <tspan y="17.8" className="t0">Y</tspan>
      </text>
    </svg>
  );

  if (href) {
    const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setPressed(true);
      setTimeout(() => {
        setPressed(false);
        window.open(href, "_blank", "noopener,noreferrer");
      }, 150);
      onClick?.();
    };

    return (
      <a
        href={href}
        aria-label="Album of the Year"
        onClick={handleAnchorClick}
        className={commonClass}
      >
        <div className={styles.icon}>{icon}</div>
      </a>
    );
  }

  const handleClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
    onClick?.();
  };

  return (
    <button
      type="button"
      aria-label="Acción"
      onClick={handleClick}
      className={commonClass}
    >
      <div className={styles.icon}>{icon}</div>
    </button>
  );
}