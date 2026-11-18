function percent(conversions, impressions) {
  if (!impressions) return "—";
  return `${((conversions / impressions) * 100).toFixed(1)}%`;
}

export default function ExperimentCard({ experiment, onPromote, onDelete, busy }) {
  const totals = experiment.variants.reduce((summary, variant) => {
    summary.impressions += variant.impressions ?? 0;
    summary.conversions += variant.conversions ?? 0;
    return summary;
  }, { impressions: 0, conversions: 0 });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{experiment.title}</h2>
            <span className={`status-pill status-${experiment.status}`}>{experiment.status}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{experiment.hypothesis}</p>
        </div>
        <button className="button-quiet text-rose-600 hover:bg-rose-50" onClick={() => onDelete(experiment.id)} disabled={busy}>
          Delete
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-tile"><span className="stat-label">Impressions</span><strong>{totals.impressions}</strong></div>
        <div className="stat-tile"><span className="stat-label">Conversions</span><strong>{totals.conversions}</strong></div>
        <div className="stat-tile"><span className="stat-label">Conversion rate</span><strong>{percent(totals.conversions, totals.impressions)}</strong></div>
        <div className="stat-tile"><span className="stat-label">Variants</span><strong>{experiment.variants.length}</strong></div>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        {experiment.variants.map((variant) => {
          const impressions = variant.impressions ?? 0;
          const conversions = variant.conversions ?? 0;
          return (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={variant.id}>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {variant.name} {variant.isDefault && <span className="ml-1 text-xs font-medium text-emerald-700">Current default</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">{variant.content}</p>
              </div>
              <p className="text-sm text-slate-600">{conversions} / {impressions} conversions · {percent(conversions, impressions)}</p>
              {!variant.isDefault && (
                <button className="button-secondary" disabled={busy} onClick={() => onPromote(experiment.id, variant.id)}>
                  Promote winner
                </button>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
