import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./app.css";
import App from "./App.jsx";
import { I18nProvider } from "./i18n.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nProvider>
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    </I18nProvider>
  </StrictMode>,
);
