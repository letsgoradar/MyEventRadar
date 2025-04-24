import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Initialiseer de event bus
import "./utils/event-bus";

createRoot(document.getElementById("root")!).render(<App />);
