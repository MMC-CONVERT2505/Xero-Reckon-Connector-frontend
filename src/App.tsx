import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

import CustomerInfoForm from "./components/CustomerInfoForm";
import ConnectionStep from "./components/ConnectionStep";
import MigrationWizard from "./components/MigrationWizard";
import MigrationProgress from "./components/MigrationProgress";
import XeroFileSelection from "./components/XeroFileSelection";



import ReckonFileSelection from "./components/ReckonFileSelection";

import AdminDashboard from "./pages/AdminDashboard";
import AdminMigrationDetails from "./pages/AdminMigrationDetails"

// ...existing imports...

const queryClient = new QueryClient();

// Simple wrappers to satisfy required props when used as standalone pages
const CustomerInfoPage = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="max-w-xl w-full">
      <CustomerInfoForm onSubmit={() => { /* you can navigate to next step here */ }} />
    </div>
  </div>
);

const ConnectionStepPage = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="max-w-3xl w-full">
      <ConnectionStep onComplete={() => { /* e.g. navigate to /migration-progress */ }} />
    </div>
  </div>
);

const MigrationProgressPage = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="max-w-4xl w-full">
      {/* For now, read IDs from localStorage so this route works standalone */}
      <MigrationProgress
        onComplete={() => { /* e.g. navigate to a summary page */ }}
        fileId={Number(localStorage.getItem("jobId") || 0) || undefined}
        xeroToolId={1}
        reckonToolId={2}
      />
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<Index />} />

          {/* Full wizard (your original flow) */}
          <Route path="/wizard" element={<MigrationWizard />} />

          {/* Individual screens as pages */}
          <Route path="/customer-info" element={<CustomerInfoPage />} />
          <Route path="/connect-accounts" element={<ConnectionStepPage />} />
          <Route path="/xero-file-selection/:jobId" element={<XeroFileSelection />} />
          <Route path="/Reckon-file-selection/:jobId" element={< ReckonFileSelection/>} />
          <Route path="/migration-progress" element={<MigrationProgressPage />} />

          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/migrations/:jobId" element={<AdminMigrationDetails />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;