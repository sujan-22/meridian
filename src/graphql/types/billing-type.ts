import type { AppBuilder } from "../builder";

export function billingTypeRef(builder: AppBuilder) {
    return builder.enumType("BillingType", {
        values: {
            BILLABLE: {
                value: "billable",
            },
            NON_BILLABLE: {
                value: "non_billable",
            },
        } as const,
    });
}

export type BillingTypeRef = ReturnType<typeof billingTypeRef>;
