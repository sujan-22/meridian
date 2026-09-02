/**
 * Reading meetings out of Google Calendar.
 *
 * Only the primary calendar, only within a window, and only the things that
 * are actually a meeting someone sat in: declined invitations, cancellations
 * and all-day blocks are all dropped here rather than being stored and then
 * filtered everywhere they are read.
 */

const EVENTS_URL =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Google caps this at 2500; a week never needs more than one page of 250. */
const PAGE_SIZE = 250;

export interface GoogleCalendarEvent {
    googleEventId: string;
    calendarId: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
}

interface RawEvent {
    id?: string;
    status?: string;
    summary?: string;
    organizer?: { email?: string };
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ self?: boolean; responseStatus?: string }>;
    eventType?: string;
}

export class GoogleCalendarError extends Error {
    constructor(
        message: string,
        readonly status: number,
        /** Google says the token is valid but does not cover the calendar. */
        readonly insufficientScope = false,
    ) {
        super(message);
        this.name = "GoogleCalendarError";
    }
}

/** Whether the person whose calendar this is said no to the invitation. */
function declined(event: RawEvent): boolean {
    return (event.attendees ?? []).some(
        (attendee) => attendee.self && attendee.responseStatus === "declined",
    );
}

/**
 * Turns one Google event into ours, or null if it is not a meeting we can
 * place on a calendar column.
 */
function toEvent(event: RawEvent): GoogleCalendarEvent | null {
    if (!event.id || event.status === "cancelled") {
        return null;
    }

    // All-day entries carry `date` rather than `dateTime`. They are holidays
    // and out-of-office blocks, not meetings, and would swallow the column.
    const start = event.start?.dateTime;
    const end = event.end?.dateTime;

    if (!start || !end) {
        return null;
    }

    if (declined(event)) {
        return null;
    }

    const startsAt = new Date(start);
    const endsAt = new Date(end);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return null;
    }

    if (endsAt <= startsAt) {
        return null;
    }

    return {
        googleEventId: event.id,
        calendarId: event.organizer?.email ?? "primary",
        title: event.summary?.trim() || "(no title)",
        startsAt,
        endsAt,
    };
}

export async function fetchCalendarEvents(
    accessToken: string,
    from: Date,
    to: Date,
): Promise<GoogleCalendarEvent[]> {
    const events: GoogleCalendarEvent[] = [];

    let pageToken: string | undefined;

    do {
        const url = new URL(EVENTS_URL);

        url.searchParams.set("timeMin", from.toISOString());
        url.searchParams.set("timeMax", to.toISOString());
        // Expands a recurring meeting into the individual occurrences, which
        // is what a week view needs.
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", String(PAGE_SIZE));

        if (pageToken) {
            url.searchParams.set("pageToken", pageToken);
        }

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");

            // Google distinguishes "this token is no good" from "this token is
            // fine but does not cover the calendar", and only the second is
            // fixed by granting the permission again.
            const insufficientScope =
                response.status === 403 &&
                /insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/i.test(
                    body,
                );

            throw new GoogleCalendarError(
                insufficientScope
                    ? "Google accepted the sign-in but not the calendar permission. Sign in again and allow calendar access."
                    : response.status === 401
                      ? "Google would not accept the calendar request. Sign in again."
                      : `Google Calendar returned ${response.status}. ${body.slice(0, 200)}`,
                response.status,
                insufficientScope,
            );
        }

        const payload = (await response.json()) as {
            items?: RawEvent[];
            nextPageToken?: string;
        };

        for (const raw of payload.items ?? []) {
            const event = toEvent(raw);

            if (event) {
                events.push(event);
            }
        }

        pageToken = payload.nextPageToken;
    } while (pageToken);

    return events;
}
