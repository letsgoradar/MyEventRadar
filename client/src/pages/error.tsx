import { useLocation } from "wouter";
import ErrorPage from "@/components/ErrorPage";

export default function Error() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const code = parseInt(params.get("code") || "500", 10);
  const message = params.get("message") || undefined;

  return <ErrorPage code={code} message={message} />;
}
