import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { StatTile } from "@/components/charts/StatTile";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchField } from "@/components/ui/search-field";
import { Segmented } from "@/components/ui/segmented";
import { formatCount, formatPercent } from "@/lib/format";

import { useCall } from "../api";
import { Owners } from "../parts";
import type { OmEntity, OmRef } from "../types";
import { ago, displayName, formatTime } from "../util";
import {
  DescriptionCard,
  EntityHeader,
  EntityLink,
  ErrorNote,
  Fact,
  ListStates,
  LoadingNote,
  Muted,
  SimpleTable,
} from "./governance";
import { fqnOf, sortByName, useAll, useFull } from "./governance-data";
import type { OmTabProps } from "./types";

type Status = "Success" | "Failed" | "Aborted" | "Queued";
const STATUS_LABEL: Record<Status, string> = {
  Success: "Passed",
  Failed: "Failed",
  Aborted: "Aborted",
  Queued: "Queued",
};
const STATUS_VARIANT: Record<
  Status,
  "success" | "destructive" | "warning" | "info"
> = {
  Success: "success",
  Failed: "destructive",
  Aborted: "warning",
  Queued: "info",
};

interface Result {
  timestamp?: number;
  testCaseStatus?: Status;
  result?: string;
  testResultValue?: { name?: string; value?: string }[];
}

const resultOf = (c: OmEntity) =>
  c.testCaseResult && typeof c.testCaseResult === "object"
    ? (c.testCaseResult as Result)
    : undefined;

