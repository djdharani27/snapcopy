"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "qr-scanner";

function getShopRoute(value: string) {
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const path = parsed.pathname.replace(/\/+$/, "");
    const shareMatch = path.match(/^\/s\/([^/]+)$/);
    if (shareMatch) {
      return `/customer/shop/${shareMatch[1]}`;
    }

    const customerMatch = path.match(/^\/customer\/shop\/([^/]+)$/);
    if (customerMatch) {
      return `/customer/shop/${customerMatch[1]}`;
    }
  } catch {}

  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return `/customer/shop/${trimmed}`;
  }

  return null;
}

export function ShopQrScanButton({
  variant = "inline",
}: {
  variant?: "inline" | "hero" | "icon";
}) {
  const router = useRouter();
  const hydrationSafeProps = { suppressHydrationWarning: true as const };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    async function startScanner() {
      setError("");

      if (!videoRef.current) {
        setError("Camera preview is not ready yet.");
        return;
      }

      if (!(await QrScanner.hasCamera())) {
        setError("Camera access is not available on this device.");
        return;
      }

      try {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const route = getShopRoute(result.data);
            if (!route) {
              setError("That QR code is not a valid shop link.");
              return;
            }

            setIsOpen(false);
            router.push(route);
          },
          {
            preferredCamera: "environment",
            maxScansPerSecond: 10,
            returnDetailedScanResult: true,
            onDecodeError: (scanError) => {
              if (String(scanError) !== QrScanner.NO_QR_CODE_FOUND) {
                setError("Unable to scan the QR code. Try again.");
              }
            },
          },
        );

        scannerRef.current = scanner;

        await scanner.start();

        if (cancelled) {
          scanner.stop();
          scanner.destroy();
          scannerRef.current = null;
        }
      } catch {
        setError("Camera permission was blocked or the scanner could not start.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [isOpen, router]);

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="panel-dark group w-full overflow-hidden p-4 text-left sm:p-6"
          {...hydrationSafeProps}
        >
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#ffc89b]">
                Scan to start
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                Scan the shop image and go straight to the right upload screen.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#e7d8c8] sm:text-[15px]">
                No long setup first. Point the camera at any SnapCopy QR and jump directly into
                that shop&apos;s flow.
              </p>
              <span className="btn-primary mt-6 w-full sm:w-auto">
                Open scanner
                <span aria-hidden="true">↗</span>
              </span>
            </div>

            <div className="relative mx-auto flex h-48 w-full max-w-[280px] items-center justify-center sm:h-56 sm:max-w-[320px]">
              <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-white/4" />
              <div className="absolute inset-6 rounded-[28px] border border-dashed border-[#ffcfab]/30" />
              <div className="absolute left-6 top-6 h-10 w-10 rounded-tl-[22px] border-l-4 border-t-4 border-[#ffd6b6]" />
              <div className="absolute right-6 top-6 h-10 w-10 rounded-tr-[22px] border-r-4 border-t-4 border-[#ffd6b6]" />
              <div className="absolute bottom-6 left-6 h-10 w-10 rounded-bl-[22px] border-b-4 border-l-4 border-[#ffd6b6]" />
              <div className="absolute bottom-6 right-6 h-10 w-10 rounded-br-[22px] border-b-4 border-r-4 border-[#ffd6b6]" />
              <div className="absolute left-8 right-8 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ffbb86] to-transparent shadow-[0_0_22px_rgba(255,187,134,0.9)]" />
              <div className="grid h-28 w-28 grid-cols-3 gap-2 rounded-[24px] bg-[#fff2e5] p-3 shadow-[0_18px_38px_rgba(0,0,0,0.28)] transition group-hover:scale-[1.02]">
                {Array.from({ length: 9 }).map((_, index) => (
                  <span
                    key={index}
                    className={index % 2 === 0 ? "rounded-md bg-[#201813]" : "rounded-md bg-[#cc7a46]"}
                  />
                ))}
              </div>
            </div>
          </div>
        </button>
      ) : variant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="nav-icon-btn"
          aria-label="Scan shop QR"
          title="Scan shop QR"
          {...hydrationSafeProps}
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
            <path d="M15 15h1" />
            <path d="M19 15h1v1" />
            <path d="M15 19h1" />
            <path d="M19 19h1v1" />
            <path d="M17 17h2v2h-2z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="btn-secondary"
          {...hydrationSafeProps}
        >
          Scan shop QR
        </button>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="panel-strong w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Scan shop QR</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Point your camera at the shop QR code to open the upload page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-ghost -mr-2 -mt-1"
                {...hydrationSafeProps}
              >
                Close
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-[28px] bg-slate-950">
              <video
                ref={videoRef}
                className="aspect-square w-full object-cover"
                autoPlay
                muted
                playsInline
              />
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
