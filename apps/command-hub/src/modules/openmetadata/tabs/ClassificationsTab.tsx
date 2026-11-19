import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useCall } from "../api";
import { Owners } from "../parts";
import type { OmEntity, OmRef } from "../types";
import { displayName } from "../util";
import {
  AssetsCard,
  DescriptionCard,
  EmptyNote,
  EntityHeader,
  EntityLink,
  ErrorNote,
  Fact,
  ListStates,
  LoadingNote,
  Markdown,
  Muted,
  SideList,
  SplitLayout,
} from "./governance";
import {
  fqnOf,
  sortByName,
  splitFqn,
  useAll,
  useAssetScan,
  type AllState,
} from "./governance-data";
import type { OmTabProps } from "./types";

/** The classification a tag belongs to: its `classification` reference, else the first part of its FQN. */
const classificationOf = (t: OmEntity) =>
  (t.classification as OmRef | undefined)?.fullyQualifiedName ??
  splitFqn(fqnOf(t))[0];

/**
 * Classifications: the classifications on the left (Tier, PII, ...); on the
 * right one classification with its tags and their descriptions, how many
 * assets carry each, and the assets of the tag picked.
 */
export default function ClassificationsTab({ counts }: OmTabProps) {
  const classifications = useAll("classification");
  const tags = useAll("tag", 1000);
  const [picked, setPicked] = useState<string>();
  const list = useMemo(
    () => sortByName(classifications.data ?? []),
    [classifications.data],
  );
  const current = picked ?? (list[0] ? fqnOf(list[0]) : undefined);
  const tagCount = (c: OmEntity) =>
    tags.data
      ? tags.data.filter((t) => classificationOf(t) === fqnOf(c)).length
      : typeof c.termCount === "number"
        ? c.termCount
        : undefined;

  return (
    <SplitLayout
      side={
        <SideList
          title="Classifications"
          type="classification"
          state={classifications}
          emptyTitle="No classifications yet"
          empty="Classifications come from OpenMetadata or ingestion."
          items={list.map((c) => {
            const n = tagCount(c);
            return {
              key: c.id,
              title: displayName(c),
              subtitle: c.provider === "system" ? "System" : undefined,
              meta: n === undefined ? undefined : formatCount(n),
              active: fqnOf(c) === current,
              onClick: () => setPicked(fqnOf(c)),
            };
          })}
        />
      }
    >
      {current ? (
        <ClassificationDetail
          key={current}
          fqn={current}
          tags={tags}
          counts={counts.data}
        />
      ) : classifications.data ? (
        <EmptyNote type="classification" title="No classification to show">
          This catalog has no classifications. Add one in OpenMetadata, then
          refresh.
        </EmptyNote>
      ) : null}
    </SplitLayout>
  );
}

function ClassificationDetail({
  fqn,
  tags,
  counts,
}: {
  fqn: string;
  tags: AllState;
  counts: OmTabProps["counts"]["data"];
}) {
  const q = useCall<OmEntity>("get", { type: "classification", fqn });
  const scan = useAssetScan(counts, { tagPrefix: `${fqn}.` });
  const [open, setOpen] = useState<string>();
  const mine = useMemo(
    () =>
      sortByName((tags.data ?? []).filter((t) => classificationOf(t) === fqn)),
    [tags.data, fqn],
  );
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of scan.data ?? [])
      for (const t of a.entity.tags ?? [])
        m.set(t.tagFQN, (m.get(t.tagFQN) ?? 0) + 1);
    return m;
  }, [scan.data]);
  const c = q.data;
  if (!c)
    return q.error ? (
      <ErrorNote error={q.error} onRetry={q.reload} />
    ) : (
      <LoadingNote what="classification" />
    );

  const openTag = open ? mine.find((t) => fqnOf(t) === open) : undefined;
  return (
    <>
      <EntityHeader
        type="classification"
        entity={c}
        badges={
          <>
            {c.mutuallyExclusive === true && (
              <Badge variant="secondary">Mutually exclusive</Badge>
            )}
            {c.provider === "system" && <Badge variant="outline">System</Badge>}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DescriptionCard
          className="xl:col-span-2"
          type="classification"
          entity={c}
          onSaved={q.reload}
        />
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Owners">
              <Owners owners={c.owners} />
            </Fact>
            <Fact label="Mutually exclusive">
              {c.mutuallyExclusive === true ? (
                "Yes: an asset carries at most one of these tags."
              ) : c.mutuallyExclusive === false ? (
                "No: an asset may carry several."
              ) : (
                <Muted>Not set</Muted>
              )}
            </Fact>
            <Fact label="Provider">
              {typeof c.provider === "string" ? (
                c.provider === "system" ? (
                  "System (built into OpenMetadata)"
                ) : (
                  "User"
                )
              ) : (
                <Muted>Not set</Muted>
              )}
            </Fact>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            {tags.data
              ? `${formatCount(mine.length)} ${mine.length === 1 ? "tag" : "tags"}. `
              : ""}
            Pick one to see the assets that carry it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListStates
            state={{ ...tags, data: tags.data && mine }}
            what="tags"
            type="tag"
            emptyTitle="No tags yet"
            empty="This classification has no tags."
          >
            <ul className="flex flex-col divide-y">
              {mine.map((t) => {
                const tfqn = fqnOf(t);
                const n = usage.get(tfqn);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={open === tfqn}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md px-2 py-2.5 text-left hover:bg-muted/50",
                        open === tfqn &&
                          "bg-primary-soft/60 hover:bg-primary-soft/60",
                      )}
                      onClick={() => setOpen(open === tfqn ? undefined : tfqn)}
                    >
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {displayName(t)}
                          </span>
                          {t.deprecated === true && (
                            <Badge variant="warning">Deprecated</Badge>
                          )}
                          {t.disabled === true && (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.description || "No description yet."}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {scan.data
                          ? `${formatCount(n ?? 0)} ${n === 1 ? "asset" : "assets"}`
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ListStates>
        </CardContent>
      </Card>
      {openTag && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {fqnOf(openTag)}
              <EntityLink
                type="tag"
                fqn={fqnOf(openTag)}
                className="text-xs font-normal"
              >
                Open in Catalog
              </EntityLink>
            </CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close tag"
                onClick={() => setOpen(undefined)}
              >
                <X />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Markdown text={openTag.description} />
          </CardContent>
        </Card>
      )}
      {openTag && (
        <AssetsCard
          title={`Assets tagged ${displayName(openTag)}`}
          assets={scan.data?.filter((a) =>
            a.entity.tags?.some((t) => t.tagFQN === fqnOf(openTag)),
          )}
          error={scan.error}
          partial={scan.partial}
          empty="No assets carry this tag."
        />
      )}
    </>
  );
}
