import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { MapRefetchProvider } from "@/hooks/useMapRefetch";
import { useEngagementRealtime } from "@/hooks/useEngagementRealtime";

import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: 1, // Only retry failed requests once
    },
  },
});

// Component to initialize global realtime listener - must be inside MapRefetchProvider
const RealtimeListener = () => {
  useEngagementRealtime();
  return null;
};

const AppContent = () => (
  <>
    <RealtimeListener />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Map is the only route - all auth is modal-based */}
          <Route path="/" element={<Dashboard />} />
          {/* Share/deep-link routes (kept SPA-friendly) */}
          <Route path="/shout/:shoutId" element={<Dashboard />} />
          <Route path="/event/:eventId" element={<Dashboard />} />
          {/* Legacy share-code route used in some UI */}
          <Route path="/m/:shareCode" element={<Dashboard />} />
          {/* Legacy route redirects */}
          <Route path="/auth" element={<Navigate to="/" replace />} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/profile/edit" element={<Navigate to="/" replace />} />
          {/* Catch-all: redirect any unknown routes to map */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MapRefetchProvider>
        <AppContent />
      </MapRefetchProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
