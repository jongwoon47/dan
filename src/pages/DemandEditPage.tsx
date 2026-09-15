import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip, ChipGroup, DatetimeLocalInput, Field, TextInput } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import {
  defaultExpiresAtIso,
  normalizeScheduleExpiryIso,
} from "@/domain/demandLifecycle";
import {
  areFulfillmentOptionsValid,
  placeFromLabel,
  stripGeoFromFulfillmentOptions,
  type FulfillmentOption,
} from "@/domain/fulfillment";
import type { ConditionPreference } from "@/domain/types";
import { CONDITION_LABEL } from "@/domain/types";
import {
  fromDatetimeLocalValue,
  isBorrowRangeValid,
  isDatetimeLocalNotPast,
  toDatetimeLocalValue,
} from "@/lib/datetime";
import {
  budgetLabelForType,
  digitsOnly,
  formatDigitsGrouped,
  formatPriceThought,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

type TaskMode = "onsite" | "pickup" | "route" | "remote";
type ServiceMode = "onsite" | "remote";

const CONDITIONS: ConditionPreference[] = [
  "sealed",
  "like_new",
  "lightly_used",
  "any",
];

function detectTaskMode(options: FulfillmentOption[]): TaskMode {
  const mode = options[0]?.mode;
  if (mode === "REMOTE") return "remote";
  if (mode === "ROUTE") return "route";
  if (mode === "ONSITE") return "onsite";
  return "pickup";
}

function detectServiceMode(options: FulfillmentOption[]): ServiceMode {
  return options[0]?.mode === "REMOTE" ? "remote" : "onsite";
}

function placeOf(options: FulfillmentOption[]): string {
  for (const opt of options) {
    if ("place" in opt && opt.place?.publicLabel) return opt.place.publicLabel;
  }
  return "";
}

function routeOf(options: FulfillmentOption[]): { from: string; to: string } {
  const route = options.find((o) => o.mode === "ROUTE");
  if (route && route.mode === "ROUTE") {
    return {
      from: route.from.publicLabel,
      to: route.to.publicLabel,
    };
  }
  return { from: "", to: "" };
}

export function DemandEditPage() {
  const { demandId = "" } = useParams();
  const navigate = useNavigate();
  const { getDemand, updateDemand, currentUser, busy } = useDan();
  const demand = getDemand(demandId);

  const [title, setTitle] = useState(demand?.title ?? "");
  const [description, setDescription] = useState(demand?.description ?? "");
  const [budget, setBudget] = useState(
    demand ? digitsOnly(String(demand.budget)) : "",
  );
  const [condition, setCondition] = useState<ConditionPreference>(
    demand?.type === "BUY" ? demand.details.conditionPreference : "any",
  );
  const [buyShipping, setBuyShipping] = useState(
    () =>
      Boolean(
        demand?.type === "BUY" &&
          demand.fulfillmentOptions.some((o) => o.mode === "SHIPPING"),
      ),
  );
  const [buyMeetup, setBuyMeetup] = useState(
    () =>
      Boolean(
        demand?.type === "BUY" &&
          demand.fulfillmentOptions.some((o) => o.mode === "MEETUP"),
      ),
  );
  const [meetupPlace, setMeetupPlace] = useState(
    demand?.type === "BUY" ? placeOf(demand.fulfillmentOptions) : "",
  );
  const [borrowPlace, setBorrowPlace] = useState(
    demand?.type === "BORROW" ? placeOf(demand.fulfillmentOptions) : "",
  );
  const [borrowStart, setBorrowStart] = useState(
    demand?.type === "BORROW" ? toDatetimeLocalValue(demand.details.startAt) : "",
  );
  const [borrowEnd, setBorrowEnd] = useState(
    demand?.type === "BORROW" ? toDatetimeLocalValue(demand.details.endAt) : "",
  );
  const [itemName, setItemName] = useState(
    demand?.type === "BORROW" ? demand.details.itemName : "",
  );
  const [taskMode, setTaskMode] = useState<TaskMode>(
    demand?.type === "TASK" ? detectTaskMode(demand.fulfillmentOptions) : "pickup",
  );
  const [taskPlace, setTaskPlace] = useState(
    demand?.type === "TASK" ? placeOf(demand.fulfillmentOptions) : "",
  );
  const initialRoute =
    demand?.type === "TASK" ? routeOf(demand.fulfillmentOptions) : { from: "", to: "" };
  const [routeFrom, setRouteFrom] = useState(initialRoute.from);
  const [routeTo, setRouteTo] = useState(initialRoute.to);
  const [dueAt, setDueAt] = useState(
    demand?.type === "TASK" ? toDatetimeLocalValue(demand.details.dueAt) : "",
  );
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    demand?.type === "SERVICE"
      ? detectServiceMode(demand.fulfillmentOptions)
      : "onsite",
  );
  const [servicePlace, setServicePlace] = useState(
    demand?.type === "SERVICE" ? placeOf(demand.fulfillmentOptions) : "",
  );
  const [preferredAt, setPreferredAt] = useState(
    demand?.type === "SERVICE"
      ? toDatetimeLocalValue(demand.details.preferredAt)
      : "",
  );
  const [error, setError] = useState<string | null>(null);

  const fulfillmentOptions = useMemo((): FulfillmentOption[] => {
    if (!demand) return [];
    if (demand.type === "BUY") {
      const opts: FulfillmentOption[] = [];
      if (buyShipping) opts.push({ mode: "SHIPPING" });
      if (buyMeetup) {
        opts.push({ mode: "MEETUP", place: placeFromLabel(meetupPlace) });
      }
      return opts;
    }
    if (demand.type === "BORROW") {
      return [{ mode: "PICKUP", place: placeFromLabel(borrowPlace) }];
    }
    if (demand.type === "TASK") {
      if (taskMode === "remote") return [{ mode: "REMOTE" }];
      if (taskMode === "route") {
        return [
          {
            mode: "ROUTE",
            from: placeFromLabel(routeFrom),
            to: placeFromLabel(routeTo),
          },
        ];
      }
      if (taskMode === "onsite") {
        return [{ mode: "ONSITE", place: placeFromLabel(taskPlace) }];
      }
      return [{ mode: "PICKUP", place: placeFromLabel(taskPlace) }];
    }
    if (serviceMode === "remote") return [{ mode: "REMOTE" }];
    return [{ mode: "ONSITE", place: placeFromLabel(servicePlace) }];
  }, [
    demand,
    buyShipping,
    buyMeetup,
    meetupPlace,
    borrowPlace,
    taskMode,
    taskPlace,
    routeFrom,
    routeTo,
    serviceMode,
    servicePlace,
  ]);

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

  const current = demand;
  const price = parseMoneyInput(budget);
  const thought =
    current.type === "BUY"
      ? formatPriceThought(price, "buy")
      : current.type === "BORROW"
        ? formatPriceThought(price, "borrow")
        : formatPriceThought(price, "reward");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || price <= 0) {
      setError(ko.genericError);
      return;
    }
    if (current.type === "BORROW") {
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
    if (current.type === "TASK") {
      if (!dueAt.trim()) {
        setError(ko.timeRequiredError);
        return;
      }
      if (!isDatetimeLocalNotPast(dueAt)) {
        setError(ko.timePastError);
        return;
      }
    }
    if (current.type === "SERVICE") {
      if (!preferredAt.trim()) {
        setError(ko.timeRequiredError);
        return;
      }
      if (!isDatetimeLocalNotPast(preferredAt)) {
        setError(ko.timePastError);
        return;
      }
    }
    if (current.type === "BUY" && !(buyShipping || buyMeetup)) {
      setError(ko.genericError);
      return;
    }
    if (!areFulfillmentOptionsValid(fulfillmentOptions)) {
      setError(ko.genericError);
      return;
    }

    const scheduleRaw =
      current.type === "BORROW"
        ? fromDatetimeLocalValue(borrowEnd)
        : current.type === "TASK"
          ? fromDatetimeLocalValue(dueAt)
          : current.type === "SERVICE"
            ? fromDatetimeLocalValue(preferredAt)
            : null;
    const scheduleIso = scheduleRaw
      ? normalizeScheduleExpiryIso(scheduleRaw)
      : null;
    const expiresAt =
      current.type === "BUY"
        ? undefined
        : defaultExpiresAtIso(current.type, scheduleIso);

    const result = await updateDemand({
      demandId: current.id,
      title: title.trim(),
      description: description.trim(),
      budget: price,
      fulfillmentOptions: stripGeoFromFulfillmentOptions(fulfillmentOptions),
      expiresAt,
      maxPrice: current.type === "BUY" ? price : undefined,
      itemName:
        current.type === "BORROW" ? itemName.trim() || title.trim() : undefined,
      taskDescription:
        current.type === "TASK"
          ? description.trim() || current.details.taskDescription
          : undefined,
      serviceDescription:
        current.type === "SERVICE"
          ? description.trim() || current.details.serviceDescription
          : undefined,
      startAt:
        current.type === "BORROW"
          ? fromDatetimeLocalValue(borrowStart)
          : undefined,
      endAt: current.type === "BORROW" ? scheduleIso ?? undefined : undefined,
      dueAt: current.type === "TASK" ? scheduleIso ?? undefined : undefined,
      preferredAt:
        current.type === "SERVICE" ? scheduleIso ?? undefined : undefined,
      conditionPreference: current.type === "BUY" ? condition : undefined,
      tradeMethod:
        current.type === "BUY"
          ? buyShipping && buyMeetup
            ? "any"
            : buyShipping
              ? "shipping"
              : "meetup"
          : undefined,
    });
    if (!result) {
      setError(ko.genericError);
      return;
    }
    navigate(`/demand/item/${current.id}`);
  }

  return (
    <div className="page-stack page-narrow">
      <form className="section-stack create-page__body" onSubmit={(e) => void onSave(e)}>
        <Field label={ko.titleLabel}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field>

        {current.type === "BORROW" ? (
          <Field label={ko.itemName}>
            <TextInput
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </Field>
        ) : null}

        {current.type === "TASK" || current.type === "SERVICE" ? (
          <Field label={ko.descLabel}>
            <textarea
              className="dan-input dan-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
        ) : (
          <Field label={ko.descLabel}>
            <textarea
              className="dan-input dan-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
        )}

        <Field
          label={budgetLabelForType(current.type)}
          hint={current.type === "BORROW" ? ko.borrowBudgetHint : undefined}
        >
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(budget)}
            onChange={(e) => setBudget(digitsOnly(e.target.value))}
            required
          />
          {thought ? <p className="price-thought">{thought}</p> : null}
        </Field>

        {current.type === "BUY" ? (
          <>
            <div>
              <p className="field-inline-label">{ko.condition}</p>
              <ChipGroup>
                {CONDITIONS.map((c) => (
                  <Chip
                    key={c}
                    selected={condition === c}
                    onClick={() => setCondition(c)}
                  >
                    {CONDITION_LABEL[c]}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
            <div>
              <p className="field-inline-label">{ko.tradeMethod}</p>
              <ChipGroup>
                <Chip
                  selected={buyShipping}
                  onClick={() => setBuyShipping((v) => !v)}
                >
                  {ko.buyShippingOpt}
                </Chip>
                <Chip
                  selected={buyMeetup}
                  onClick={() => setBuyMeetup((v) => !v)}
                >
                  {ko.buyMeetupOpt}
                </Chip>
              </ChipGroup>
            </div>
            {buyMeetup ? (
              <Field label={ko.buyMeetupWhere}>
                <TextInput
                  value={meetupPlace}
                  onChange={(e) => setMeetupPlace(e.target.value)}
                  placeholder={ko.locationPh}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {current.type === "BORROW" ? (
          <>
            <Field label={ko.borrowWhere}>
              <TextInput
                value={borrowPlace}
                onChange={(e) => setBorrowPlace(e.target.value)}
                placeholder={ko.locationPh}
              />
            </Field>
            <Field label={ko.borrowStart}>
              <DatetimeLocalInput
                value={borrowStart}
                onChange={setBorrowStart}
                required
              />
            </Field>
            <Field label={ko.borrowEnd}>
              <DatetimeLocalInput
                value={borrowEnd}
                onChange={setBorrowEnd}
                required
              />
            </Field>
          </>
        ) : null}

        {current.type === "TASK" ? (
          <>
            <div>
              <p className="field-inline-label">{ko.taskHow}</p>
              <ChipGroup>
                <Chip
                  selected={taskMode === "onsite"}
                  onClick={() => setTaskMode("onsite")}
                >
                  {ko.taskModeOnsite}
                </Chip>
                <Chip
                  selected={taskMode === "pickup"}
                  onClick={() => setTaskMode("pickup")}
                >
                  {ko.taskModePickup}
                </Chip>
                <Chip
                  selected={taskMode === "route"}
                  onClick={() => setTaskMode("route")}
                >
                  {ko.taskModeRoute}
                </Chip>
                <Chip
                  selected={taskMode === "remote"}
                  onClick={() => setTaskMode("remote")}
                >
                  {ko.taskModeRemote}
                </Chip>
              </ChipGroup>
            </div>
            {taskMode === "route" ? (
              <div className="route-fields">
                <Field label={ko.taskRouteFrom}>
                  <TextInput
                    value={routeFrom}
                    onChange={(e) => setRouteFrom(e.target.value)}
                    placeholder={ko.placePh}
                  />
                </Field>
                <span className="route-arrow" aria-hidden>
                  {ko.routeArrow}
                </span>
                <Field label={ko.taskRouteTo}>
                  <TextInput
                    value={routeTo}
                    onChange={(e) => setRouteTo(e.target.value)}
                    placeholder={ko.placePh}
                  />
                </Field>
              </div>
            ) : null}
            {taskMode === "onsite" || taskMode === "pickup" ? (
              <Field
                label={
                  taskMode === "pickup" ? ko.taskPickupPlace : ko.taskPlace
                }
              >
                <TextInput
                  value={taskPlace}
                  onChange={(e) => setTaskPlace(e.target.value)}
                  placeholder={ko.locationPh}
                />
              </Field>
            ) : null}
            <Field label={ko.dueAt}>
              <DatetimeLocalInput
                value={dueAt}
                onChange={setDueAt}
                required
              />
            </Field>
          </>
        ) : null}

        {current.type === "SERVICE" ? (
          <>
            <div>
              <p className="field-inline-label">{ko.fulfillHow}</p>
              <ChipGroup>
                <Chip
                  selected={serviceMode === "onsite"}
                  onClick={() => setServiceMode("onsite")}
                >
                  {ko.serviceOnsite}
                </Chip>
                <Chip
                  selected={serviceMode === "remote"}
                  onClick={() => setServiceMode("remote")}
                >
                  {ko.serviceRemote}
                </Chip>
              </ChipGroup>
            </div>
            {serviceMode === "onsite" ? (
              <Field label={ko.servicePlace}>
                <TextInput
                  value={servicePlace}
                  onChange={(e) => setServicePlace(e.target.value)}
                  placeholder={ko.locationPh}
                />
              </Field>
            ) : null}
            <Field label={ko.preferredAt}>
              <DatetimeLocalInput
                value={preferredAt}
                onChange={setPreferredAt}
                required
              />
            </Field>
          </>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? ko.saving : ko.saveDemand}
        </Button>
      </form>
    </div>
  );
}
