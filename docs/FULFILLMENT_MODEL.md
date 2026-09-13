# DAN Fulfillment & Place Model

## Problem with `location: string`

A single residence-like string cannot express how a demand is fulfilled
(shipping vs meetup vs route vs remote) and conflates profile home with
the place where work actually happens.

## Place (public)

```ts
type Place = {
  publicLabel: string; // e.g. "평택역 근처"
  regionCode?: string;
  region1?: string;
  region2?: string;
  region3?: string;
  geo?: { lat: number; lng: number }; // optional; unused in V1 UI
};
```

Public feed only uses approximate labels. Exact private addresses are out of
scope until CONNECTED (future).

## Privacy (V1)

Public Demand never stores apartment unit / street address as a dedicated field.
Public labels only (e.g. "평택역 근처", "성수동"). Exact address handoff after
CONNECTED is **not** implemented in V1.

## FulfillmentOption

`REMOTE | SHIPPING | MEETUP | ONSITE | PICKUP | ROUTE` discriminated union.
A demand has `fulfillmentOptions: FulfillmentOption[]` because multiple modes
may apply (e.g. BUY shipping + meetup).

## Profile vs Demand

- `User.defaultArea` — input / filter default only
- `Demand.fulfillmentOptions` — matching/display truth for where/how

## Feed filters (V1)

`전체 | 내 주변 | 온라인` — nearby is **region-label based**, not GPS km.

## Supabase note

Migration `0006_fulfillment_options.sql` adds `demands.fulfillment_options` JSONB
as the structured source of truth. `demands.location` remains a denormalized
public summary for display/legacy. Profile `default_area_label` is form/filter
default only — never Demand fulfillment truth.
