import React from "react";
import ReactDOM from "react-dom/client";
import { ToyBoxApp } from "./toybox/ToyBoxApp";
import "./toybox/toybox.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToyBoxApp />
  </React.StrictMode>
);
