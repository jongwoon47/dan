import { Navigate, useSearchParams } from "react-router-dom";

export function BuyDemandCreatePage() {
  const [params] = useSearchParams();
  const query = params.get("q")?.trim();
  const target = query
    ? `/create?type=BUY&q=${encodeURIComponent(query)}`
    : "/create?type=BUY";

  return <Navigate to={target} replace />;
}
