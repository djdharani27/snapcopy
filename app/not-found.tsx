import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4">
      <div className="panel max-w-lg p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
          Not found
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          This page does not exist
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          The shop or route you requested is missing. Go back to the appropriate dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          <Link href="/login" className="btn-secondary">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
