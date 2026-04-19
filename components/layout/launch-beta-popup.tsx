"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "snapcopy-launch-beta-popup-dismissed";

export function LaunchBetaPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY);

    if (!dismissed) {
      const timeoutId = window.setTimeout(() => {
        setIsOpen(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, []);

  const handleClose = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
      <div className="panel w-full max-w-md p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-700">
          Beta Testing
        </p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">
          Launch date: April 22, 2026
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          <span className="font-bold text-slate-900">
            Testing will be till April 22, 2026.
          </span>{" "}
          You can use this build to test the experience with your college peers
          before the public launch.
        </p>
        <button type="button" onClick={handleClose} className="btn-primary mt-6 w-full">
          Got it
        </button>
      </div>
    </div>
  );
}
