import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useCall } from "../api";
import { Owners, Tags, TypeTile } from "../parts";
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
  SplitLayout,
  type SideItem,
} from "./governance";
import {
  fqnOf,
  parentFqn,
  refsAsAssets,
  sortByName,
  useAll,
  useAssetScan,
  type AllState,
} from "./governance-data";
import type { OmTabProps } from "./types";

const refs = (v: unknown): OmRef[] => (Array.isArray(v) ? (v as OmRef[]) : []);
const parentOf = (d: OmEntity) =>
  (d.parent as OmRef | undefined)?.fullyQualifiedName ?? parentFqn(fqnOf(d));

interface Selection {
  domain?: string;
  product?: string;
}

/**
 * Domains: business domains and their subdomains on the left; on the right
 * one domain with its people, subdomains, data products and assets, or one
 * data product with its assets.
 */
export default function DomainsTab({ counts }: OmTabProps) {
  const domains = useAll("domain");
  const products = useAll("dataProduct", 1000);
  const [sel, setSel] = useState<Selection>({});

  // Domains as a tree: subdomains under their parent.
  const items = useMemo(() => {
    const all = domains.data ?? [];
    const fqns = new Set(all.map(fqnOf));
    const out: { d: OmEntity; depth: number }[] = [];
    const walk = (parent: string | undefined, depth: number) => {
      for (const d of sortByName(
        all.filter((x) => {
          const p = parentOf(x);
          return (p && fqns.has(p) ? p : undefined) === parent;
        }),
      )) {
        out.push({ d, depth });
        walk(fqnOf(d), depth + 1);
      }
    };
    walk(undefined, 0);
    return out;
  }, [domains.data]);
  const current = sel.domain ?? (items[0] ? fqnOf(items[0].d) : undefined);

  return (
    <SplitLayout
      side={
        <SideList
          title="Domains"
          type="domain"
          state={domains}
          emptyTitle="No domains yet"
          empty="Domains come from OpenMetadata."
          items={items.map(({ d, depth }): SideItem => ({
            key: d.id,
            title: displayName(d),
            subtitle:
              typeof d.domainType === "string" ? d.domainType : undefined,
            depth,
            active: fqnOf(d) === current,
            onClick: () => setSel({ domain: fqnOf(d) }),
          }))}
        />
      }
    >
      {!current ? (
        domains.data ? (
          <EmptyNote type="domain" title="No domain to show">
            This catalog has no domains. Add one in OpenMetadata, then refresh.
          </EmptyNote>
        ) : null
      ) : sel.product ? (
        <ProductDetail
          key={sel.product}
          fqn={sel.product}
          onBack={() => setSel({ domain: current })}
          onOpenDomain={(domain) => setSel({ domain })}
        />
      ) : (
        <DomainDetail
          key={current}
          fqn={current}
          domains={domains.data ?? []}
          products={products}
          counts={counts.data}
          onOpen={setSel}
        />
      )}
    </SplitLayout>
  );
}

