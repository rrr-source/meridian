import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { LocaleProvider } from "./lib/LocaleContext.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
