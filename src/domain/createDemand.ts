import type { ConditionPreference, DemandType, TradeMethod } from "./types";
import type { FulfillmentOption } from "./fulfillment";

export type CreateDemandInput =
  | {
      type: "BUY";
      title: string;
      description?: string;
      productId: string;
      maxPrice: number;
      conditionPreference: ConditionPreference;
      fulfillmentOptions: FulfillmentOption[];
      /** Optional override; normally derived from fulfillmentOptions. */
      tradeMethod?: TradeMethod;
    }
  | {
      type: "BORROW";
      title: string;
      description?: string;
      itemName: string;
      budget: number;
      fulfillmentOptions: FulfillmentOption[];
      startAt?: string;
      endAt?: string;
    }
  | {
      type: "TASK";
      title: string;
      description?: string;
      taskDescription: string;
      budget: number;
      fulfillmentOptions: FulfillmentOption[];
      dueAt?: string;
    }
  | {
      type: "SERVICE";
      title: string;
      description?: string;
      serviceDescription: string;
      budget: number;
      fulfillmentOptions: FulfillmentOption[];
      preferredAt?: string;
      estimatedDurationMinutes?: number;
    };

export type { DemandType };
