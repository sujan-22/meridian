import { createBuilder } from "./builder";
import { registerCalendarMutations } from "./mutations/calendar";
import { registerImportMutations } from "./mutations/import";
import { registerPreferencesMutations } from "./mutations/preferences";
import { registerProjectMutations } from "./mutations/projects";
import { registerTimeEntryMutations } from "./mutations/time-entries";
import { registerTicketMutations } from "./mutations/tickets";
import { registerTimesheetMutations } from "./mutations/timesheet";
import { registerCalendarQueries } from "./queries/calendar";
import { registerCatalogQueries } from "./queries/catalog";
import { registerTimeEntryQueries } from "./queries/time-entries";
import { createRefs } from "./refs";

/**
 * One fresh builder per build - see the note in `builder.ts` for why nothing
 * here is a module singleton.
 */
function buildSchema() {
    const builder = createBuilder();
    const refs = createRefs(builder);

    registerCatalogQueries(builder, refs);
    registerCalendarQueries(builder, refs);
    registerTimeEntryQueries(builder, refs);
    registerPreferencesMutations(builder, refs);
    registerProjectMutations(builder, refs);
    registerTimeEntryMutations(builder, refs);
    registerTimesheetMutations(builder, refs);
    registerTicketMutations(builder, refs);
    registerImportMutations(builder, refs);
    registerCalendarMutations(builder, refs);

    return builder.toSchema();
}

export const schema = buildSchema();
