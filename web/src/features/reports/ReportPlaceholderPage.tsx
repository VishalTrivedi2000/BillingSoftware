type Props = {
  title: string;
  bullets: string[];
};

export function ReportPlaceholderPage({ title, bullets }: Props) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1">
      <div>
        <p className="text-sm font-medium text-blue-400/90">Reports</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">This report type is on the roadmap — behaviour similar to Vyapar-style accounting exports.</p>
      </div>
      <div className="workspace-panel px-6 py-6">
        <p className="text-sm font-semibold text-slate-200">Planned capabilities</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