function StatusBadge({ status }: { status: Status | undefined }) {
  if (!status) return <Badge variant="outline">No result</Badge>;
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** `<#E::table::FQN>` or `<#E::table::FQN::columns::col>`. */
function parseLink(
  link: unknown,
): { type: string; fqn: string; column?: string } | undefined {
  if (typeof link !== "string") return undefined;
  const m = /^<#E::([^:]+)::(.+?)(?:::columns::(.+))?>$/.exec(link);
  return m ? { type: m[1], fqn: m[2], column: m[3] } : undefined;
}

type Filter = "all" | Status | "none";

/**
 * Data quality: how the tests did on their last run (passed, failed,
 * aborted), every test case with its latest result, filterable by status and
 * level, one test case in detail, and the test suites.
 */
export default function QualityTab(_props: OmTabProps) {
  const cases = useAll("testCase", 1000);
  const suites = useAll("testSuite");
  // A server lists test cases without their result: fetch those one by one (the first 100).
  const full = useFull("testCase", cases.data, "testCaseResult");
  const rows = useMemo(
    () => (cases.data ?? []).map((c) => full.get(c.id) ?? c),
    [cases.data, full],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [level, setLevel] = useState<"all" | "table" | "column">("all");
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string>();

  const tally = useMemo(() => {
    const t = { Success: 0, Failed: 0, Aborted: 0, Queued: 0, none: 0 };
    for (const c of rows) {
      const s = resultOf(c)?.testCaseStatus;
      if (s && s in t) t[s]++;
      else t.none++;
    }
    return t;
  }, [rows]);
  const ran = tally.Success + tally.Failed + tally.Aborted;

  if (open)
    return (
      <TestCaseDetail key={open} fqn={open} onBack={() => setOpen(undefined)} />
    );

  const f = text.trim().toLowerCase();
  const shown = rows
    .filter((c) => {
      const s = resultOf(c)?.testCaseStatus;
      if (filter === "none" ? !!s : filter !== "all" && s !== filter)
        return false;
      const link = parseLink(c.entityLink);
      if (level === "column" && !link?.column) return false;
      if (level === "table" && link?.column) return false;
      return (
        !f ||
        [c.name, c.displayName, link?.fqn].some((x) =>
          x?.toLowerCase().includes(f),
        )
      );
    })
    .sort(
      (a, b) =>
        (resultOf(b)?.timestamp ?? 0) - (resultOf(a)?.timestamp ?? 0) ||
        a.name.localeCompare(b.name),
    );
  const v = (n: number) => (cases.data ? formatCount(n) : "–");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label="Success rate"
          value={cases.data && ran ? formatPercent(tally.Success / ran) : "–"}
          hint={
            cases.data
              ? `${formatCount(rows.length)} tests${tally.none ? `, ${formatCount(tally.none)} without a result` : ""}`
              : undefined
          }
        />
        <StatTile
          label="Passed"
          value={v(tally.Success)}
          hint="On their last run"
        />
        <StatTile
          label="Failed"
          value={v(tally.Failed)}
          hint="On their last run"
        />
        <StatTile
          label="Aborted"
          value={v(tally.Aborted)}
          hint={
            tally.Queued
              ? `${formatCount(tally.Queued)} queued`
              : "Did not finish"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test cases</CardTitle>
          <CardDescription>
            The latest result of each test. Open one for its definition and
            parameters.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              aria-label="Status"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "Success", label: "Passed" },
                { value: "Failed", label: "Failed" },
                { value: "Aborted", label: "Aborted" },
                { value: "none", label: "No result" },
              ]}
            />
            <NativeSelect
              className="w-40"
              aria-label="Test level"
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
            >
              <option value="all">All levels</option>
              <option value="table">Table tests</option>
              <option value="column">Column tests</option>
            </NativeSelect>
            <SearchField
              className="min-w-48 flex-1 sm:max-w-xs"
              size="sm"
              aria-label="Filter test cases"
              placeholder="Filter by test or table"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <ListStates
            state={cases}
            what="test cases"
            type="testCase"
            emptyTitle="No test cases yet"
            empty="Test cases come from OpenMetadata's data quality tests or from dbt tests."
          >
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tests match these filters.
              </p>
            ) : (
              <SimpleTable
                head={[
                  { label: "Test" },
                  { label: "Status" },
                  { label: "Result", className: "hidden lg:table-cell" },
                  { label: "Last run", className: "hidden md:table-cell" },
                ]}
              >
                {shown.map((c) => {
                  const r = resultOf(c);
                  const link = parseLink(c.entityLink);
                  return (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="max-w-0 min-w-56 px-2 py-2">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => setOpen(fqnOf(c))}
                        >
                          {displayName(c)}
                        </button>
                        {link && (
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {link.fqn.split(".").pop()}
                            {link.column ? `.${link.column}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={r?.testCaseStatus} />
                      </td>
                      <td
                        className="hidden max-w-72 truncate px-2 py-2 text-muted-foreground lg:table-cell"
                        title={r?.result}
                      >
                        {r?.result || "–"}
                      </td>
                      <td
                        className="hidden px-2 py-2 text-xs whitespace-nowrap text-muted-foreground md:table-cell"
                        title={
                          r?.timestamp ? formatTime(r.timestamp) : undefined
                        }
                      >
                        {r?.timestamp ? ago(r.timestamp) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </SimpleTable>
            )}
          </ListStates>
          {cases.truncated && (
            <p className="text-xs text-muted-foreground">
              Showing the first {formatCount(rows.length)} test cases.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test suites</CardTitle>
          <CardDescription>
            Basic suites hold one table&apos;s tests; logical suites group tests
            from anywhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListStates
            state={suites}
            what="test suites"
            type="testSuite"
            emptyTitle="No test suites yet"
          >
            <SimpleTable
              head={[
                { label: "Suite" },
                { label: "Kind" },
                { label: "Tests", className: "text-right" },
                { label: "Passed", className: "text-right" },
                { label: "Failed", className: "text-right" },
                { label: "Owners", className: "hidden md:table-cell" },
              ]}
            >
              {sortByName(suites.data ?? []).map((s) => {
                const listed = new Set(
                  (Array.isArray(s.tests) ? (s.tests as OmRef[]) : []).map(
                    (r) => r.id,
                  ),
                );
                const mine = rows.filter(
                  (c) =>
                    listed.has(c.id) ||
                    (c.testSuite as OmRef | undefined)?.id === s.id,
                );
                const passed = mine.filter(
                  (c) => resultOf(c)?.testCaseStatus === "Success",
                ).length;
                const failed = mine.filter(
                  (c) => resultOf(c)?.testCaseStatus === "Failed",
                ).length;
                const target = s.basicEntityReference as OmRef | undefined;
                return (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="max-w-0 min-w-56 px-2 py-2">
                      <EntityLink
                        type="testSuite"
                        fqn={fqnOf(s)}
                        className="block max-w-full font-medium"
                      >
                        {s.basic === true && target
                          ? displayName(target)
                          : displayName(s)}
                      </EntityLink>
                      {s.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.description}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Badge
                        variant={s.basic === true ? "secondary" : "primary"}
                      >
                        {s.basic === true ? "Basic" : "Logical"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {cases.data ? mine.length : "–"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {cases.data ? passed : "–"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {cases.data ? failed : "–"}
                    </td>
                    <td className="hidden max-w-48 px-2 py-2 md:table-cell">
                      <Owners owners={s.owners} empty="–" />
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

function TestCaseDetail({ fqn, onBack }: { fqn: string; onBack: () => void }) {
  const q = useCall<OmEntity>("get", { type: "testCase", fqn });
  const c = q.data;
  const back = (
    <button
      type="button"
      className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={onBack}
    >
      <ChevronLeft className="size-3" aria-hidden /> All test cases
    </button>
  );
  if (!c)
    return (
      <div className="flex flex-col gap-6">
        {back}
        {q.error ? (
          <ErrorNote error={q.error} onRetry={q.reload} />
        ) : (
          <LoadingNote what="test case" />
        )}
      </div>
    );
  const r = resultOf(c);
  const link = parseLink(c.entityLink);
  const def = c.testDefinition as OmRef | undefined;
  const suite = c.testSuite as OmRef | undefined;
  const params = Array.isArray(c.parameterValues)
    ? (c.parameterValues as { name?: string; value?: string }[])
    : [];

  return (
    <div className="flex flex-col gap-6">
      {back}
      <EntityHeader
        type="testCase"
        entity={c}
        badges={<StatusBadge status={r?.testCaseStatus} />}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest result</CardTitle>
              <CardDescription>
                {r?.timestamp
                  ? `${formatTime(r.timestamp)} (${ago(r.timestamp)})`
                  : "This test has not run yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {r ? (
                <>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.testCaseStatus} />
                    <span className="text-sm">
                      {r.result || <Muted>No message</Muted>}
                    </span>
                  </div>
                  {r.testResultValue?.length ? (
                    <SimpleTable
                      head={[
                        { label: "Value" },
                        { label: "Result", className: "text-right" },
                      ]}
                    >
                      {r.testResultValue.map((x, i) => (
                        <tr key={i}>
                          <td className="px-2 py-2">{x.name}</td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums">
                            {x.value}
                          </td>
                        </tr>
                      ))}
                    </SimpleTable>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Results appear after the table&apos;s test suite pipeline
                  runs.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Only the latest result is kept on the test case; earlier runs
                are in OpenMetadata&apos;s result history.
              </p>
            </CardContent>
          </Card>
          <DescriptionCard type="testCase" entity={c} onSaved={q.reload} />
          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              {params.length ? (
                <SimpleTable head={[{ label: "Name" }, { label: "Value" }]}>
                  {params.map((p, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2 font-mono text-xs">{p.name}</td>
                      <td className="px-2 py-2 font-mono text-xs break-all">
                        {p.value}
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This test takes no parameters.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Definition</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Tests">
              {link ? (
                <EntityLink type={link.type} fqn={link.fqn}>
                  {link.fqn.split(".").pop()}
                </EntityLink>
              ) : (
                <Muted>Unknown</Muted>
              )}
            </Fact>
            <Fact label="Column">
              {link?.column ? (
                <span className="font-mono">{link.column}</span>
              ) : (
                <Muted>Whole table</Muted>
              )}
            </Fact>
            <Fact label="Test definition">
              {def ? (
                <EntityLink
                  type="testDefinition"
                  fqn={def.fullyQualifiedName ?? def.name ?? ""}
                >
                  {displayName(def)}
                </EntityLink>
              ) : (
                <Muted>Unknown</Muted>
              )}
            </Fact>
            <Fact label="Test suite">
              {suite ? (
                <EntityLink
                  type="testSuite"
                  fqn={suite.fullyQualifiedName ?? suite.name ?? ""}
                >
                  {displayName(suite)}
                </EntityLink>
              ) : (
                <Muted>None</Muted>
              )}
            </Fact>
            <Fact label="Owners">
              <Owners owners={c.owners} />
            </Fact>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
