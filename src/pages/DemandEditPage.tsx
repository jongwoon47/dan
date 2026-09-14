import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import "./pages.css";

export function DemandEditPage() {
  const { demandId = "" } = useParams();
  const navigate = useNavigate();
  const { getDemand, updateDemand, currentUser, busy } = useDan();
  const demand = getDemand(demandId);
  const [title, setTitle] = useState(demand?.title ?? "");
  const [description, setDescription] = useState(demand?.description ?? "");
  const [budget, setBudget] = useState(String(demand?.budget ?? ""));
  const [error, setError] = useState<string | null>(null);

  if (!demand || demand.userId !== currentUser?.id) {
    return (
      <EmptyState
        title={ko.missingDemand}
        action={<Button to="/my" variant="secondary">{ko.navMy}</Button>}
      />
    );
  }

  if (demand.status !== "ACTIVE") {
    return (
      <EmptyState
        title={ko.demandClosed}
        action={
          <Button to={`/demand/item/${demand.id}`} variant="secondary">
            {ko.goBack}
          </Button>
        }
      />
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const n = Number(budget.replace(/,/g, ""));
    if (!title.trim() || !Number.isFinite(n)) {
      setError(ko.genericError);
      return;
    }
    const result = await updateDemand({
      demandId: demand!.id,
      title: title.trim(),
      description: description.trim(),
      budget: n,
      fulfillmentOptions: demand!.fulfillmentOptions,
      maxPrice: demand!.type === "BUY" ? n : undefined,
      itemName:
        demand!.type === "BORROW" ? demand!.details.itemName : undefined,
      taskDescription:
        demand!.type === "TASK" ? demand!.details.taskDescription : undefined,
      serviceDescription:
        demand!.type === "SERVICE"
          ? demand!.details.serviceDescription
          : undefined,
    });
    if (!result) {
      setError(ko.genericError);
      return;
    }
    navigate(
      demand!.type === "BUY" && "productId" in demand!.details
        ? `/demand/${demand!.details.productId}`
        : `/demand/item/${demand!.id}`,
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{ko.editDemand}</h1>
      </header>
      <form className="composer-sheet" onSubmit={(e) => void onSave(e)}>
        <label className="field">
          <span>{ko.whatNeeded}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span>{ko.createDesc}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <label className="field">
          <span>{ko.maxPrice}</span>
          <input
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? ko.saving : ko.saveDemand}
        </Button>
      </form>
    </div>
  );
}
