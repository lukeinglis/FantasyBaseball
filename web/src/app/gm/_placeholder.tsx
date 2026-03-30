"use client";

interface Props {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600/50">
          Coming Soon
        </div>
        <div className="mt-3 text-2xl font-bold text-gray-900">{title}</div>
        <div className="mt-3 text-[14px] text-slate-500">{description}</div>
      </div>
    </div>
  );
}
