"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DetectedBarcode = {
  rawValue?: string;
};

interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

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

export function ShopQrScanButton() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    async function startScanner() {
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not available on this device.");
        return;
      }

      const BarcodeDetectorApi = window.BarcodeDetector;
      if (!BarcodeDetectorApi) {
        setError("QR scanning is not supported in this browser.");
        return;
      }

      try {
        const supportedFormats = await BarcodeDetectorApi.getSupportedFormats?.();
        if (supportedFormats && !supportedFormats.includes("qr_code")) {
          setError("QR scanning is not supported in this browser.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetectorApi({ formats: ["qr_code"] });
        intervalRef.current = window.setInterval(async () => {
          if (!videoRef.current || isDetectingRef.current || videoRef.current.readyState < 2) {
            return;
          }

          isDetectingRef.current = true;

          try {
            const barcodes = await detector.detect(videoRef.current);
            const rawValue = barcodes.find((barcode) => barcode.rawValue)?.rawValue;

            if (!rawValue) {
              return;
            }

            const route = getShopRoute(rawValue);
            if (!route) {
              setError("That QR code is not a valid shop link.");
              return;
            }

            setIsOpen(false);
            router.push(route);
          } catch {
            setError("Unable to scan the QR code. Try again.");
          } finally {
            isDetectingRef.current = false;
          }
        }, 500);
      } catch {
        setError("Camera permission was blocked or the scanner could not start.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      isDetectingRef.current = false;

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, router]);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn-secondary">
        Scan shop QR
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="panel w-full max-w-md p-5">
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
                className="text-sm font-medium text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
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
