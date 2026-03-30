"use client";

interface Props {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-500/50">
          Coming Soon
        </div>
        <div className="mt-3 text-2xl font-bold text-white">{title}</div>
        <div className="mt-3 text-[14px] text-slate-400">{description}</div>
      </div>
    </div>
  );
}
