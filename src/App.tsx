import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthProvider";
import { ConsentProvider } from "@/auth/ConsentProvider";
import { NativeAuthBridge } from "@/auth/NativeAuthBridge";
import { RequireConsent } from "@/auth/RequireConsent";
import { AppShell } from "@/components/layout/AppShell";
import { getDataMode } from "@/data/mode";
import { DanProvider } from "@/domain/store";
import { SupabaseDanProvider } from "@/domain/store.supabase";
import { ActivityPage } from "@/pages/ActivityPage";
import { ConversationsPage } from "@/pages/ConversationsPage";
import { CreateDemandPage } from "@/pages/CreateDemandPage";
import { DemandDetailPage } from "@/pages/DemandDetailPage";
import { DemandEditPage } from "@/pages/DemandEditPage";
import { DemandFeedPage } from "@/pages/DemandFeedPage";
import { DemandItemPage } from "@/pages/DemandItemPage";
import { DealEvidencePage } from "@/pages/DealEvidencePage";
import { DealSnapshotPage } from "@/pages/DealSnapshotPage";
import { HomePage } from "@/pages/HomePage";
import { HandoffPage } from "@/pages/HandoffPage";
import { ConsentPage } from "@/pages/ConsentPage";
import { LoginPage } from "@/pages/LoginPage";
import { MatchChatPage } from "@/pages/MatchChatPage";
import { MyDanPage } from "@/pages/MyDanPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OfferDetailPage } from "@/pages/OfferDetailPage";
import { OwnershipPage } from "@/pages/OwnershipPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { QuickOfferPage } from "@/pages/QuickOfferPage";
import { SafePaymentPage } from "@/pages/SafePaymentPage";
import { SellIntentPage } from "@/pages/SellIntentPage";
import { TradeCompletePage } from "@/pages/TradeCompletePage";
import "@/styles/danPremium.css";
import { SettingsPage } from '@/pages/SettingsPage';
import { AccountDeletionPage } from '@/pages/AccountDeletionPage';

function LegacyBuyCreateRedirect() {
  const { search } = useLocation();
  const current = new URLSearchParams(search);
  const next = new URLSearchParams();
  next.set("type", "BUY");
  const query = current.get("q");
  if (query) next.set("q", query);
  return <Navigate to={`/create?${next.toString()}`} replace />;
}

function DataProvider({ children }: { children: ReactNode }) {
  if (getDataMode() === "supabase") {
    return <SupabaseDanProvider>{children}</SupabaseDanProvider>;
  }
  return <DanProvider>{children}</DanProvider>;
}

export default function App() {
  return (
    <AuthProvider>
      <ConsentProvider>
        <DataProvider>
          <BrowserRouter
            basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}
          >
            <NativeAuthBridge />
            <Routes>
              <Route path="login" element={<LoginPage />} />
              <Route path="consent" element={<ConsentPage />} />
              <Route element={<RequireConsent />}>
                <Route element={<AppShell />}>
                  <Route index element={<HomePage />} />
                  <Route path="feed" element={<DemandFeedPage />} />
                  <Route path="create" element={<CreateDemandPage />} />
                  <Route path="buy/new" element={<LegacyBuyCreateRedirect />} />
                  <Route path="chats" element={<ConversationsPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="profile/:userId" element={<ProfilePage />} />
                  <Route path="offer/:matchId" element={<OfferDetailPage />} />
                  <Route path="match/:matchId" element={<MatchChatPage />} />
                  <Route path="deal/:matchId/evidence" element={<DealEvidencePage />} />
                  <Route path="deal/:matchId/snapshot" element={<DealSnapshotPage />} />
                  <Route path="deal/:matchId/payment" element={<SafePaymentPage />} />
                  <Route path="deal/:matchId/handoff" element={<HandoffPage />} />
                  <Route path="deal/:matchId/complete" element={<TradeCompletePage />} />
                  <Route path="demand/item/:demandId" element={<DemandItemPage />} />
                  <Route path="demand/item/:demandId/edit" element={<DemandEditPage />} />
                  <Route path="demand/:productId" element={<DemandDetailPage />} />
                  <Route path="demand/:productId/offer" element={<QuickOfferPage />} />
                  <Route path="demand/:productId/own" element={<OwnershipPage />} />
                  <Route
                    path="ownership/:ownershipId/sell-intent"
                    element={<SellIntentPage />}
                  />
                  <Route path="my" element={<MyDanPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/delete-account" element={<AccountDeletionPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </ConsentProvider>
    </AuthProvider>
  );
}
