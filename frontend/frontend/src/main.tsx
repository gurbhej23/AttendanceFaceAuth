import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";

import App from "./App";
import AppBootstrap from "./components/loading/AppBootstrap";
import { ThemeProvider } from "./context/ThemeContext";
import BiometricGate from "./components/common/BiometricGate";

import "./index.css";
import "./theme.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppBootstrap>
          <BiometricGate>
            <App />
          </BiometricGate>
        </AppBootstrap>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
