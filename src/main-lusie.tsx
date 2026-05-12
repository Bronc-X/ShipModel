import React from "react";
import ReactDOM from "react-dom/client";
import { App as LusieApp } from "./lusie/LusieApp";
import "./lusie/lusie.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LusieApp />
  </React.StrictMode>
);
