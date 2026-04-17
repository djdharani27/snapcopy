import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import type { UserProfile } from "@/types";

interface DashboardShellProps {
  profile: UserProfile;
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function DashboardShell({
  profile,
  title,
  description,
  children,
  actions,
}: DashboardShellProps) {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="panel mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-teal-700">
              SnapCopy
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{profile.name}</p>
              <p>{profile.email}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
              {actions}
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
