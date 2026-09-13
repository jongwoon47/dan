import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { getDataMode } from "@/data/mode";
import { DanProvider } from "@/domain/store";
import { SupabaseDanProvider } from "@/domain/store.supabase";
import { CreateDemandPage } from "@/pages/CreateDemandPage";
import { DemandDetailPage } from "@/pages/DemandDetailPage";
import { DemandFeedPage } from "@/pages/DemandFeedPage";
import { DemandItemPage } from "@/pages/DemandItemPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { MyDanPage } from "@/pages/MyDanPage";
import { OwnershipPage } from "@/pages/OwnershipPage";
import { SellIntentPage } from "@/pages/SellIntentPage";

function DataProvider({ children }: { children: ReactNode }) {
  if (getDataMode() === "supabase") {
    return <SupabaseDanProvider>{children}</SupabaseDanProvider>;
  }
  return <DanProvider>{children}</DanProvider>;
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="feed" element={<DemandFeedPage />} />
              <Route path="create" element={<CreateDemandPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="demand/item/:demandId" element={<DemandItemPage />} />
              <Route path="demand/:productId" element={<DemandDetailPage />} />
              <Route path="demand/:productId/own" element={<OwnershipPage />} />
              <Route
                path="ownership/:ownershipId/sell-intent"
                element={<SellIntentPage />}
              />
              <Route path="my" element={<MyDanPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}
