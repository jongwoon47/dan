import { Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";

export function OwnershipPage() {
  const { productId = "" } = useParams();
  const { getProduct } = useDan();
  const product = getProduct(productId);

  if (!product) {
    return (
      <EmptyState
        title="제품을 찾을 수 없어요"
        action={<Button to="/feed" variant="secondary">요청 탐색</Button>}
      />
    );
  }

  return <Navigate to={`/demand/${productId}/offer`} replace />;
}
