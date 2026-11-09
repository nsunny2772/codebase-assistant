import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";

import { AppRoutes } from "@src/routes";
import { Toast } from "@src/shared/components/Toast";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 5000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const App = () => (
  <QueryClientProvider client={client}>
    <ConfigProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toast />
      </BrowserRouter>
    </ConfigProvider>
  </QueryClientProvider>
);
export default App;
