import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, TextInput } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import {
  areFulfillmentOptionsValid,
  formatFulfillmentSummary,
  placeFromLabel,
  type FulfillmentOption,
} from "@/domain/fulfillment";
import {
  fromDatetimeLocalValue,
  isBorrowRangeValid,
  isDatetimeLocalNotPast,
  toDatetimeLocalValue,
} from "@/lib/datetime";
import { budgetLabelForType } from "@/lib/format";
import "./pages.css";

function primaryPlaceLabel(options: FulfillmentOption[]): string {
  for (const opt of options) {
    if ("place" in opt && opt.place?.publicLabel) return opt.place.publicLabel;
    if (opt.mode === "ROUTE") {
      return `${opt.from.publicLabel} → ${opt.to.publicLabel}`;
    }
  }
  return "";
}

function rebuildFulfillment(
  current: FulfillmentOption[],
  placeLabel: string,
): FulfillmentOption[] {
  if (current.length === 0) {
    return placeLabel.trim()
      ? [{ mode: "MEETUP", place: placeFromLabel(placeLabel) }]
      : current;
  }
  return current.map((opt) => {
    if (opt.mode === "SHIPPING" || opt.mode === "REMOTE") return opt;
    if (opt.mode === "ROUTE") {
      const [fromRaw, toRaw] = placeLabel.split("→").map((s) => s.trim());
      return {
        mode: "ROUTE" as const,
        from: placeFromLabel(fromRaw || opt.from.publicLabel),
        to: placeFromLabel(toRaw || opt.to.publicLabel),
      };
    }
    if ("place" in opt) {
      return { ...opt, place: placeFromLabel(placeLabel || opt.place.publicLabel) };
    }
    return opt;
  });
}

