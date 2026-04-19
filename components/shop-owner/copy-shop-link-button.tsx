"use client";

import { useState } from "react";

function getCopyValue(url: string) {
  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }

  return url;
}

export function CopyShopLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getCopyValue(url));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn-secondary"
      suppressHydrationWarning
    >
      {copied ? "Copied link" : "Copy link"}
    </button>
  );
}
