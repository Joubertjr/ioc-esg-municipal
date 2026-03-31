import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { DashboardPage } from "./pages/DashboardPage";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
