"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { usePreferences } from "@/hooks/use-preferences";

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { preferences } = usePreferences();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>

                    <DialogDescription>
                        These apply everywhere and are saved as you go.
                    </DialogDescription>
                </DialogHeader>

                {/* Keyed so re-opening starts from the saved values. */}
                <PreferencesForm
                    key={JSON.stringify(preferences)}
                    preferences={preferences}
                    onSaved={() => onOpenChange(false)}
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
