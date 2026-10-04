import { Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";

export function SellIntentPage() {
  const { ownershipId = "" } = useParams();
  const { myOwnerships } = useDan();
  const ownership = myOwnerships.find((row) => row.id === ownershipId);

  if (!ownership) {
    return (
      <EmptyState
        title="등록된 물건을 찾을 수 없어요"
        action={<Button to="/feed" variant="secondary">요청 탐색</Button>}
      />
    );
  }

  return <Navigate to={`/demand/${ownership.productId}/offer`} replace />;
}