function DomainDetail({
  fqn,
  domains,
  products,
  counts,
  onOpen,
}: {
  fqn: string;
  domains: OmEntity[];
  products: AllState;
  counts: OmTabProps["counts"]["data"];
  onOpen: (s: Selection) => void;
}) {
  const q = useCall<OmEntity>("get", { type: "domain", fqn });
  const assets = useAssetScan(counts, { domain: fqn });
  const d = q.data;
  const subdomains = useMemo(
    () => sortByName(domains.filter((x) => parentOf(x) === fqn)),
    [domains, fqn],
  );
  const mine = useMemo(() => {
    if (!products.data) return undefined;
    const byDomain = products.data.filter((p) =>
      p.domains?.some((x) => (x.fullyQualifiedName ?? x.name) === fqn),
    );
    // A server may list a domain's products on the domain but not the domain on its products.
    const listed = refs(d?.dataProducts).map((r) => r.id);
    const extra = products.data.filter(
      (p) => listed.includes(p.id) && !byDomain.includes(p),
    );
    return sortByName([...byDomain, ...extra]);
  }, [products.data, d, fqn]);
  if (!d)
    return q.error ? (
      <ErrorNote error={q.error} onRetry={q.reload} />
    ) : (
      <LoadingNote what="domain" />
    );
  const parent = parentOf(d);
  const parentDomain = parent
    ? domains.find((x) => fqnOf(x) === parent)
    : undefined;

  return (
    <>
      <EntityHeader
        type="domain"
        entity={d}
        badges={
          typeof d.domainType === "string" && (
            <Badge variant="primary">{d.domainType}</Badge>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DescriptionCard
          className="xl:col-span-2"
          type="domain"
          entity={d}
          onSaved={q.reload}
        />
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Owners">
              <Owners owners={d.owners} />
            </Fact>
            <Fact label="Experts">
              <Owners owners={refs(d.experts)} empty="No experts" />
            </Fact>
            <Fact label="Domain type">
              {typeof d.domainType === "string" ? (
                d.domainType
              ) : (
                <Muted>Not set</Muted>
              )}
            </Fact>
            {parentDomain && (
              <Fact label="Part of">
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => onOpen({ domain: parent })}
                >
                  {displayName(parentDomain)}
                </button>
              </Fact>
            )}
            <Fact label="Subdomains">
              {subdomains.length ? (
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {subdomains.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onOpen({ domain: fqnOf(s) })}
                    >
                      {displayName(s)}
                    </button>
                  ))}
                </span>
              ) : (
                <Muted>None</Muted>
              )}
            </Fact>
            <Fact label="Tags">
              <Tags tags={d.tags} />
            </Fact>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Data products
            {mine && (
              <Badge variant="secondary" className="tabular-nums">
                {mine.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Curated sets of assets this domain publishes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListStates
            state={{ ...products, data: mine }}
            what="data products"
            type="dataProduct"
            emptyTitle="No data products yet"
            empty="This domain publishes no data products."
          >
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(mine ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex h-full w-full items-start gap-3 rounded-lg p-3 text-left ring-1 ring-foreground/10 hover:bg-muted/50"
                    onClick={() => onOpen({ domain: fqn, product: fqnOf(p) })}
                  >
                    <TypeTile type="dataProduct" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {displayName(p)}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {p.description || "No description yet."}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        <Owners owners={p.owners} empty="No owner" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ListStates>
        </CardContent>
      </Card>
      <AssetsCard
        description="Data assets in this domain."
        assets={assets.data}
        error={assets.error}
        partial={assets.partial}
        empty="No assets are in this domain."
      />
    </>
  );
}

function ProductDetail({
  fqn,
  onBack,
  onOpenDomain,
}: {
  fqn: string;
  onBack: () => void;
  onOpenDomain: (fqn: string) => void;
}) {
  const q = useCall<OmEntity>("get", { type: "dataProduct", fqn });
  const p = q.data;
  const back = (
    <button
      type="button"
      className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={onBack}
    >
      <ChevronLeft className="size-3" aria-hidden /> Domain
    </button>
  );
  if (!p)
    return (
      <>
        {back}
        {q.error ? (
          <ErrorNote error={q.error} onRetry={q.reload} />
        ) : (
          <LoadingNote what="data product" />
        )}
      </>
    );
  const assets = refsAsAssets(refs(p.assets));
  return (
    <>
      {back}
      <EntityHeader type="dataProduct" entity={p} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <DescriptionCard type="dataProduct" entity={p} onSaved={q.reload} />
          <AssetsCard
            description="The assets this data product is made of."
            assets={"assets" in p ? assets : undefined}
            error={
              "assets" in p
                ? undefined
                : "This catalog did not return the data product’s assets."
            }
            empty="This data product has no assets yet."
          />
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>People</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Fact label="Domains">
              {p.domains?.length ? (
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {p.domains.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() =>
                        onOpenDomain(d.fullyQualifiedName ?? d.name ?? "")
                      }
                    >
                      {displayName(d)}
                    </button>
                  ))}
                </span>
              ) : (
                <Muted>None</Muted>
              )}
            </Fact>
            <Fact label="Owners">
              <Owners owners={p.owners} />
            </Fact>
            <Fact label="Experts">
              <Owners owners={refs(p.experts)} empty="No experts" />
            </Fact>
            <Fact label="Reviewers">
              <Owners owners={refs(p.reviewers)} empty="No reviewers" />
            </Fact>
            <Fact label="Tags">
              <Tags tags={p.tags} />
            </Fact>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
