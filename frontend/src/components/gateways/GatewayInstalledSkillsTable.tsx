"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { MarketplaceSkillCardRead } from "@/api/generated/model";
import { DataTable } from "@/components/tables/DataTable";
import { dateCell } from "@/components/tables/cell-formatters";
import { SKILLS_TABLE_EMPTY_ICON } from "@/components/skills/table-helpers";
import { Badge } from "@/components/ui/badge";

type GatewayInstalledSkillsTableProps = {
  skills: MarketplaceSkillCardRead[];
  isLoading?: boolean;
};

function riskBadgeVariant(risk: string | null | undefined) {
  const normalizedRisk = (risk || "unknown").trim().toLowerCase();

  switch (normalizedRisk) {
    case "safe":
    case "low":
      return "success";
    case "minimal":
    case "medium":
    case "moderate":
      return "outline";
    case "high":
    case "critical":
      return "danger";
    case "elevated":
      return "warning";
    case "unknown":
      return "outline";
    default:
      return "accent";
  }
}

function riskPillClassName(risk: string | null | undefined) {
  const normalizedRisk = (risk || "unknown").trim().toLowerCase();

  switch (normalizedRisk) {
    case "safe":
    case "low":
      return "bg-[color:rgba(16,185,129,0.16)] text-emerald-800 border border-emerald-200/70";
    case "medium":
    case "moderate":
      return "bg-[color:rgba(245,158,11,0.16)] text-amber-800 border border-amber-200/70";
    case "elevated":
      return "bg-[color:rgba(245,158,11,0.16)] text-amber-800 border border-amber-200/70";
    case "high":
    case "critical":
      return "bg-[color:rgba(244,63,94,0.16)] text-rose-800 border border-rose-200/70";
    case "unknown":
      return "bg-[color:rgba(148,163,184,0.16)] text-slate-700 border border-slate-200/80";
    default:
      return "bg-[color:rgba(99,102,241,0.16)] text-indigo-800 border border-indigo-200/70";
  }
}

function riskBadgeLabel(risk: string | null | undefined) {
  return (risk || "unknown").trim() || "unknown";
}

export function GatewayInstalledSkillsTable({
  skills,
  isLoading = false,
}: GatewayInstalledSkillsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const columns = useMemo<ColumnDef<MarketplaceSkillCardRead>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Skill",
        cell: ({ row }) => (
          <div>
            <Link
              href={`/skills/marketplace/${row.original.id}/edit`}
              className="text-sm font-medium text-blue-700 hover:text-blue-600 hover:underline"
            >
              {row.original.name}
            </Link>
            <p
              className="mt-1 line-clamp-2 text-xs text-slate-500"
              title={row.original.description || "No description provided."}
            >
              {row.original.description || "No description provided."}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-slate-700">
            {row.original.category || "uncategorized"}
          </span>
        ),
      },
      {
        accessorKey: "risk",
        header: "Risk",
        cell: ({ row }) => (
          <Badge
            variant={riskBadgeVariant(row.original.risk)}
            className={`px-2 py-0.5 ${riskPillClassName(row.original.risk)} font-semibold`}
          >
            {riskBadgeLabel(row.original.risk)}
          </Badge>
        ),
      },
      {
        accessorKey: "installed_at",
        header: "Installed",
        cell: ({ row }) =>
          row.original.installed_at ? (
            dateCell(row.original.installed_at)
          ) : (
            <span className="text-sm text-slate-500">—</span>
          ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: skills,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      table={table}
      isLoading={isLoading}
      rowClassName="transition hover:bg-slate-50"
      cellClassName="px-6 py-4 align-top"
      emptyState={{
        icon: SKILLS_TABLE_EMPTY_ICON,
        title: "No skills installed",
        description:
          "Install skills from the marketplace to make them available on this gateway.",
        actionHref: "/skills/marketplace",
        actionLabel: "Browse marketplace",
      }}
    />
  );
}
