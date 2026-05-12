import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";

// Styles (your cleaned setup)
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/auth.css";
import "./styles/modal.css";
import "./styles/notifications.css";
import "./styles/bookingPage.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);