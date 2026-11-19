import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCount } from "@/lib/format";

import { useCall } from "../api";
import { Owners, Tags } from "../parts";
import type { OmEntity, OmRef } from "../types";
import { displayName } from "../util";
import {
  AssetsCard,
  DescriptionCard,
  EmptyNote,
  EntityHeader,
  ErrorNote,
  Fact,
  ListStates,
  LoadingNote,
  Muted,
  SideList,
  SimpleTable,
  SplitLayout,
} from "./governance";
import {
  fqnOf,
  parentFqn,
  sortByName,
  splitFqn,
  useAll,
  useAssetScan,
  type AllState,
} from "./governance-data";
import type { OmTabProps } from "./types";

/** Badge look per glossary term status (OpenMetadata's EntityStatus). */
const STATUS_VARIANT: Record<
  string,
  "success" | "secondary" | "info" | "warning" | "destructive"
> = {
  Approved: "success",
  Draft: "secondary",
  "In Review": "info",
  Deprecated: "warning",
  Rejected: "destructive",
};

function StatusBadge({ status }: { status: unknown }) {
  if (typeof status !== "string" || !status) return null;
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const refs = (v: unknown): OmRef[] => (Array.isArray(v) ? (v as OmRef[]) : []);

/** The glossary a term belongs to: its `glossary` reference, else the first part of its FQN. */
const glossaryOf = (t: OmEntity) =>
  (t.glossary as OmRef | undefined)?.fullyQualifiedName ??
  splitFqn(fqnOf(t))[0];
/** A term's parent term FQN: its `parent` reference, else its FQN less one part (unless that is the glossary). */
function parentOf(t: OmEntity): string | undefined {
  const p = (t.parent as OmRef | undefined)?.fullyQualifiedName;
  if (p) return p;
  const up = parentFqn(fqnOf(t));
  return up && splitFqn(up).length > 1 ? up : undefined;
}

interface Selection {
  glossary?: string;
  term?: string;
}

/**
 * Glossary: business glossaries on the left; on the right one glossary with
 * its terms as a parent/child tree, or one term with its synonyms, related
 * terms, status, people and the assets that carry it.
 */
export default function GlossaryTab({ counts }: OmTabProps) {
  const glossaries = useAll("glossary");
  const terms = useAll("glossaryTerm", 1000);
  const [sel, setSel] = useState<Selection>({});
  const list = useMemo(
    () => sortByName(glossaries.data ?? []),
    [glossaries.data],
  );
  const current = sel.glossary ?? (list[0] ? fqnOf(list[0]) : undefined);
  const termCount = (g: OmEntity) =>
    terms.data
      ? terms.data.filter((t) => glossaryOf(t) === fqnOf(g)).length
      : typeof g.termCount === "number"
        ? g.termCount
        : undefined;
  const openTerm = (fqn: string) =>
    setSel({ glossary: splitFqn(fqn)[0], term: fqn });

  return (
    <SplitLayout
      side={
        <SideList
          title="Glossaries"
          type="glossary"
          state={glossaries}
          emptyTitle="No glossaries yet"
          empty="Glossaries come from OpenMetadata or ingestion."
          items={list.map((g) => {
            const n = termCount(g);
            return {
              key: g.id,
              title: displayName(g),
              meta: n === undefined ? undefined : formatCount(n),
              active: fqnOf(g) === current,
              onClick: () => setSel({ glossary: fqnOf(g) }),
            };
          })}
        />
      }
    >
      {!current ? (
        glossaries.data ? (
          <EmptyNote type="glossary" title="No glossary to show">
            This catalog has no glossaries. Add one in OpenMetadata, then
            refresh.
          </EmptyNote>
        ) : null
      ) : sel.term ? (
        <TermDetail
          key={sel.term}
          fqn={sel.term}
          terms={terms}
          counts={counts.data}
          onOpenTerm={openTerm}
          onBack={() => setSel({ glossary: current })}
        />
      ) : (
        <GlossaryDetail
          key={current}
          fqn={current}
          terms={terms}
          onOpenTerm={openTerm}
        />
      )}
    </SplitLayout>
  );
}

function GlossaryDetail({
  fqn,
  terms,
  onOpenTerm,
}: {
  fqn: string;
  terms: AllState;
  onOpenTerm: (fqn: string) => void;
}) {
  const q = useCall<OmEntity>("get", { type: "glossary", fqn });
  const g = q.data;
  const mine = useMemo(
    () => (terms.data ?? []).filter((t) => glossaryOf(t) === fqn),
    [terms.data, fqn],
  );
  if (!g)
    return q.error ? (
      <ErrorNote error={q.error} onRetry={q.reload} />
    ) : (
      <LoadingNote what="glossary" />
    );
  return (
    <>
      <EntityHeader
        type="glossary"
        entity={g}
        badges={
          g.mutuallyExclusive === true && (
            <Badge variant="secondary">Mutually exclusive</Badge>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DescriptionCard
          className="xl:col-span-2"
          type="glossary"
          entity={g}
          onSaved={q.reload}
        />
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Owners">
              <Owners owners={g.owners} />
            </Fact>
            <Fact label="Reviewers">
              <Owners owners={refs(g.reviewers)} empty="No reviewers" />
            </Fact>
            <Fact label="Tags">
              <Tags tags={g.tags} />
            </Fact>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
          <CardDescription>
            {terms.data
              ? `${formatCount(mine.length)} ${mine.length === 1 ? "term" : "terms"}${terms.truncated ? " among the first loaded" : ""}`
              : " "}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListStates
            state={{ ...terms, data: terms.data && mine }}
            what="terms"
            type="glossaryTerm"
            emptyTitle="No terms yet"
            empty="This glossary has no terms."
          >
            <TermTree terms={mine} onOpen={onOpenTerm} />
          </ListStates>
        </CardContent>
      </Card>
    </>
  );
}

interface Node {
  term: OmEntity;
  children: Node[];
}

function buildTree(terms: OmEntity[]): Node[] {
  const byFqn = new Map(
    terms.map((t) => [fqnOf(t), { term: t, children: [] as Node[] }]),
  );
  const roots: Node[] = [];
  for (const n of byFqn.values()) {
    const p = parentOf(n.term);
    const parent = p ? byFqn.get(p) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const sort = (ns: Node[]) => {
    ns.sort((a, b) => displayName(a.term).localeCompare(displayName(b.term)));
    ns.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** A glossary's terms as an expandable tree: status, synonyms, owners and child counts. */
function TermTree({
  terms,
  onOpen,
}: {
  terms: OmEntity[];
  onOpen: (fqn: string) => void;
}) {
  const roots = useMemo(() => buildTree(terms), [terms]);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const toggle = (fqn: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(fqn)) next.delete(fqn);
      else next.add(fqn);
      return next;
    });
  const rows: { node: Node; depth: number }[] = [];
  const walk = (ns: Node[], depth: number) => {
    for (const n of ns) {
      rows.push({ node: n, depth });
      if (!collapsed.has(fqnOf(n.term))) walk(n.children, depth + 1);
    }
  };
  walk(roots, 0);

  return (
    <SimpleTable
      head={[
        { label: "Term" },
        { label: "Status" },
        { label: "Synonyms", className: "hidden md:table-cell" },
        { label: "Owners", className: "hidden lg:table-cell" },
        { label: "Children", className: "text-right" },
      ]}
    >
      {rows.map(({ node, depth }) => {
        const t = node.term;
        const fqn = fqnOf(t);
        const open = !collapsed.has(fqn);
        const syn = strings(t.synonyms);
        return (
          <tr key={t.id} className="hover:bg-muted/40">
            <td className="max-w-0 min-w-56 px-2 py-2">
              <span
                className="flex min-w-0 items-center gap-1"
                style={{ paddingLeft: `${depth * 1.25}rem` }}
              >
                {node.children.length ? (
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={
                      open
                        ? `Collapse ${displayName(t)}`
                        : `Expand ${displayName(t)}`
                    }
                    aria-expanded={open}
                    onClick={() => toggle(fqn)}
                  >
                    {open ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                ) : (
                  <span className="w-5 shrink-0" aria-hidden />
                )}
                <button
                  type="button"
                  className="min-w-0 truncate text-left font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => onOpen(fqn)}
                >
                  {displayName(t)}
                </button>
              </span>
            </td>
            <td className="px-2 py-2">
              <StatusBadge status={t.status} />
            </td>
            <td className="hidden max-w-56 truncate px-2 py-2 text-muted-foreground md:table-cell">
              {syn.length ? syn.join(", ") : "–"}
            </td>
            <td className="hidden max-w-48 px-2 py-2 lg:table-cell">
              <Owners owners={t.owners} empty="–" />
            </td>
            <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
              {node.children.length || "–"}
            </td>
          </tr>
        );
      })}
    </SimpleTable>
  );
}

function TermDetail({
  fqn,
  terms,
  counts,
  onOpenTerm,
  onBack,
}: {
  fqn: string;
  terms: AllState;
  counts: OmTabProps["counts"]["data"];
  onOpenTerm: (fqn: string) => void;
  onBack: () => void;
}) {
  const q = useCall<OmEntity>("get", { type: "glossaryTerm", fqn });
  const assets = useAssetScan(counts, { tag: fqn });
  const t = q.data;
  const children = useMemo(
    () => sortByName((terms.data ?? []).filter((x) => parentOf(x) === fqn)),
    [terms.data, fqn],
  );
  const crumbs = splitFqn(fqn);

  const back = (
    <button
      type="button"
      className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={onBack}
    >
      <ChevronLeft className="size-3" aria-hidden /> {crumbs[0]}
    </button>
  );
  if (!t)
    return (
      <>
        {back}
        {q.error ? (
          <ErrorNote error={q.error} onRetry={q.reload} />
        ) : (
          <LoadingNote what="term" />
        )}
      </>
    );

  const parent = parentOf(t);
  const references = Array.isArray(t.references)
    ? (t.references as { name?: string; endpoint?: string }[])
    : [];
  const syn = strings(t.synonyms);
  return (
    <>
      {back}
      <EntityHeader
        type="glossaryTerm"
        entity={t}
        badges={<StatusBadge status={t.status} />}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <DescriptionCard type="glossaryTerm" entity={t} onSaved={q.reload} />
          <Card>
            <CardHeader>
              <CardTitle>Child terms</CardTitle>
              <CardDescription>Narrower terms under this one.</CardDescription>
            </CardHeader>
            <CardContent>
              {!terms.data ? (
                terms.error ? (
                  <ErrorNote error={terms.error} onRetry={terms.reload} />
                ) : (
                  <LoadingNote what="terms" />
                )
              ) : !children.length ? (
                <p className="text-sm text-muted-foreground">No child terms.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/50"
                        onClick={() => onOpenTerm(fqnOf(c))}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {displayName(c)}
                          </span>
                          {c.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.description}
                            </span>
                          )}
                        </span>
                        <StatusBadge status={c.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <AssetsCard
            title="Assets"
            description="Data assets tagged with this term."
            assets={assets.data}
            error={assets.error}
            partial={assets.partial}
            empty="No assets carry this term."
          />
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Status">
              {typeof t.status === "string" ? (
                <StatusBadge status={t.status} />
              ) : (
                <Muted>Not set</Muted>
              )}
            </Fact>
            <Fact label="Parent">
              {parent ? (
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => onOpenTerm(parent)}
                >
                  {splitFqn(parent).pop()}
                </button>
              ) : (
                <Muted>Top-level term</Muted>
              )}
            </Fact>
            <Fact label="Synonyms">
              {syn.length ? (
                <span className="flex flex-wrap gap-1">
                  {syn.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                </span>
              ) : (
                <Muted>None</Muted>
              )}
            </Fact>
            <Fact label="Related terms">
              {refs(t.relatedTerms).length ? (
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {refs(t.relatedTerms).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() =>
                        onOpenTerm(r.fullyQualifiedName ?? r.name ?? "")
                      }
                    >
                      {displayName(r)}
                    </button>
                  ))}
                </span>
              ) : (
                <Muted>None</Muted>
              )}
            </Fact>
            <Fact label="Owners">
              <Owners owners={t.owners} />
            </Fact>
            <Fact label="Reviewers">
              <Owners owners={refs(t.reviewers)} empty="No reviewers" />
            </Fact>
            <Fact label="Tags">
              <Tags tags={t.tags} />
            </Fact>
            {references.length > 0 && (
              <Fact label="References">
                <ul className="flex flex-col gap-1">
                  {references.map((r, i) => (
                    <li key={i} className="truncate" title={r.endpoint}>
                      {r.name || r.endpoint}
                    </li>
                  ))}
                </ul>
              </Fact>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
