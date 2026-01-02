import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

import Dashboard from "./pages/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Map is the only route - all auth is modal-based */}
            <Route path="/" element={<Dashboard />} />
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
