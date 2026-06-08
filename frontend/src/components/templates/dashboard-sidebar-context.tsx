"use client";

import { createContext, useContext } from "react";

type DashboardSidebarContextValue = {
  desktopCollapsed: boolean;
  toggleDesktopCollapsed: () => void;
};

const DashboardSidebarContext =
  createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({
  value,
  children,
}: {
  value: DashboardSidebarContextValue;
  children: React.ReactNode;
}) {
  return (
    <DashboardSidebarContext.Provider value={value}>
      {children}
    </DashboardSidebarContext.Provider>
  );
}

export function useDashboardSidebar() {
  const context = useContext(DashboardSidebarContext);
  if (!context) {
    throw new Error(
      "useDashboardSidebar must be used within DashboardSidebarProvider",
    );
  }
  return context;
}
