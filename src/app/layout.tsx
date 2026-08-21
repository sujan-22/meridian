import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApolloWrapper } from "@/lib/apollo/apollo-wrapper";

const geistSans = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

// Durations, clocks and ticket numbers are all read as columns of digits, so
// the mono face earns its place.
const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
});

const DESCRIPTION =
    "Quarter-hour time tracking built around one workflow: track the week, then fill the Friday timesheet in minutes.";

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),

    applicationName: "Quanta",

    title: {
        default: "Quanta",
        template: "%s · Quanta",
    },

    description: DESCRIPTION,

    authors: [{ name: "Sujan Rokad" }],
    creator: "Sujan Rokad",
    publisher: "Sujan Rokad",

    keywords: [
        "time tracking",
        "timesheet",
        "quarter hour",
        "billable hours",
        "Polaris",
    ],

    openGraph: {
        type: "website",
        siteName: "Quanta",
        title: "Quanta",
        description: DESCRIPTION,
    },

    // A private, single-user app - there is nothing here to index.
    robots: {
        index: false,
        follow: false,
    },
};

export const viewport: Viewport = {
    colorScheme: "dark",
    themeColor: "#12121a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            // `dark` lives here rather than on <body> so the theme variables
            // resolve for the html background too, not just its descendants.
            className={cn(
                "h-full dark antialiased",
                geistSans.variable,
                geistMono.variable,
            )}
        >
            <body className="flex min-h-full flex-col">
                <ApolloWrapper>
                    <TooltipProvider>
                        <Toaster>{children}</Toaster>
                    </TooltipProvider>
                </ApolloWrapper>
            </body>
        </html>
    );
}
