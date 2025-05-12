import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Importeer de WebSocket fix
import "./hmr-config";

createRoot(document.getElementById("root")!).render(<App />);
