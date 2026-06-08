"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  Folder,
  Building2,
  LayoutGrid,
  Network,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Store,
  Tags,
} from "lucide-react";

import { useAuth } from "@/auth/clerk";
import { ApiError } from "@/api/mutator";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import {
  type healthzHealthzGetResponse,
  useHealthzHealthzGet,
} from "@/api/generated/default/default";
import { useDashboardSidebar } from "@/components/templates/dashboard-sidebar-context";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BarChart3;
  isActive: boolean;
};

function SidebarLink({ href, label, icon: Icon, isActive }: NavItem) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition",
        "[[data-sidebar-desktop=collapsed]_&]:justify-center [[data-sidebar-desktop=collapsed]_&]:px-2",
        isActive
          ? "bg-blue-100 text-blue-800 font-medium"
          : "hover:bg-slate-100",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="[[data-sidebar-desktop=collapsed]_&]:hidden">{label}</span>
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { desktopCollapsed, toggleDesktopCollapsed } = useDashboardSidebar();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const healthQuery = useHealthzHealthzGet<healthzHealthzGetResponse, ApiError>(
    {
      query: {
        refetchInterval: 30_000,
        refetchOnMount: "always",
        retry: false,
      },
      request: { cache: "no-store" },
    },
  );

  const okValue = healthQuery.data?.data?.ok;
  const systemStatus: "unknown" | "operational" | "degraded" =
    okValue === true
      ? "operational"
      : okValue === false
        ? "degraded"
        : healthQuery.isError
          ? "degraded"
          : "unknown";
  const statusLabel =
    systemStatus === "operational"
      ? "All systems operational"
      : systemStatus === "unknown"
        ? "System status unavailable"
        : "System degraded";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r border-slate-200 bg-white pt-16 shadow-lg transition-[transform,width] duration-200 ease-in-out [[data-sidebar=open]_&]:translate-x-0 md:relative md:inset-auto md:z-auto md:w-[260px] md:translate-x-0 md:pt-0 md:shadow-none [[data-sidebar-desktop=collapsed]_&]:md:w-16">
      <div className="flex-1 overflow-y-auto px-3 py-4 [[data-sidebar-desktop=collapsed]_&]:px-2">
        <button
          type="button"
          onClick={toggleDesktopCollapsed}
          aria-label={
            desktopCollapsed ? "Expand navigation" : "Collapse navigation"
          }
          title={
            desktopCollapsed ? "Expand navigation" : "Collapse navigation"
          }
          className={cn(
            "mb-3 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 md:flex",
            "[[data-sidebar-desktop=collapsed]_&]:justify-center [[data-sidebar-desktop=collapsed]_&]:px-2",
          )}
        >
          {desktopCollapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          <span className="text-sm font-medium [[data-sidebar-desktop=collapsed]_&]:hidden">
            {desktopCollapsed ? "Expand menu" : "Collapse menu"}
          </span>
        </button>
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 [[data-sidebar-desktop=collapsed]_&]:hidden">
          Navigation
        </p>
        <nav className="mt-3 space-y-4 text-sm [[data-sidebar-desktop=collapsed]_&]:mt-0 [[data-sidebar-desktop=collapsed]_&]:space-y-2">
          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 [[data-sidebar-desktop=collapsed]_&]:hidden">
              Overview
            </p>
            <div className="mt-1 space-y-1 [[data-sidebar-desktop=collapsed]_&]:mt-0">
              <SidebarLink
                href="/dashboard"
                label="Dashboard"
                icon={BarChart3}
                isActive={pathname === "/dashboard"}
              />
              <SidebarLink
                href="/activity"
                label="Live feed"
                icon={Activity}
                isActive={pathname.startsWith("/activity")}
              />
            </div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 [[data-sidebar-desktop=collapsed]_&]:hidden">
              Boards
            </p>
            <div className="mt-1 space-y-1 [[data-sidebar-desktop=collapsed]_&]:mt-0">
              <SidebarLink
                href="/board-groups"
                label="Board groups"
                icon={Folder}
                isActive={pathname.startsWith("/board-groups")}
              />
              <SidebarLink
                href="/boards"
                label="Boards"
                icon={LayoutGrid}
                isActive={pathname.startsWith("/boards")}
              />
              <SidebarLink
                href="/tags"
                label="Tags"
                icon={Tags}
                isActive={pathname.startsWith("/tags")}
              />
              <SidebarLink
                href="/approvals"
                label="Approvals"
                icon={CheckCircle2}
                isActive={pathname.startsWith("/approvals")}
              />
              {isAdmin ? (
                <SidebarLink
                  href="/custom-fields"
                  label="Custom fields"
                  icon={Settings}
                  isActive={pathname.startsWith("/custom-fields")}
                />
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            <div>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 [[data-sidebar-desktop=collapsed]_&]:hidden">
                Skills
              </p>
              <div className="mt-1 space-y-1 [[data-sidebar-desktop=collapsed]_&]:mt-0">
                <SidebarLink
                  href="/skills/marketplace"
                  label="Marketplace"
                  icon={Store}
                  isActive={
                    pathname === "/skills" ||
                    pathname.startsWith("/skills/marketplace")
                  }
                />
                <SidebarLink
                  href="/skills/packs"
                  label="Packs"
                  icon={Boxes}
                  isActive={pathname.startsWith("/skills/packs")}
                />
              </div>
            </div>
          ) : null}

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 [[data-sidebar-desktop=collapsed]_&]:hidden">
              Administration
            </p>
            <div className="mt-1 space-y-1 [[data-sidebar-desktop=collapsed]_&]:mt-0">
              <SidebarLink
                href="/organization"
                label="Organization"
                icon={Building2}
                isActive={pathname.startsWith("/organization")}
              />
              {isAdmin ? (
                <SidebarLink
                  href="/gateways"
                  label="Gateways"
                  icon={Network}
                  isActive={pathname.startsWith("/gateways")}
                />
              ) : null}
              {isAdmin ? (
                <SidebarLink
                  href="/agents"
                  label="Agents"
                  icon={Bot}
                  isActive={pathname.startsWith("/agents")}
                />
              ) : null}
            </div>
          </div>
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4 [[data-sidebar-desktop=collapsed]_&]:px-2 [[data-sidebar-desktop=collapsed]_&]:py-3">
        <div
          className="flex items-center gap-2 text-xs text-slate-500 [[data-sidebar-desktop=collapsed]_&]:justify-center"
          title={statusLabel}
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              systemStatus === "operational" && "bg-emerald-500",
              systemStatus === "degraded" && "bg-rose-500",
              systemStatus === "unknown" && "bg-slate-300",
            )}
          />
          <span className="[[data-sidebar-desktop=collapsed]_&]:hidden">
            {statusLabel}
          </span>
        </div>
      </div>
    </aside>
  );
}
