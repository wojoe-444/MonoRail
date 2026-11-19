import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Workflow } from "lucide-react";

import { StatTile } from "@/components/charts/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCount } from "@/lib/format";
import { navigate } from "@/lib/router";

import { useCall } from "../api";
import { GROUPS, typeInfo } from "../catalog";
import { Owners, TypeTile } from "../parts";
import type { OmEntity, OmRef } from "../types";
import { ago, countOf, displayName, formatTime } from "../util";
import {
  DescriptionCard,
  EmptyNote,
  EntityHeader,
  ErrorNote,
  Fact,
  ListStates,
  LoadingNote,
  Muted,
  SimpleTable,
} from "./governance";
import { fqnOf, sortByName, useAll, type AllState } from "./governance-data";
import type { OmTabProps } from "./types";

/** The service entity types, in the Catalog's order. */
const SERVICE_TYPES = (GROUPS.find((g) => g.id === "services")?.types ?? [])
  .map((t) => t.type)
  .filter((t) => t !== "ingestionPipeline");

interface PipelineStatus {
  pipelineState?: string;
  startDate?: number;
  endDate?: number;
  timestamp?: number;
}

const STATE_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "info"
> = {
  success: "success",
  failed: "destructive",
  partialSuccess: "warning",
  running: "info",
  queued: "info",
};
const STATE_LABEL: Record<string, string> = {
  success: "Succeeded",
  failed: "Failed",
  partialSuccess: "Partly succeeded",
  running: "Running",
  queued: "Queued",
};

const lastRun = (p: OmEntity): PipelineStatus | undefined => {
  const s = p.pipelineStatuses;
  if (Array.isArray(s)) return s[0] as PipelineStatus | undefined;
  return s && typeof s === "object" ? (s as PipelineStatus) : undefined;
};

function RunBadge({ run }: { run: PipelineStatus | undefined }) {
  if (!run?.pipelineState) return <Badge variant="outline">Never run</Badge>;
  return (
    <Badge variant={STATE_VARIANT[run.pipelineState] ?? "outline"}>
      {STATE_LABEL[run.pipelineState] ?? run.pipelineState}
    </Badge>
  );
}

const cronOf = (p: OmEntity) =>
  (p.airflowConfig as { scheduleInterval?: string } | undefined)
    ?.scheduleInterval;

