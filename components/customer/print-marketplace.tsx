"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PRINT_CATEGORY_VISUALS } from "@/lib/utils/print-category-visuals";
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  MAX_COPIES_PER_ORDER,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/utils/constants";
import { formatCurrency, formatTrackingId } from "@/lib/utils/format";
import type { Shop, UserProfile } from "@/types";

type PrintCategory = "hall_ticket" | "lab_manual" | "other";
type PrintType = "black_white" | "color";
type SideType = "single_side" | "double_side";

type MarketplaceShop = Shop & {
  parsedLat: number | null;
  parsedLng: number | null;
  distanceKm: number | null;
};

const CATEGORY_OPTIONS: Array<{
  id: PrintCategory;
  label: string;
  subtitle: string;
  imageUrl: string;
  icon: string;
}> = [
  {
    id: "hall_ticket",
    label: "Hall Ticket",
    subtitle: PRINT_CATEGORY_VISUALS.hall_ticket.subtitle,
    imageUrl: PRINT_CATEGORY_VISUALS.hall_ticket.imageUrl,
    icon: PRINT_CATEGORY_VISUALS.hall_ticket.icon,
  },
  {
    id: "lab_manual",
    label: "Lab Manual",
    subtitle: PRINT_CATEGORY_VISUALS.lab_manual.subtitle,
    imageUrl: PRINT_CATEGORY_VISUALS.lab_manual.imageUrl,
    icon: PRINT_CATEGORY_VISUALS.lab_manual.icon,
  },
  {
    id: "other",
    label: "Other Prints",
    subtitle: PRINT_CATEGORY_VISUALS.other.subtitle,
    imageUrl: PRINT_CATEGORY_VISUALS.other.imageUrl,
    icon: PRINT_CATEGORY_VISUALS.other.icon,
  },
];

const PRINT_TYPE_OPTIONS: Array<{ value: PrintType; label: string }> = [
  { value: "black_white", label: "B/W" },
  { value: "color", label: "Color" },
];

const SIDE_TYPE_OPTIONS: Array<{ value: SideType; label: string }> = [
  { value: "single_side", label: "Single side" },
  { value: "double_side", label: "Double side" },
];

function getCategoryMeta(category: PrintCategory) {
  return CATEGORY_OPTIONS.find((option) => option.id === category) ?? CATEGORY_OPTIONS[0];
}

