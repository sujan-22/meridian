"use client";

import { useMutation } from "@apollo/client/react";

import { toast } from "@/components/ui/toast";
import {
    ClientsDocument,
    CreateClientDocument,
    CreateProjectDocument,
    DeleteProjectDocument,
    ProjectSummariesDocument,
    ProjectsDocument,
    UpdateProjectDocument,
    type CreateClientInput,
    type CreateProjectInput,
    type UpdateProjectInput,
} from "@/gql/graphql";

/**
 * Anything that changes the catalog affects both the projects screen and the
 * pickers on the timer, so they refresh together.
 */
const mutationOptions = {
    refetchQueries: [ProjectSummariesDocument, ProjectsDocument, ClientsDocument],
    awaitRefetchQueries: true,
};

function reportFailure(action: string, error: unknown) {
    toast.add({
        title: `Could not ${action}`,
        description:
            error instanceof Error ? error.message : "Something went wrong",
        type: "error",
    });
}

export function useProjectActions() {
    const [createProjectMutation, createState] = useMutation(
        CreateProjectDocument,
        mutationOptions,
    );

    const [updateProjectMutation, updateState] = useMutation(
        UpdateProjectDocument,
        mutationOptions,
    );

    const [deleteProjectMutation, deleteState] = useMutation(
        DeleteProjectDocument,
        mutationOptions,
    );

    const [createClientMutation, clientState] = useMutation(
        CreateClientDocument,
        mutationOptions,
    );

    return {
        pending:
            createState.loading ||
            updateState.loading ||
            deleteState.loading ||
            clientState.loading,

        createProject: async (input: CreateProjectInput) => {
            try {
                await createProjectMutation({ variables: { input } });

                toast.add({ title: "Project created", type: "success" });

                return true;
            } catch (error) {
                reportFailure("create the project", error);

                return false;
            }
        },

        updateProject: async (id: string, input: UpdateProjectInput) => {
            try {
                await updateProjectMutation({ variables: { id, input } });

                return true;
            } catch (error) {
                reportFailure("update the project", error);

                return false;
            }
        },

        deleteProject: async (id: string) => {
            try {
                await deleteProjectMutation({ variables: { id } });

                toast.add({ title: "Project deleted", type: "success" });

                return true;
            } catch (error) {
                reportFailure("delete the project", error);

                return false;
            }
        },

        createClient: async (input: CreateClientInput) => {
            try {
                const result = await createClientMutation({
                    variables: { input },
                });

                return result.data?.createClient ?? null;
            } catch (error) {
                reportFailure("create the client", error);

                return null;
            }
        },
    };
}
