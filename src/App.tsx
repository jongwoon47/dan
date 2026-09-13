import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { DanProvider } from "@/domain/store";
import { CreateDemandPage } from "@/pages/CreateDemandPage";
import { DemandDetailPage } from "@/pages/DemandDetailPage";
import { DemandFeedPage } from "@/pages/DemandFeedPage";
import { HomePage } from "@/pages/HomePage";
import { MyDanPage } from "@/pages/MyDanPage";
import { OwnershipPage } from "@/pages/OwnershipPage";
import { SellIntentPage } from "@/pages/SellIntentPage";

export default function App() {
  return (
    <DanProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="feed" element={<DemandFeedPage />} />
            <Route path="create" element={<CreateDemandPage />} />
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
    </DanProvider>
  );
}