function parseLatLngFromMapsUrl(value?: string) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return { lat: null, lng: null };
  }

  const atMatch = rawValue.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return {
      lat: Number(atMatch[1]),
      lng: Number(atMatch[2]),
    };
  }

  const queryMatch = rawValue.match(/[?&](?:q|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (queryMatch) {
    return {
      lat: Number(queryMatch[1]),
      lng: Number(queryMatch[2]),
    };
  }

  return { lat: null, lng: null };
}

function calculateDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function calculateEstimateRupees(params: {
  category: PrintCategory;
  printType: PrintType;
  sideType: SideType;
  pageCount: number;
  copies: number;
}) {
  const ratePerPage =
    params.printType === "color"
      ? params.sideType === "double_side"
        ? 15
        : 10
      : params.sideType === "double_side"
        ? 3
        : 2;

  const baseAmount = ratePerPage * params.pageCount * params.copies;
  const labManualFee = params.category === "lab_manual" ? 50 : 0;

  return baseAmount + labManualFee;
}

function buildOrderNotes(params: {
  category: PrintCategory;
  printType: PrintType;
  sideType: SideType;
  pageCount: number;
  copies: number;
  estimateRupees: number;
  userNotes: string;
}) {
  const categoryMeta = getCategoryMeta(params.category);
  const noteLines = [
    `Category: ${categoryMeta.label}`,
    `Print: ${params.printType === "color" ? "Color" : "B/W"}`,
    `Sides: ${params.sideType === "double_side" ? "Double side" : "Single side"}`,
    `Pages: ${params.pageCount}`,
    `Copies: ${params.copies}`,
    `Estimated total: ${formatCurrency(params.estimateRupees)}`,
  ];

  if (params.userNotes.trim()) {
    noteLines.push(`Customer note: ${params.userNotes.trim()}`);
  }

  return noteLines.join("\n");
}

function getMapEmbedUrl(lat: number, lng: number) {
  const delta = 0.018;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function PrintMarketplace({
  shops,
  profile,
  initialCategory,
}: {
  shops: Shop[];
  profile: UserProfile;
  initialCategory?: PrintCategory;
}) {
  const router = useRouter();
  const hydrationSafeProps = { suppressHydrationWarning: true as const };
  const [category, setCategory] = useState<PrintCategory>(initialCategory || "hall_ticket");
  const [printType, setPrintType] = useState<PrintType>("black_white");
  const [sideType, setSideType] = useState<SideType>("single_side");
  const [pageCount, setPageCount] = useState(1);
  const [copies, setCopies] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [customerPhone, setCustomerPhone] = useState(profile.phone || "");
  const [notes, setNotes] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdTrackingCode, setCreatedTrackingCode] = useState("");
  const [submittedShop, setSubmittedShop] = useState<Shop | null>(null);

  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoadingLocation(false);
      },
      () => {
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 300000,
      },
    );
  }, []);

  const shopsWithDistance = useMemo<MarketplaceShop[]>(() => {
    return shops
      .map((shop) => {
        const { lat, lng } = parseLatLngFromMapsUrl(shop.googleMapsUrl);
        const distanceKm =
          userLocation && lat !== null && lng !== null
            ? calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng)
            : null;

        return {
          ...shop,
          parsedLat: lat,
          parsedLng: lng,
          distanceKm,
        };
      })
      .sort((first, second) => {
        if (first.distanceKm !== null && second.distanceKm !== null) {
          return first.distanceKm - second.distanceKm;
        }
        if (first.distanceKm !== null) {
          return -1;
        }
        if (second.distanceKm !== null) {
          return 1;
        }
        return first.shopName.localeCompare(second.shopName);
      });
  }, [shops, userLocation]);

  useEffect(() => {
    if (!shopsWithDistance.length) {
      setSelectedShopId("");
      return;
    }

    setSelectedShopId((current) => {
      if (current && shopsWithDistance.some((shop) => shop.id === current)) {
        return current;
      }
      return shopsWithDistance[0]?.id || "";
    });
  }, [shopsWithDistance]);

  const selectedShop =
    shopsWithDistance.find((shop) => shop.id === selectedShopId) || shopsWithDistance[0] || null;
  const estimateRupees = calculateEstimateRupees({
    category,
    printType,
    sideType,
    pageCount,
    copies,
  });
  const categoryMeta = getCategoryMeta(category);
  const canSubmit = Boolean(selectedShop && selectedFile && customerPhone.trim());

  function resetOrderState(nextCategory: PrintCategory) {
    setCategory(nextCategory);
    setPrintType("black_white");
    setSideType("single_side");
    setPageCount(1);
    setCopies(1);
    setSelectedFile(null);
    setNotes("");
    setError("");
    setCreatedTrackingCode("");
    setSubmittedShop(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  }

  async function handleSubmit() {
    if (!selectedShop) {
      setError("Select a shop to continue.");
      return;
    }

    if (!selectedFile) {
      setError("Upload one document to continue.");
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
      setError("Only PDF, DOC, DOCX, PNG, and JPG files are allowed.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError("File size must be under 15 MB.");
      return;
    }

    if (!customerPhone.trim()) {
      setError("Add your phone number to continue.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const uploadPayload = new FormData();
      uploadPayload.append("files", selectedFile);

      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: uploadPayload,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || "File upload failed.");
      }

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: profile.name,
          customerPhone: customerPhone.trim(),
          shopId: selectedShop.id,
          notes: buildOrderNotes({
            category,
            printType,
            sideType,
            pageCount,
            copies,
            estimateRupees,
            userNotes: notes,
          }),
          printType,
          sideType,
          pageCount,
          copies,
          files: uploadResult.files,
        }),
      });

      const orderResult = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderResult.error || "Order creation failed.");
      }

      setSubmittedShop(selectedShop);
      setCreatedTrackingCode(orderResult.order?.trackingCode || orderResult.order?.id || "");
      router.push("/customer/orders?order=sent#orders");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Unable to place order.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORY_OPTIONS.map((option) => {
          const isActive = option.id === category;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => resetOrderState(option.id)}
              className={
                isActive
                  ? "relative overflow-hidden rounded-[32px] border border-[#c96d38] text-left shadow-[0_26px_60px_rgba(156,76,32,0.22)]"
                  : "relative overflow-hidden rounded-[32px] border border-[#e6d8c9] text-left shadow-[0_18px_50px_rgba(40,28,19,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(40,28,19,0.16)]"
              }
              {...hydrationSafeProps}
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${option.imageUrl})` }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-0 ${
                  isActive
                    ? "bg-gradient-to-t from-[rgba(24,18,14,0.92)] via-[rgba(24,18,14,0.38)] to-[rgba(24,18,14,0.1)]"
                    : "bg-gradient-to-t from-[rgba(24,18,14,0.86)] via-[rgba(24,18,14,0.28)] to-[rgba(24,18,14,0.08)]"
                }`}
              />
              <div className="relative flex min-h-[260px] flex-col justify-between p-5 text-white sm:min-h-[300px]">
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 text-sm font-bold tracking-[0.22em] backdrop-blur">
                    {option.icon}
                  </span>
                  {isActive ? (
                    <span className="rounded-full bg-[#ffede0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9c4c20]">
                      Selected
                    </span>
                  ) : null}
                </div>

                <div>
                  <p className="text-2xl font-semibold tracking-[-0.04em]">{option.label}</p>
                  <p className="mt-2 max-w-[18rem] text-sm leading-6 text-white/80">
                    {option.subtitle}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-6">
          <div className="panel-strong overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-6">
              <div
                className="relative overflow-hidden rounded-[28px] border border-[#e8d8ca] bg-cover bg-center p-5 text-white sm:p-6"
                style={{ backgroundImage: `url(${categoryMeta.imageUrl})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[rgba(28,20,16,0.92)] to-[rgba(28,20,16,0.42)]" />
                <div className="relative flex flex-col gap-2">
                  <p className="eyebrow text-[#ffd8bd]">{categoryMeta.label}</p>
                  <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                    Customize and send your print order
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                    Pick the print style, upload one file, then choose the nearest shop.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.84)] p-5">
                  <p className="label">Print type</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {PRINT_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPrintType(option.value)}
                        className={
                          option.value === printType
                            ? "rounded-full bg-[#221c18] px-4 py-2.5 text-sm font-semibold text-white"
                            : "rounded-full border border-[#d9cabc] bg-white px-4 py-2.5 text-sm font-semibold text-[#4f433a]"
                        }
                        {...hydrationSafeProps}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.84)] p-5">
                  <p className="label">Side</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {SIDE_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSideType(option.value)}
                        className={
                          option.value === sideType
                            ? "rounded-full bg-[#221c18] px-4 py-2.5 text-sm font-semibold text-white"
                            : "rounded-full border border-[#d9cabc] bg-white px-4 py-2.5 text-sm font-semibold text-[#4f433a]"
                        }
                        {...hydrationSafeProps}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
                <div className="rounded-[28px] border border-[#eadfd3] bg-white p-5">
                  <p className="label">Pages</p>
                  <div className="mt-3 flex items-center justify-between rounded-full bg-[#f8eee4] p-2">
                    <button
                      type="button"
                      onClick={() => setPageCount((current) => Math.max(1, current - 1))}
                      className="nav-icon-btn"
                      {...hydrationSafeProps}
                    >
                      -
                    </button>
                    <span className="text-xl font-semibold text-slate-900">{pageCount}</span>
                    <button
                      type="button"
                      onClick={() => setPageCount((current) => current + 1)}
                      className="nav-icon-btn"
                      {...hydrationSafeProps}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#eadfd3] bg-white p-5">
                  <p className="label">Copies</p>
                  <div className="mt-3 flex items-center justify-between rounded-full bg-[#f8eee4] p-2">
                    <button
                      type="button"
                      onClick={() => setCopies((current) => Math.max(1, current - 1))}
                      className="nav-icon-btn"
                      {...hydrationSafeProps}
                    >
                      -
                    </button>
                    <span className="text-xl font-semibold text-slate-900">{copies}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCopies((current) => Math.min(MAX_COPIES_PER_ORDER, current + 1))
                      }
                      className="nav-icon-btn"
                      {...hydrationSafeProps}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#eadfd3] bg-white p-5">
                  <p className="label">Upload file</p>
                  <label className="mt-3 flex min-h-[116px] cursor-pointer flex-col justify-center rounded-[24px] border border-dashed border-[#d9cabc] bg-[#fff8f1] px-4 text-center">
                    <input
                      type="file"
                      accept={ACCEPTED_FILE_EXTENSIONS}
                      onChange={handleFileChange}
                      className="hidden"
                      {...hydrationSafeProps}
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      {selectedFile ? selectedFile.name : "Tap to upload one document"}
                    </span>
                    <span className="mt-2 text-xs text-[#7a6b5f]">PDF, DOC, DOCX, PNG, JPG</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <div className="panel overflow-hidden p-0">
                  <div className="flex items-center justify-between border-b border-[#eadfd3] px-5 py-4">
                    <div>
                      <p className="eyebrow">Map view</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">
                        Nearby print shops
                      </h3>
                    </div>
                    <span className="rounded-full bg-[#f6e3d5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9c4c20]">
                      {loadingLocation ? "Locating" : userLocation ? "Nearest first" : "List view"}
                    </span>
                  </div>

                  {selectedShop?.parsedLat !== null && selectedShop?.parsedLng !== null ? (
                    <iframe
                      title={`Map for ${selectedShop.shopName}`}
                      src={getMapEmbedUrl(selectedShop.parsedLat, selectedShop.parsedLng)}
                      className="h-[320px] w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="flex h-[320px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,109,56,0.2),transparent_32%),linear-gradient(180deg,#fbf5ee_0%,#f2e6da_100%)] p-6 text-center">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">Map preview unavailable</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          This shop has no coordinates yet. You can still open directions from the card.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {shopsWithDistance.map((shop) => {
                    const isSelected = shop.id === selectedShopId;

                    return (
                      <div
                        key={shop.id}
                        onClick={() => setSelectedShopId(shop.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedShopId(shop.id);
                          }
                        }}
                        className={
                          isSelected
                            ? "panel-strong w-full cursor-pointer p-5 text-left"
                            : "panel w-full cursor-pointer p-5 text-left transition hover:-translate-y-0.5"
                        }
                        role="button"
                        tabIndex={0}
                        {...hydrationSafeProps}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-slate-900">{shop.shopName}</p>
                            <p className="mt-1 text-sm text-slate-600">{shop.address}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-[#f7ece1] px-3 py-1 text-xs font-semibold text-[#8a5738]">
                                {shop.distanceKm !== null
                                  ? `${shop.distanceKm.toFixed(1)} km away`
                                  : "Distance unavailable"}
                              </span>
                              <span className="rounded-full bg-[#f3f1ee] px-3 py-1 text-xs font-semibold text-[#5e534a]">
                                Est. {formatCurrency(estimateRupees)}
                              </span>
                            </div>
                          </div>
                          {isSelected ? (
                            <span className="rounded-full bg-[#221c18] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                              Selected
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={`tel:${shop.phone}`}
                            className="btn-secondary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Call
                          </a>
                          {shop.googleMapsUrl ? (
                            <a
                              href={shop.googleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Directions
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <div className="panel-dark p-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#ffc89b]">
              Live total
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
              {formatCurrency(estimateRupees)}
            </p>
            <div className="mt-5 space-y-2 text-sm text-white/80">
              <p>{categoryMeta.label}</p>
              <p>{printType === "color" ? "Color" : "B/W"}</p>
              <p>{sideType === "double_side" ? "Double side" : "Single side"}</p>
              <p>
                {pageCount} pages x {copies} copies
              </p>
              {category === "lab_manual" ? <p>Lab manual handling + Rs 50</p> : null}
            </div>
          </div>

          <div className="panel p-5">
            <p className="eyebrow">Checkout</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="customerName">
                  Name
                </label>
                <input
                  id="customerName"
                  value={profile.name}
                  className="input"
                  readOnly
                  {...hydrationSafeProps}
                />
              </div>

              <div>
                <label className="label" htmlFor="customerPhone">
                  Phone
                </label>
                <input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="input"
                  placeholder="Enter phone number"
                  {...hydrationSafeProps}
                />
              </div>

              <div>
                <label className="label" htmlFor="notes">
                  Note
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input min-h-24"
                  placeholder="Optional instruction"
                  {...hydrationSafeProps}
                />
              </div>
            </div>

            {selectedShop ? (
              <div className="mt-5 rounded-[24px] bg-[rgba(255,248,240,0.9)] p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{selectedShop.shopName}</p>
                <p className="mt-1">{selectedShop.address}</p>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            {createdTrackingCode ? (
              <p className="mt-4 text-sm text-slate-700">
                Tracking ID: {formatTrackingId(submittedShop?.id || "", createdTrackingCode)}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || loading}
              className="btn-primary mt-5 w-full py-3"
              {...hydrationSafeProps}
            >
              {loading ? "Placing order..." : "Proceed to place order"}
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
