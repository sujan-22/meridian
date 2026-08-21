import { GraphQLError } from "graphql";

import {
    deleteTicketEstimate,
    findTicketSummaries,
    upsertTicketEstimate,
} from "@/db/queries/tickets";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

export function registerTicketMutations(builder: AppBuilder, refs: Refs) {
    const SetTicketEstimateInput = builder.inputType(
        "SetTicketEstimateInput",
        {
            fields: (t) => ({
                projectId: t.id({ required: true }),
                ticketNumber: t.string({ required: true }),
                minMinutes: t.int(),
                maxMinutes: t.int({ required: true }),
                notes: t.string(),
            }),
        },
    );

    async function reload(projectId: string, ticketNumber: string) {
        const summaries = await findTicketSummaries();

        const summary = summaries.find(
            (candidate) =>
                candidate.project.id === projectId &&
                candidate.ticketNumber === ticketNumber,
        );

        if (!summary) {
            throw new GraphQLError(
                `No tracked time for ticket ${ticketNumber} on that project.`,
            );
        }

        return summary;
    }

    builder.mutationFields((t) => ({
        setTicketEstimate: t.field({
            type: refs.TicketSummary,

            args: {
                input: t.arg({
                    type: SetTicketEstimateInput,
                    required: true,
                }),
            },

            resolve: async (_parent, { input }) => {
                const ticketNumber = input.ticketNumber.trim();
                const projectId = String(input.projectId);

                if (!ticketNumber) {
                    throw new GraphQLError("A ticket number is required");
                }

                if (input.maxMinutes <= 0) {
                    throw new GraphQLError(
                        "An estimate has to be more than zero hours",
                    );
                }

                if (
                    input.minMinutes != null &&
                    input.minMinutes > input.maxMinutes
                ) {
                    throw new GraphQLError(
                        "The low end of the estimate cannot exceed the high end",
                    );
                }

                await upsertTicketEstimate({
                    projectId,
                    ticketNumber,
                    minMinutes: input.minMinutes ?? null,
                    maxMinutes: input.maxMinutes,
                    notes: input.notes?.trim() || null,
                });

                return reload(projectId, ticketNumber);
            },
        }),

        clearTicketEstimate: t.field({
            type: refs.TicketSummary,

            args: {
                projectId: t.arg.id({ required: true }),
                ticketNumber: t.arg.string({ required: true }),
            },

            resolve: async (_parent, args) => {
                const projectId = String(args.projectId);
                const ticketNumber = args.ticketNumber.trim();

                await deleteTicketEstimate(projectId, ticketNumber);

                return reload(projectId, ticketNumber);
            },
        }),
    }));
}
