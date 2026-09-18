import { Redirect, useSearch } from "wouter";
import { safeReturnTo } from "@/lib/safe-return-to";

export default function AppRegisterPage() {
  const search = useSearch();
  const requested = new URLSearchParams(search).get("returnTo");
  const returnTo = safeReturnTo(requested, "");
  return <Redirect to={`/app?auth=register${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`} />;
}
