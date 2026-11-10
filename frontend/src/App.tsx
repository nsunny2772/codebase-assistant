import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme, type ThemeConfig } from "antd";

import { AppRoutes } from "@src/routes";
import { Toast } from "@src/shared/components/Toast";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 5000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const appTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#533afd",
    colorInfo: "#533afd",
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBorder: "#e3e8ee",
    colorText: "#0d253d",
    colorTextSecondary: "#64748d",
    colorTextPlaceholder: "#64748d",
    colorTextLightSolid: "#ffffff",
    colorSuccess: "#16856b",
    colorError: "#ea2261",
    colorWarning: "#9b6829",
    borderRadius: 8,
    controlHeight: 40,
    fontFamily:
      'Inter, "SF Pro Display", system-ui, -apple-system, sans-serif',
  },
};

const App = () => (
  <QueryClientProvider client={client}>
    <ConfigProvider theme={appTheme}>
      <BrowserRouter>
        <AppRoutes />
        <Toast />
      </BrowserRouter>
    </ConfigProvider>
  </QueryClientProvider>
);
export default App;
