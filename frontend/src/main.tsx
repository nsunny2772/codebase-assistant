import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@src/App";

import "antd/dist/reset.css";
import "react-toastify/dist/ReactToastify.css";
import "./assets/styles.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
