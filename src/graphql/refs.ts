import type { AppBuilder } from "./builder";

import { billingTypeRef } from "./types/billing-type";
import { clientRef } from "./types/client";
import { entryKindRef } from "./types/entry-kind";
import { preferencesRef } from "./types/preferences";
import { projectRef } from "./types/project";
import { projectSummaryRef } from "./types/project-summary";
import { ticketSummaryRef } from "./types/ticket-summary";
import { timeEntryRef } from "./types/time-entry";
import { timesheetWeekRef } from "./types/timesheet-week";

/**
 * Every object and enum type, created in dependency order for one builder.
 * Field modules receive these rather than importing shared singletons.
 */
export function createRefs(builder: AppBuilder) {
    const BillingType = billingTypeRef(builder);
    const EntryKind = entryKindRef(builder);
    const Client = clientRef(builder);
    const Preferences = preferencesRef(builder);
    const TimesheetWeek = timesheetWeekRef(builder);

    const Project = projectRef(builder, { BillingType, Client });

    const ProjectSummary = projectSummaryRef(builder, { Project });
    const TicketSummary = ticketSummaryRef(builder, { Project });

    const TimeEntry = timeEntryRef(builder, {
        BillingType,
        EntryKind,
        Project,
    });

    return {
        BillingType,
        EntryKind,
        Client,
        Preferences,
        Project,
        ProjectSummary,
        TicketSummary,
        TimeEntry,
        TimesheetWeek,
    };
}

export type Refs = ReturnType<typeof createRefs>;
