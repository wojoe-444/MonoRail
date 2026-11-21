import { useCallback, useEffect, useMemo, useState } from "react";

import { call, errorText } from "../api";
import { GROUPS } from "../catalog";
import type { OmCounts, OmEntity, OmRef } from "../types";
import { countOf, displayName } from "../util";

/**
 * Data helpers shared by the governance tabs (governance.tsx has the
 * components): loading every entity of a type, a scan of the data assets,
 * and FQN helpers.
 */

// ---------- Loading ----------

export interface AllState {
  data: OmEntity[] | undefined;
  error: string | undefined;
  loading: boolean;
  /** More exist than were loaded (the cap was reached). */
  truncated: boolean;
  reload: () => void;
}

/** Every entity of a type, a page of 100 at a time, up to `max`. `null` loads nothing. */
export function useAll(type: string | null, max = 500): AllState {
  const [state, setState] = useState<{
    key: string | null;
    data?: OmEntity[];
    error?: string;
    truncated: boolean;
  }>({ key: null, truncated: false });
  const [tick, setTick] = useState(0);
  const key = type === null ? null : `${type}|${max}|${tick}`;
  useEffect(() => {
    if (type === null || key === null) return;
    let live = true;
    (async () => {
      const rows: OmEntity[] = [];
      let after: string | undefined;
      do {
        const page = await call("list", {
          type,
          limit: 100,
          ...(after ? { after } : {}),
        });
        rows.push(...page.data);
        after = page.paging?.after;
      } while (after && rows.length < max);
      return { rows, truncated: !!after };
    })().then(
      ({ rows, truncated }) => live && setState({ key, data: rows, truncated }),
      (e: unknown) =>
        live && setState({ key, error: errorText(e), truncated: false }),
    );
    return () => {
      live = false;
    };
  }, [type, key, max]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && !current,
    truncated: current && state.truncated,
    reload,
  };
}

/** Load the full entity (every field) for each of `items` that lacks `field`. At most `max`. */
export function useFull(
  type: string,
  items: OmEntity[] | undefined,
  field: string,
  max = 100,
): Map<string, OmEntity> {
  const [full, setFull] = useState(new Map<string, OmEntity>());
  const missing = useMemo(
    () =>
      (items ?? [])
        .filter((e) => !(field in e))
        .slice(0, max)
        .map((e) => e.fullyQualifiedName ?? e.name),
    [items, field, max],
  );
  const key = missing.join("\n");
  useEffect(() => {
    if (!key) return;
    let live = true;
    const names = key.split("\n");
    // A few at a time, so a server is not flooded.
    (async () => {
      for (let i = 0; i < names.length && live; i += 6) {
        const got = await Promise.all(
          names
            .slice(i, i + 6)
            .map((fqn) =>
              call("get", { type, fqn }).catch(() => undefined),
            ),
        );
        if (!live) return;
        setFull((m) => {
          const next = new Map(m);
          for (const e of got) if (e) next.set(e.id, e);
          return next;
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [type, key]);
  return full;
}

/** The data asset types (tables, dashboards, ...), as the Catalog groups them. */
export const ASSET_TYPES =
  GROUPS.find((g) => g.id === "assets")?.types.map((t) => t.type) ?? [];

export interface Asset {
  type: string;
  entity: OmEntity;
}

export interface AssetScan {
  data: Asset[] | undefined;
  error: string | undefined;
  /** Some types have more than the first page that was read. */
  partial: boolean;
}

/** What an asset scan looks for: a tag or glossary term, any tag under a prefix (a classification), a domain, or an owner (user or team id). */
export type AssetFilter =
  | { tag: string }
  | { tagPrefix: string }
  | { domain: string }
  | { owner: string };

function matches(e: OmEntity, f: AssetFilter): boolean {
  if ("tag" in f) return !!e.tags?.some((t) => t.tagFQN === f.tag);
  if ("tagPrefix" in f)
    return !!e.tags?.some((t) => t.tagFQN.startsWith(f.tagPrefix));
  if ("domain" in f)
    return !!e.domains?.some(
      (d) => (d.fullyQualifiedName ?? d.name) === f.domain,
    );
  return !!e.owners?.some((o) => o.id === f.owner);
}

/**
 * The data assets that `filter` picks, from the first 100 of each asset type
 * the catalog has. There is no search here, so this reads lists; asset-level
 * fields only (owners, tags, domains), not columns.
 */
export function useAssetScan(
  counts: OmCounts | undefined,
  filter: AssetFilter | null,
): AssetScan {
  const types = useMemo(
    () => ASSET_TYPES.filter((t) => (countOf(counts, t).n ?? 0) > 0),
    [counts],
  );
  const want = filter && counts ? JSON.stringify({ filter, types }) : null;
  const [state, setState] = useState<{
    key: string;
    rows?: Asset[];
    error?: string;
    partial: boolean;
  }>();
  useEffect(() => {
    if (!want) return;
    const { filter: f, types: ts } = JSON.parse(want) as {
      filter: AssetFilter;
      types: string[];
    };
    let live = true;
    Promise.all(
      ts.map((type) =>
        call("list", { type, limit: 100 }).then((page) => ({
          type,
          page,
        })),
      ),
    )
      .then((pages) => {
        if (!live) return;
        const rows = pages.flatMap(({ type, page }) =>
          page.data
            .filter((e) => matches(e, f))
            .map((entity) => ({ type, entity })),
        );
        setState({
          key: want,
          rows,
          partial: pages.some((p) => !!p.page.paging?.after),
        });
      })
      .catch(
        (e: unknown) =>
          live && setState({ key: want, error: errorText(e), partial: false }),
      );
    return () => {
      live = false;
    };
  }, [want]);
  const current = !!want && state?.key === want;
  return {
    data: current ? state?.rows : undefined,
    error: current ? state?.error : undefined,
    partial: !!(current && state?.partial),
  };
}

// ---------- FQNs ----------

/** OpenMetadata FQN parts: dot-separated, a part with a dot in it is double-quoted. */
export function splitFqn(fqn: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of fqn) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "." && !quoted) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

export const joinFqn = (parts: string[]) =>
  parts.map((p) => (p.includes(".") ? `"${p}"` : p)).join(".");

/** The parent FQN (everything but the last part), or undefined at the top. */
export function parentFqn(fqn: string): string | undefined {
  const parts = splitFqn(fqn);
  return parts.length > 1 ? joinFqn(parts.slice(0, -1)) : undefined;
}

export const fqnOf = (e: { fullyQualifiedName?: string; name?: string }) =>
  e.fullyQualifiedName ?? e.name ?? "";

export const sortByName = <T extends { displayName?: string; name?: string }>(
  xs: T[],
) => [...xs].sort((a, b) => displayName(a).localeCompare(displayName(b)));

/** References (e.g. a data product's `assets`) as Asset rows. */
export const refsAsAssets = (refs: OmRef[] | undefined): Asset[] =>
  (refs ?? []).map((r) => ({
    type: r.type,
    entity: {
      id: r.id,
      name: r.name ?? r.id,
      fullyQualifiedName: r.fullyQualifiedName,
      displayName: r.displayName,
    },
  }));
