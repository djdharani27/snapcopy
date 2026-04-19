import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

interface DashboardShellProps {
  profile: {
    name: string;
    email: string;
  };
  title: string;
  description: string;
  children: React.ReactNode;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  hideIntro?: boolean;
}

export function DashboardShell({
  profile,
  title,
  description,
  children,
  navigation,
  actions,
  hideIntro = false,
}: DashboardShellProps) {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="panel-strong mb-6 overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 border-b border-[#e4d8ca] pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  <Link href="/" className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#221c18] text-sm font-bold uppercase tracking-[0.2em] text-[#fff2e4]">
                      SC
                    </span>
                    <div>
                      <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                        SnapCopy
                      </p>
                      <p className="text-xs uppercase tracking-[0.22em] text-[#8b7564]">
                        Print dispatch
                      </p>
                    </div>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                  {navigation ? <div className="min-w-0">{navigation}</div> : null}

                  <div className="flex items-center gap-3">
                    <div className="dashboard-profile">
                      <div className="dashboard-profile__avatar" aria-hidden="true">
                        {profile.name.trim().charAt(0).toUpperCase() || "S"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {profile.name}
                        </p>
                        <p className="truncate text-xs text-[#7a6b5f]">{profile.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {actions}
                      <div className="shrink-0">
                        <LogoutButton />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!hideIntro ? (
              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 text-sm leading-7 text-[#5f554c] sm:text-[15px]">
                  {description}
                </p>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
