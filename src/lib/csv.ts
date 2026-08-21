/**
 * A minimal RFC 4180 CSV reader.
 *
 * Toggl descriptions routinely contain commas, quotes and dashes, so the
 * fields cannot simply be split - they have to be parsed.
 */

export function parseCsv(text: string): string[][] {
    // Excel and Toggl both prefix exports with a byte order mark, which would
    // otherwise end up glued to the first column name.
    const input = text.replace(/^﻿/, "");

    const rows: string[][] = [];

    let row: string[] = [];
    let field = "";
    let quoted = false;
    let index = 0;
    let sawField = false;

    const endField = () => {
        row.push(field);
        field = "";
        sawField = false;
    };

    const endRow = () => {
        endField();

        // Skip the blank row a trailing newline produces.
        if (row.length > 1 || row[0] !== "") {
            rows.push(row);
        }

        row = [];
    };

    while (index < input.length) {
        const char = input[index];

        if (quoted) {
            if (char === '"') {
                if (input[index + 1] === '"') {
                    field += '"';
                    index += 2;

                    continue;
                }

                quoted = false;
                index += 1;

                continue;
            }

            field += char;
            index += 1;

            continue;
        }

        if (char === '"' && !sawField) {
            quoted = true;
            sawField = true;
            index += 1;

            continue;
        }

        if (char === ",") {
            endField();
            index += 1;

            continue;
        }

        if (char === "\r") {
            index += 1;

            continue;
        }

        if (char === "\n") {
            endRow();
            index += 1;

            continue;
        }

        field += char;
        sawField = true;
        index += 1;
    }

    if (field !== "" || row.length > 0) {
        endRow();
    }

    return rows;
}

/** Rows keyed by header name, so column order never matters. */
export function parseCsvRecords(text: string): Array<Record<string, string>> {
    const [header, ...rest] = parseCsv(text);

    if (!header) {
        return [];
    }

    const columns = header.map((name) => name.trim());

    return rest.map((row) => {
        const record: Record<string, string> = {};

        columns.forEach((name, position) => {
            record[name] = row[position] ?? "";
        });

        return record;
    });
}