export function DemandEditPage() {
  const { demandId = "" } = useParams();
  const navigate = useNavigate();
  const { getDemand, updateDemand, currentUser, busy } = useDan();
  const demand = getDemand(demandId);

  const [title, setTitle] = useState(demand?.title ?? "");
  const [description, setDescription] = useState(demand?.description ?? "");
  const [budget, setBudget] = useState(String(demand?.budget ?? ""));
  const [place, setPlace] = useState(
    demand ? primaryPlaceLabel(demand.fulfillmentOptions) : "",
  );
  const [borrowStart, setBorrowStart] = useState(
    demand?.type === "BORROW" ? toDatetimeLocalValue(demand.details.startAt) : "",
  );
  const [borrowEnd, setBorrowEnd] = useState(
    demand?.type === "BORROW" ? toDatetimeLocalValue(demand.details.endAt) : "",
  );
  const [dueAt, setDueAt] = useState(
    demand?.type === "TASK" ? toDatetimeLocalValue(demand.details.dueAt) : "",
  );
  const [preferredAt, setPreferredAt] = useState(
    demand?.type === "SERVICE"
      ? toDatetimeLocalValue(demand.details.preferredAt)
      : "",
  );
  const [itemName, setItemName] = useState(
    demand?.type === "BORROW" ? demand.details.itemName : "",
  );
  const [error, setError] = useState<string | null>(null);

  const placeEditable = useMemo(() => {
    if (!demand) return false;
    return demand.fulfillmentOptions.some(
      (o) => o.mode !== "SHIPPING" && o.mode !== "REMOTE",
    );
  }, [demand]);

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
    if (demand!.type === "BORROW") {
      if (!borrowStart.trim() || !borrowEnd.trim()) {
        setError(ko.timeRequiredError);
        return;
      }
      if (!isBorrowRangeValid(borrowStart, borrowEnd)) {
        setError(ko.borrowRangeError);
        return;
      }
      if (
        !isDatetimeLocalNotPast(borrowStart) ||
        !isDatetimeLocalNotPast(borrowEnd)
      ) {
        setError(ko.timePastError);
        return;
      }
    }
    if (demand!.type === "TASK") {
      if (!dueAt.trim()) {
        setError(ko.timeRequiredError);
        return;
      }
      if (!isDatetimeLocalNotPast(dueAt)) {
        setError(ko.timePastError);
        return;
      }
    }
    if (demand!.type === "SERVICE") {
      if (!preferredAt.trim()) {
        setError(ko.timeRequiredError);
        return;
      }
      if (!isDatetimeLocalNotPast(preferredAt)) {
        setError(ko.timePastError);
        return;
      }
    }
    const fulfillmentOptions = rebuildFulfillment(
      demand!.fulfillmentOptions,
      place,
    );
    if (!areFulfillmentOptionsValid(fulfillmentOptions)) {
      setError(ko.genericError);
      return;
    }

    const result = await updateDemand({
      demandId: demand!.id,
      title: title.trim(),
      description: description.trim(),
      budget: n,
      fulfillmentOptions,
      maxPrice: demand!.type === "BUY" ? n : undefined,
      itemName: demand!.type === "BORROW" ? itemName.trim() || title.trim() : undefined,
      taskDescription:
        demand!.type === "TASK"
          ? description.trim() || demand!.details.taskDescription
          : undefined,
      serviceDescription:
        demand!.type === "SERVICE"
          ? description.trim() || demand!.details.serviceDescription
          : undefined,
      startAt:
        demand!.type === "BORROW"
          ? fromDatetimeLocalValue(borrowStart)
          : undefined,
      endAt:
        demand!.type === "BORROW" ? fromDatetimeLocalValue(borrowEnd) : undefined,
      dueAt:
        demand!.type === "TASK" ? fromDatetimeLocalValue(dueAt) : undefined,
      preferredAt:
        demand!.type === "SERVICE"
          ? fromDatetimeLocalValue(preferredAt)
          : undefined,
      conditionPreference:
        demand!.type === "BUY" ? demand!.details.conditionPreference : undefined,
      tradeMethod: demand!.type === "BUY" ? demand!.details.tradeMethod : undefined,
    });
    if (!result) {
      setError(ko.genericError);
      return;
    }
    navigate(`/demand/item/${demand!.id}`);
  }

  return (
    <div className="page-stack page-narrow">
      <header className="page-header">
        <h1 className="page-title">{ko.editDemand}</h1>
        <p className="section-desc">
          {formatFulfillmentSummary(demand.fulfillmentOptions)}
        </p>
      </header>
      <form className="composer-sheet" onSubmit={(e) => void onSave(e)}>
        <Field label={ko.whatNeeded}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field>
        {demand.type === "BORROW" ? (
          <Field label={ko.itemName}>
            <TextInput
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </Field>
        ) : null}
        <Field label={ko.descLabel}>
          <textarea
            className="dan-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <Field
          label={budgetLabelForType(demand.type)}
          hint={demand.type === "BORROW" ? ko.borrowBudgetHint : undefined}
        >
          <TextInput
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
            required
          />
        </Field>
        {placeEditable ? (
          <Field label={ko.detailWhere}>
            <TextInput
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={ko.locationPh}
            />
          </Field>
        ) : null}
        {demand.type === "BORROW" ? (
          <>
            <Field label={ko.borrowStart}>
              <TextInput
                type="datetime-local"
                value={borrowStart}
                onChange={(e) => setBorrowStart(e.target.value)}
                required
              />
            </Field>
            <Field label={ko.borrowEnd}>
              <TextInput
                type="datetime-local"
                value={borrowEnd}
                onChange={(e) => setBorrowEnd(e.target.value)}
                required
              />
            </Field>
          </>
        ) : null}
        {demand.type === "TASK" ? (
          <Field label={ko.dueAt}>
            <TextInput
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </Field>
        ) : null}
        {demand.type === "SERVICE" ? (
          <Field label={ko.preferredAt}>
            <TextInput
              type="datetime-local"
              value={preferredAt}
              onChange={(e) => setPreferredAt(e.target.value)}
              required
            />
          </Field>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? ko.saving : ko.saveDemand}
        </Button>
      </form>
    </div>
  );
}
