import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip, ChipGroup, DatetimeLocalInput, Field, TextInput } from "@/components/ui/Input";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDanLocale } from "@/i18n/locale";
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
import { conditionLabel } from "@/i18n/categories";
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
  const copy = useDanCopy();
  const locale = useDanLocale();
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
        title={copy.missingDemand}
        action={<Button to="/my" variant="secondary">{copy.navMy}</Button>}
      />
    );
  }

  if (demand.status !== "ACTIVE") {
    return (
      <EmptyState
        title={copy.demandClosed}
        action={
          <Button to={`/demand/item/${demand.id}`} variant="secondary">
            {copy.goBack}
          </Button>
        }
      />
    );
  }

  const current = demand;
  const price = parseMoneyInput(budget);
  const thought =
    current.type === "BUY"
      ? formatPriceThought(price, "buy", locale)
      : current.type === "BORROW"
        ? formatPriceThought(price, "borrow", locale)
        : formatPriceThought(price, "reward", locale);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const nextTitle =
      current.type === "BORROW"
        ? itemName.trim()
        : current.type === "TASK"
          ? description.trim().split("\n")[0].slice(0, 60)
          : title.trim();
    if (!nextTitle || price <= 0) {
      setError(copy.genericError);
      return;
    }
    if (current.type === "BORROW") {
      if (!borrowStart.trim() || !borrowEnd.trim()) {
        setError(copy.timeRequiredError);
        return;
      }
      if (!isBorrowRangeValid(borrowStart, borrowEnd)) {
        setError(copy.borrowRangeError);
        return;
      }
      if (
        !isDatetimeLocalNotPast(borrowStart) ||
        !isDatetimeLocalNotPast(borrowEnd)
      ) {
        setError(copy.timePastError);
        return;
      }
    }
    if (current.type === "TASK") {
      if (!dueAt.trim()) {
        setError(copy.timeRequiredError);
        return;
      }
      if (!isDatetimeLocalNotPast(dueAt)) {
        setError(copy.timePastError);
        return;
      }
    }
    if (current.type === "SERVICE") {
      if (!preferredAt.trim()) {
        setError(copy.timeRequiredError);
        return;
      }
      if (!isDatetimeLocalNotPast(preferredAt)) {
        setError(copy.timePastError);
        return;
      }
    }
    if (current.type === "BUY" && !(buyShipping || buyMeetup)) {
      setError(copy.genericError);
      return;
    }
    if (!areFulfillmentOptionsValid(fulfillmentOptions)) {
      setError(copy.genericError);
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

    try {
      const result = await updateDemand({
        demandId: current.id,
        title: nextTitle,
        description: description.trim(),
        budget: price,
        fulfillmentOptions: stripGeoFromFulfillmentOptions(fulfillmentOptions),
        expiresAt,
        maxPrice: current.type === "BUY" ? price : undefined,
        itemName:
          current.type === "BORROW" ? itemName.trim() : undefined,
        taskDescription:
          current.type === "TASK" ? description.trim() : undefined,
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
        setError(copy.genericError);
        return;
      }
      navigate(`/demand/item/${current.id}`);
    } catch {
      setError(copy.genericError);
    }
  }

  return (
    <div className="page-stack page-narrow">
      <form className="section-stack create-page__body request-edit-form" onSubmit={(e) => void onSave(e)}>
        <div className="create-page__prompt">
          <p className="create-page__kicker">
            {locale === "ja" ? "依頼を編集" : "요청 수정"}
          </p>
          <h1 className="section-title">
            {current.type === "BUY"
              ? locale === "ja"
                ? "探している物の条件を変更しますか？"
                : "찾는 물건의 조건을 수정할까요?"
              : current.type === "BORROW"
                ? locale === "ja"
                  ? "借りる物の条件を変更しますか？"
                  : "빌릴 물건의 조건을 수정할까요?"
                : current.type === "TASK"
                  ? locale === "ja"
                    ? "お願い内容を変更しますか？"
                    : "부탁할 내용을 수정할까요?"
                  : locale === "ja"
                    ? "サービスの条件を変更しますか？"
                    : "필요한 서비스 조건을 수정할까요?"}
          </h1>
        </div>

        {current.type === "BUY" ? (
          <div className="request-edit-primary">
            <span>{locale === "ja" ? "商品" : "제품"}</span>
            <strong>{title}</strong>
          </div>
        ) : current.type === "BORROW" ? (
          <Field label={locale === "ja" ? "借りたい物" : "빌릴 물건"}>
            <TextInput
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </Field>
        ) : current.type === "TASK" ? (
          <Field label={locale === "ja" ? "お願いしたい内容" : "부탁할 일"}>
            <textarea
              className="dan-input dan-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </Field>
        ) : (
          <Field label={locale === "ja" ? "必要なサービス" : "필요한 서비스"}>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
        )}

        {current.type !== "TASK" ? (
          <Field
            label={
              current.type === "SERVICE"
                ? locale === "ja"
                  ? "追加説明"
                  : "추가 설명"
                : locale === "ja"
                  ? "追加条件"
                  : "추가 조건"
            }
          >
            <textarea
              className="dan-input dan-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={
                locale === "ja" ? "任意事項を記入してください" : "선택 사항을 적어주세요"
              }
            />
          </Field>
        ) : null}

        <Field
          label={budgetLabelForType(current.type, locale)}
          hint={current.type === "BORROW" ? copy.borrowBudgetHint : undefined}
        >
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(budget, locale)}
            onChange={(e) => setBudget(digitsOnly(e.target.value))}
            required
          />
          {thought ? <p className="price-thought">{thought}</p> : null}
        </Field>

        {current.type === "BUY" ? (
          <>
            <div>
              <p className="field-inline-label">{copy.condition}</p>
              <ChipGroup>
                {CONDITIONS.map((c) => (
                  <Chip
                    key={c}
                    selected={condition === c}
                    onClick={() => setCondition(c)}
                  >
                    {conditionLabel(locale, c)}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
            <div>
              <p className="field-inline-label">{copy.tradeMethod}</p>
              <ChipGroup>
                <Chip
                  selected={buyShipping}
                  onClick={() => setBuyShipping((v) => !v)}
                >
                  {copy.buyShippingOpt}
                </Chip>
                <Chip
                  selected={buyMeetup}
                  onClick={() => setBuyMeetup((v) => !v)}
                >
                  {copy.buyMeetupOpt}
                </Chip>
              </ChipGroup>
            </div>
            {buyMeetup ? (
              <Field label={copy.buyMeetupWhere}>
                <TextInput
                  value={meetupPlace}
                  onChange={(e) => setMeetupPlace(e.target.value)}
                  placeholder={copy.locationPh}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {current.type === "BORROW" ? (
          <>
            <Field label={copy.borrowWhere}>
              <TextInput
                value={borrowPlace}
                onChange={(e) => setBorrowPlace(e.target.value)}
                placeholder={copy.locationPh}
              />
            </Field>
            <Field label={copy.borrowStart}>
              <DatetimeLocalInput
                value={borrowStart}
                onChange={setBorrowStart}
                required
              />
            </Field>
            <Field label={copy.borrowEnd}>
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
              <p className="field-inline-label">{copy.taskHow}</p>
              <ChipGroup>
                <Chip
                  selected={taskMode === "onsite"}
                  onClick={() => setTaskMode("onsite")}
                >
                  {copy.taskModeOnsite}
                </Chip>
                <Chip
                  selected={taskMode === "pickup"}
                  onClick={() => setTaskMode("pickup")}
                >
                  {copy.taskModePickup}
                </Chip>
                <Chip
                  selected={taskMode === "route"}
                  onClick={() => setTaskMode("route")}
                >
                  {copy.taskModeRoute}
                </Chip>
                <Chip
                  selected={taskMode === "remote"}
                  onClick={() => setTaskMode("remote")}
                >
                  {copy.taskModeRemote}
                </Chip>
              </ChipGroup>
            </div>
            {taskMode === "route" ? (
              <div className="route-fields">
                <Field label={copy.taskRouteFrom}>
                  <TextInput
                    value={routeFrom}
                    onChange={(e) => setRouteFrom(e.target.value)}
                    placeholder={copy.placePh}
                  />
                </Field>
                <span className="route-arrow" aria-hidden>
                  {copy.routeArrow}
                </span>
                <Field label={copy.taskRouteTo}>
                  <TextInput
                    value={routeTo}
                    onChange={(e) => setRouteTo(e.target.value)}
                    placeholder={copy.placePh}
                  />
                </Field>
              </div>
            ) : null}
            {taskMode === "onsite" || taskMode === "pickup" ? (
              <Field
                label={
                  taskMode === "pickup" ? copy.taskPickupPlace : copy.taskPlace
                }
              >
                <TextInput
                  value={taskPlace}
                  onChange={(e) => setTaskPlace(e.target.value)}
                  placeholder={copy.locationPh}
                />
              </Field>
            ) : null}
            <Field label={copy.dueAt}>
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
              <p className="field-inline-label">{copy.fulfillHow}</p>
              <ChipGroup>
                <Chip
                  selected={serviceMode === "onsite"}
                  onClick={() => setServiceMode("onsite")}
                >
                  {copy.serviceOnsite}
                </Chip>
                <Chip
                  selected={serviceMode === "remote"}
                  onClick={() => setServiceMode("remote")}
                >
                  {copy.serviceRemote}
                </Chip>
              </ChipGroup>
            </div>
            {serviceMode === "onsite" ? (
              <Field label={copy.servicePlace}>
                <TextInput
                  value={servicePlace}
                  onChange={(e) => setServicePlace(e.target.value)}
                  placeholder={copy.locationPh}
                />
              </Field>
            ) : null}
            <Field label={copy.preferredAt}>
              <DatetimeLocalInput
                value={preferredAt}
                onChange={setPreferredAt}
                required
              />
            </Field>
          </>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? copy.saving : copy.saveDemand}
        </Button>
      </form>
    </div>
  );
}
