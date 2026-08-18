"use client";

import { useState } from "react";
import styles from "./KeycapButton.module.css";

interface DeezerKeycapButtonProps {
  onClick?: () => void;
  className?: string;
  href?: string;
}

export default function DeezerKeycapButton({ onClick, className = "", href }: DeezerKeycapButtonProps) {
  const [pressed, setPressed] = useState(false);

  const commonClass = `${styles.keycap} ${pressed ? styles.pressed : ""} ${className}`;

  const icon = (
    <svg viewBox="0 0 240 240" width="150" height="150" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="240" rx="40" fill="#000000" />
      <g fill="#A238FF">
        <rect x="34" y="140" width="26" height="46" />
        <rect x="70" y="120" width="26" height="66" />
        <rect x="106" y="94" width="26" height="92" />
        <rect x="142" y="70" width="26" height="116" />
        <rect x="178" y="54" width="26" height="132" />
      </g>
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
        aria-label="Deezer"
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