/** A cron line in words for the common shapes; anything else as is. */
function describeCron(cron: string | undefined): string {
  if (!cron) return "Manual only";
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, h, dom, mon, dow] = parts;
  const at =
    /^\d+$/.test(m) && /^\d+$/.test(h)
      ? `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
      : undefined;
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  if (at && dom === "*" && mon === "*" && dow === "*") return `Daily at ${at}`;
  if (at && dom === "*" && mon === "*" && /^[0-6]$/.test(dow))
    return `${days[Number(dow)]}s at ${at}`;
  if (
    /^\d+$/.test(m) &&
    /^\*\/\d+$/.test(h) &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  )
    return `Every ${h.slice(2)} hours`;
  if (/^\d+$/.test(m) && h === "*" && dom === "*" && mon === "*" && dow === "*")
    return "Hourly";
  return cron;
}

const duration = (r: PipelineStatus | undefined) => {
  if (!r?.startDate || !r.endDate) return undefined;
  const s = Math.max(0, Math.round((r.endDate - r.startDate) / 1000));
  return s < 60
    ? `${s} s`
    : s < 3600
      ? `${Math.round(s / 60)} min`
      : `${(s / 3600).toFixed(1)} h`;
};

type Selection = { service?: { type: string; fqn: string }; pipeline?: string };

/**
 * Services: the services the catalog reads from, of every service type,
 * grouped by category, with their ingestion pipelines and how the last run
 * went. One service shows its pipelines; one pipeline its schedule and last
 * run. Managing pipelines is MonoRail's own Services page.
 */
export default function ServicesTab({ counts }: OmTabProps) {
  const pipelines = useAll("ingestionPipeline", 1000);
  const [sel, setSel] = useState<Selection>({});
  const present = SERVICE_TYPES.filter(
    (t) => (countOf(counts.data, t).n ?? 0) > 0,
  );
  const byService = useMemo(() => {
    const m = new Map<string, OmEntity[]>();
    for (const p of pipelines.data ?? []) {
      const s =
        (p.service as OmRef | undefined)?.fullyQualifiedName ??
        (p.service as OmRef | undefined)?.name;
      if (s) m.set(s, [...(m.get(s) ?? []), p]);
    }
    return m;
  }, [pipelines.data]);

  const manage = (
    <Button variant="outline" size="sm" onClick={() => navigate("/services")}>
      <Workflow /> Manage pipelines in Services
    </Button>
  );

  if (sel.pipeline)
    return (
      <PipelineDetail
        key={sel.pipeline}
        fqn={sel.pipeline}
        manage={manage}
        onBack={() => setSel({ service: sel.service })}
      />
    );
  if (sel.service)
    return (
      <ServiceDetail
        key={sel.service.fqn}
        type={sel.service.type}
        fqn={sel.service.fqn}
        pipelines={pipelines}
        mine={byService.get(sel.service.fqn) ?? []}
        manage={manage}
        onBack={() => setSel({})}
        onOpenPipeline={(pipeline) =>
          setSel({ service: sel.service, pipeline })
        }
      />
    );

  const all = pipelines.data ?? [];
  const failed = all.filter(
    (p) => lastRun(p)?.pipelineState === "failed",
  ).length;
  const totalServices = present.reduce(
    (n, t) => n + (countOf(counts.data, t).n ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The systems this catalog reads metadata from, and the pipelines that
          read them. Add, run and schedule pipelines on MonoRail&apos;s Services
          page.
        </p>
        {manage}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label="Services"
          value={counts.data ? formatCount(totalServices) : "–"}
          hint={
            counts.data
              ? `${present.length} ${present.length === 1 ? "kind" : "kinds"}`
              : undefined
          }
        />
        <StatTile
          label="Pipelines"
          value={pipelines.data ? formatCount(all.length) : "–"}
          hint={
            pipelines.data
              ? `${all.filter((p) => p.enabled !== false).length} enabled`
              : undefined
          }
        />
        <StatTile
          label="Last run failed"
          value={pipelines.data ? formatCount(failed) : "–"}
          hint="Pipelines whose latest run failed"
        />
        <StatTile
          label="Never run"
          value={
            pipelines.data
              ? formatCount(
                  all.filter((p) => !lastRun(p)?.pipelineState).length,
                )
              : "–"
          }
        />
      </div>
      {pipelines.error && (
        <ErrorNote
          error={`Ingestion pipelines: ${pipelines.error}`}
          onRetry={pipelines.reload}
        />
      )}
      {!counts.data ? (
        counts.error ? (
          <ErrorNote error={counts.error} onRetry={counts.reload} />
        ) : (
          <LoadingNote what="services" />
        )
      ) : !present.length ? (
        <EmptyNote type="databaseService" title="No services yet">
          Services arrive with ingestion. On this PC, connect a data source and
          add a pipeline on Services.
        </EmptyNote>
      ) : (
        present.map((type) => (
          <CategoryCard
            key={type}
            type={type}
            byService={byService}
            pipelinesLoaded={!!pipelines.data}
            onOpen={(fqn) => setSel({ service: { type, fqn } })}
          />
        ))
      )}
    </div>
  );
}

function CategoryCard({
  type,
  byService,
  pipelinesLoaded,
  onOpen,
}: {
  type: string;
  byService: Map<string, OmEntity[]>;
  pipelinesLoaded: boolean;
  onOpen: (fqn: string) => void;
}) {
  const services = useAll(type);
  const info = typeInfo(type);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeTile type={type} className="size-7" />
          {info?.plural ?? type}
          {services.data && (
            <Badge variant="secondary" className="tabular-nums">
              {services.data.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{info?.summary}</CardDescription>
      </CardHeader>
      <CardContent>
        <ListStates
          state={services}
          what={info?.plural.toLowerCase() ?? "services"}
          emptyTitle="None"
        >
          <SimpleTable
            head={[
              { label: "Service" },
              { label: "Type" },
              { label: "Owners", className: "hidden md:table-cell" },
              { label: "Pipelines", className: "text-right" },
              { label: "Last run", className: "hidden lg:table-cell" },
            ]}
          >
            {sortByName(services.data ?? []).map((s) => {
              const mine = byService.get(fqnOf(s)) ?? [];
              const latest = mine
                .map(lastRun)
                .filter((r): r is PipelineStatus => !!r?.startDate)
                .sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0))[0];
              return (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="max-w-0 min-w-48 px-2 py-2">
                    <button
                      type="button"
                      className="block max-w-full truncate text-left font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => onOpen(fqnOf(s))}
                    >
                      {displayName(s)}
                    </button>
                    {s.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.description}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {typeof s.serviceType === "string" ? (
                      <Badge variant="outline">{s.serviceType}</Badge>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="hidden max-w-48 px-2 py-2 md:table-cell">
                    <Owners owners={s.owners} empty="–" />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {pipelinesLoaded ? mine.length : "–"}
                  </td>
                  <td className="hidden px-2 py-2 lg:table-cell">
                    {latest ? (
                      <RunBadge run={latest} />
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </SimpleTable>
        </ListStates>
      </CardContent>
    </Card>
  );
}

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <ChevronLeft className="size-3" aria-hidden /> {label}
    </button>
  );
}

function ServiceDetail({
  type,
  fqn,
  pipelines,
  mine,
  manage,
  onBack,
  onOpenPipeline,
}: {
  type: string;
  fqn: string;
  pipelines: AllState;
  mine: OmEntity[];
  manage: ReactNode;
  onBack: () => void;
  onOpenPipeline: (fqn: string) => void;
}) {
  const q = useCall<OmEntity>("get", { type, fqn });
  const s = q.data;
  if (!s)
    return (
      <div className="flex flex-col gap-6">
        <Back label="All services" onClick={onBack} />
        {q.error ? (
          <ErrorNote error={q.error} onRetry={q.reload} />
        ) : (
          <LoadingNote what="service" />
        )}
      </div>
    );
  // Only the connector's kind and address: never anything else from the connection, which may hold secrets.
  const config = (
    s.connection as
      { config?: { type?: string; hostPort?: string } } | undefined
  )?.config;
  return (
    <div className="flex flex-col gap-6">
      <Back label="All services" onClick={onBack} />
      <EntityHeader
        type={type}
        entity={s}
        badges={
          typeof s.serviceType === "string" && (
            <Badge variant="primary">{s.serviceType}</Badge>
          )
        }
        actions={manage}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DescriptionCard
          className="xl:col-span-2"
          type={type}
          entity={s}
          onSaved={q.reload}
        />
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Kind">{typeInfo(type)?.name ?? type}</Fact>
            <Fact label="Service type">
              {typeof s.serviceType === "string" ? (
                s.serviceType
              ) : (
                <Muted>Not set</Muted>
              )}
            </Fact>
            {config?.hostPort && (
              <Fact label="Address">
                <span className="font-mono text-xs break-all">
                  {config.hostPort}
                </span>
              </Fact>
            )}
            <Fact label="Owners">
              <Owners owners={s.owners} />
            </Fact>
            <Fact label="Updated">
              {ago(s.updatedAt) || "–"}
              {s.updatedBy && (
                <span className="text-muted-foreground"> by {s.updatedBy}</span>
              )}
            </Fact>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ingestion pipelines</CardTitle>
          <CardDescription>
            What reads this service, how often, and how the last run went.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListStates
            state={{ ...pipelines, data: pipelines.data && mine }}
            what="pipelines"
            type="ingestionPipeline"
            emptyTitle="No pipelines"
            empty="Nothing reads this service yet. Add a pipeline on Services."
          >
            <SimpleTable
              head={[
                { label: "Pipeline" },
                { label: "Kind" },
                { label: "Schedule", className: "hidden md:table-cell" },
                { label: "Last run" },
                { label: "When", className: "hidden lg:table-cell" },
              ]}
            >
              {sortByName(mine).map((p) => {
                const r = lastRun(p);
                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="max-w-0 min-w-48 px-2 py-2">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => onOpenPipeline(fqnOf(p))}
                      >
                        {displayName(p)}
                      </button>
                      {p.enabled === false && (
                        <Badge variant="outline" className="mt-1">
                          Paused
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant="secondary">
                        {String(p.pipelineType ?? "–")}
                      </Badge>
                    </td>
                    <td
                      className="hidden px-2 py-2 text-muted-foreground md:table-cell"
                      title={cronOf(p)}
                    >
                      {describeCron(cronOf(p))}
                    </td>
                    <td className="px-2 py-2">
                      <RunBadge run={r} />
                    </td>
                    <td className="hidden px-2 py-2 text-xs text-muted-foreground lg:table-cell">
                      {r?.startDate ? ago(r.startDate) : "–"}
                    </td>
                  </tr>
                );
              })}
            </SimpleTable>
          </ListStates>
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineDetail({
  fqn,
  manage,
  onBack,
}: {
  fqn: string;
  manage: ReactNode;
  onBack: () => void;
}) {
  const q = useCall<OmEntity>("get", { type: "ingestionPipeline", fqn });
  const p = q.data;
  if (!p)
    return (
      <div className="flex flex-col gap-6">
        <Back label="Service" onClick={onBack} />
        {q.error ? (
          <ErrorNote error={q.error} onRetry={q.reload} />
        ) : (
          <LoadingNote what="pipeline" />
        )}
      </div>
    );
  const r = lastRun(p);
  const service = p.service as OmRef | undefined;
  const air = (p.airflowConfig ?? {}) as {
    scheduleInterval?: string;
    pipelineTimezone?: string;
    retries?: number;
  };
  return (
    <div className="flex flex-col gap-6">
      <Back
        label={service ? displayName(service) : "Service"}
        onClick={onBack}
      />
      <EntityHeader
        type="ingestionPipeline"
        entity={p}
        badges={
          <>
            <Badge variant="secondary">
              {String(p.pipelineType ?? "pipeline")}
            </Badge>
            {p.enabled === false && <Badge variant="outline">Paused</Badge>}
          </>
        }
        actions={manage}
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatTile
          hero
          label="Last run"
          value={
            r?.pipelineState
              ? (STATE_LABEL[r.pipelineState] ?? r.pipelineState)
              : "Never"
          }
          hint={r?.startDate ? formatTime(r.startDate) : undefined}
        />
        <StatTile label="Took" value={duration(r) ?? "–"} />
        <StatTile
          label="Schedule"
          value={describeCron(air.scheduleInterval)}
          hint={air.pipelineTimezone}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DescriptionCard
          className="xl:col-span-2"
          type="ingestionPipeline"
          entity={p}
          onSaved={q.reload}
        />
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Runs">{describeCron(air.scheduleInterval)}</Fact>
            <Fact label="Cron">
              {air.scheduleInterval ? (
                <span className="font-mono">{air.scheduleInterval}</span>
              ) : (
                <Muted>None</Muted>
              )}
            </Fact>
            <Fact label="Retries">{air.retries ?? 0}</Fact>
            <Fact label="Deployed">
              {p.deployed === true ? (
                "Yes"
              ) : p.deployed === false ? (
                "No"
              ) : (
                <Muted>Unknown</Muted>
              )}
            </Fact>
            <Fact label="Enabled">
              {p.enabled === false ? "No: paused" : "Yes"}
            </Fact>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        The catalog keeps only the latest run on the pipeline. Run history, logs
        and running it by hand are on MonoRail&apos;s Services page.
      </p>
    </div>
  );
}
