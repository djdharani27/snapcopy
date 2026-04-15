"use client";

export async function setClientSession(token: string) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Unable to create session.");
  }
}

export async function clearClientSession() {
  await fetch("/api/session", { method: "DELETE" });
}
