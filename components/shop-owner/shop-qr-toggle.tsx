"use client";

import { useState } from "react";

export function ShopQrToggle({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="btn-secondary"
        aria-expanded={isOpen}
        aria-controls="shop-owner-qr-panel"
        suppressHydrationWarning
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4h6v6H4z" />
          <path d="M14 4h6v6h-6z" />
          <path d="M4 14h6v6H4z" />
          <path d="M14 14h2" />
          <path d="M18 14h2v2" />
          <path d="M14 18h2v2" />
          <path d="M18 18v2h2" />
        </svg>
        {isOpen ? "Hide QR" : "Show QR"}
      </button>

      {isOpen ? (
        <div id="shop-owner-qr-panel" className="mt-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
