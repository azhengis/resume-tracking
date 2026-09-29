import { TRACKER_STATUSES, type TrackerEntry } from "@/lib/types";

export default function DashboardTab({ entries }: { entries: TrackerEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted">
          Nothing tracked yet — evaluate a job and save it to see numbers here.
        </p>
      </div>
    );
  }

  const counts = TRACKER_STATUSES.map((status) => ({
    status,
    count: entries.filter((e) => e.status === status).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  const total = entries.length;

  const rejected = counts.find((c) => c.status === "Rejected")?.count ?? 0;
  const offers = counts.find((c) => c.status === "Offer")?.count ?? 0;
  const responded = total - (counts.find((c) => c.status === "Evaluated")?.count ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <div className="text-[56px] font-semibold leading-none text-ink">{total}</div>
        <div className="mt-2 text-sm text-muted">applications tracked</div>
      </div>

      <div className="space-y-3">
        {counts.map(({ status, count }) => {
          const pct = (count / max) * 100;
          return (
            <div key={status} className="group flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-muted">{status}</span>
              <div className="flex flex-1 items-center">
                <div
                  className="h-6 rounded-r-[4px] bg-accent transition-opacity group-hover:opacity-75"
                  style={{
                    width: `${pct}%`,
                    minWidth: count > 0 ? "4px" : 0,
                  }}
                />
                <span className="ml-2 text-sm font-semibold tabular-nums text-ink">{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6 border-t border-border pt-6">
        <div>
          <div className="text-2xl font-semibold text-ink">{responded}</div>
          <div className="mt-1 text-xs text-muted">applied or further</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-ink">{offers}</div>
          <div className="mt-1 text-xs text-muted">offers</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-ink">{rejected}</div>
          <div className="mt-1 text-xs text-muted">rejected</div>
        </div>
      </div>
    </div>
  );
}
