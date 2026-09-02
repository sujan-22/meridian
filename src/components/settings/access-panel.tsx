"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
    AllowAccountDocument,
    AllowedAccountsDocument,
    RevokeAccountDocument,
} from "@/gql/graphql";

/**
 * Who can sign in.
 *
 * This is the list that actually protects the data - the access code only
 * decides who reaches the sign-in page. Anyone on this list can edit it, which
 * is the right trade for a tool shared with a couple of colleagues.
 */
export function AccessPanel() {
    const { data, loading } = useQuery(AllowedAccountsDocument);
    const [email, setEmail] = useState("");

    const options = { refetchQueries: [AllowedAccountsDocument] };
    const [allow, allowState] = useMutation(AllowAccountDocument, options);
    const [revoke] = useMutation(RevokeAccountDocument, options);

    const accounts = data?.allowedAccounts ?? [];

    async function add(event: React.FormEvent) {
        event.preventDefault();

        try {
            await allow({ variables: { email, note: null } });

            setEmail("");
            toast.add({ title: "Access granted", type: "success" });
        } catch (error) {
            toast.add({
                title: "Could not add that address",
                description: error instanceof Error ? error.message : undefined,
                type: "error",
            });
        }
    }

    return (
        <div className="rounded-xl border border-border/70 bg-card p-5">
            <div className="mb-4 flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-4" />
                </div>

                <div className="min-w-0">
                    <h3 className="text-sm font-medium">Who can sign in</h3>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Only these Google accounts can get in. The access code
                        just opens the sign-in page — this is the list that
                        protects the data.
                    </p>
                </div>
            </div>

            <form onSubmit={add} className="mb-4 flex gap-2">
                <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@evenica.com"
                    className="h-9"
                />

                <Button
                    type="submit"
                    size="sm"
                    disabled={!email.trim() || allowState.loading}
                >
                    Add
                </Button>
            </form>

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
                <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                    {accounts.map((account) => (
                        <li
                            key={account.email}
                            className="flex items-center gap-2 px-3 py-2"
                        >
                            <span className="min-w-0 flex-1 truncate text-sm">
                                {account.email}
                            </span>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove ${account.email}`}
                                onClick={() => {
                                    void revoke({
                                        variables: { email: account.email },
                                    }).catch((error: unknown) => {
                                        toast.add({
                                            title: "Could not remove that address",
                                            description:
                                                error instanceof Error
                                                    ? error.message
                                                    : undefined,
                                            type: "error",
                                        });
                                    });
                                }}
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                Anyone added here also has to be a test user on the Google OAuth
                app, or Google will refuse the sign-in before this list is ever
                consulted.
            </p>
        </div>
    );
}
