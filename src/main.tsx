import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { configureAnalytics, NoopAnalyticsProvider } from "@/analytics/contract";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import "./styles/global.css";
import "./styles/danPractical.css";
import "./styles/danAppV3.css";

configureAnalytics(new NoopAnalyticsProvider());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
