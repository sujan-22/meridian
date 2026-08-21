interface PagePlaceholderProps {
    title: string;
    description: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
    return (
        <div className="mx-auto w-full max-w-[1600px] px-5 py-6 lg:px-8">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>

            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
