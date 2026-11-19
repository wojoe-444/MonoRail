import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Loader2, Pencil, RotateCw } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { call, canEdit, errorText } from "../api";
import { typeInfo } from "../catalog";
import { TypeTile } from "../parts";
import { openInCatalog } from "../tabs";
import type { OmEntity, OmRef } from "../types";
import { displayName } from "../util";
import { fqnOf, type AllState, type Asset } from "./governance-data";

/**
 * Building blocks shared by the governance tabs (Glossary, Classifications,
 * Domains, Data quality, Services, Teams and users): side lists, states,
 * headings, descriptions, asset lists and links into the Catalog tab. The data
 * helpers are in governance-data.ts.
 */

// ---------- States ----------

export function LoadingNote({ what = "" }: { what?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading
      {what ? ` ${what}` : ""}…
    </p>
  );
}

export function ErrorNote({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground"
    >
      <span className="min-w-0">{error}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyNote({
  type,
  title,
  children,
}: {
  type?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      {type && <TypeTile type={type} />}
      <p className="text-sm font-medium">{title}</p>
      {children && (
        <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  );
}

/** Loading / error / empty for a list, or the list itself. */
export function ListStates({
  state,
  what,
  type,
  emptyTitle,
  empty,
  children,
}: {
  state: { data?: unknown[]; error?: string; reload?: () => void };
  what: string;
  type?: string;
  emptyTitle: string;
  empty?: ReactNode;
  children: ReactNode;
}) {
  if (!state.data)
    return state.error ? (
      <ErrorNote error={state.error} onRetry={state.reload} />
    ) : (
      <LoadingNote what={what} />
    );
  if (!state.data.length)
    return (
      <EmptyNote type={type} title={emptyTitle}>
        {empty}
      </EmptyNote>
    );
  return <>{children}</>;
}

// ---------- Side list ----------

export interface SideItem {
  key: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  depth?: number;
  active?: boolean;
  onClick: () => void;
}

/** The list on the left of a list + detail tab: a filter, the items, and the states. */
export function SideList({
  title,
  type,
  state,
  items,
  emptyTitle,
  empty,
  footer,
}: {
  title: string;
  type: string;
  state: AllState;
  items: SideItem[];
  emptyTitle: string;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const shown = f
    ? items.filter((i) =>
        `${i.title} ${i.subtitle ?? ""}`.toLowerCase().includes(f),
      )
    : items;
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TypeTile type={type} className="size-6 rounded-md" />
          {title}
          {state.data && (
            <Badge variant="secondary" className="tabular-nums">
              {state.data.length}
              {state.truncated ? "+" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-2">
        {items.length > 6 && (
          <SearchField
            className="mx-2"
            size="sm"
            aria-label={`Filter ${title.toLowerCase()}`}
            placeholder="Filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        <ListStates
          state={state}
          what={title.toLowerCase()}
          emptyTitle={emptyTitle}
          empty={empty}
        >
          {shown.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Nothing matches.
            </p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
              {shown.map((i) => (
                <li key={i.key}>
                  <button
                    type="button"
                    aria-current={i.active || undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
                      i.active &&
                        "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft",
                    )}
                    style={
                      i.depth && !f
                        ? { paddingLeft: `${0.5 + i.depth}rem` }
                        : undefined
                    }
                    onClick={i.onClick}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {i.title}
                      </span>
                      {i.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {i.subtitle}
                        </span>
                      )}
                    </span>
                    {i.meta !== undefined && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {i.meta}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ListStates>
        {state.truncated && (
          <p className="px-2 text-xs text-muted-foreground">
            Showing the first {state.data?.length}. Open the Catalog tab for the
            rest.
          </p>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}

/** The grid of a list + detail tab. */
export function SplitLayout({
  side,
  children,
}: {
  side: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {side}
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}

// ---------- Detail parts ----------

/** An entity's heading: icon, name, badges, FQN, and a way into the Catalog tab. */
export function EntityHeader({
  type,
  entity,
  badges,
  sub,
  actions,
}: {
  type: string;
  entity: OmEntity;
  badges?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <TypeTile type={type} className="size-10" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {displayName(entity)}
            </h2>
            {badges}
            {entity.deleted && <Badge variant="destructive">Deleted</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{typeInfo(type)?.name ?? type}</span>
            <span aria-hidden>·</span>
            <span className="truncate font-mono">{fqnOf(entity)}</span>
            {sub}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions}
        <Button
          variant="outline"
          size="sm"
          onClick={() => openInCatalog({ type, fqn: fqnOf(entity) })}
        >
          <ExternalLink /> Open in Catalog
        </Button>
      </div>
    </div>
  );
}

/** A labeled fact in a details card. */
export function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-sm text-muted-foreground">{children}</span>
);

/** A link to an entity in the Catalog tab. */
export function EntityLink({
  type,
  fqn,
  children,
  className,
}: {
  type: string;
  fqn: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-w-0 truncate text-left text-primary underline-offset-2 hover:underline",
        className,
      )}
      onClick={() => openInCatalog({ type, fqn })}
    >
      {children}
    </button>
  );
}

/** Entity references as links, comma-separated, or `empty`. */
export function RefLinks({
  refs,
  empty = "None",
}: {
  refs: OmRef[] | undefined;
  empty?: string;
}) {
  if (!refs?.length) return <Muted>{empty}</Muted>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1">
      {refs.map((r) => (
        <EntityLink
          key={r.id}
          type={r.type}
          fqn={r.fullyQualifiedName ?? r.name ?? r.id}
          className="text-sm"
        >
          {displayName(r)}
        </EntityLink>
      ))}
    </span>
  );
}

/** Markdown with links and images inert, as on the rest of the page. */
export function Markdown({
  text,
  empty = "No description yet.",
}: {
  text?: string;
  empty?: string;
}) {
  if (!text?.trim())
    return <p className="text-sm text-muted-foreground italic">{empty}</p>;
  return (
    <div className="max-w-none text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <span
              className="text-primary underline underline-offset-2"
              title={href}
            >
              {children}
            </span>
          ),
          img: ({ alt }) => (
            <span className="text-muted-foreground">
              [image: {alt || "no description"}]
            </span>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** A description card, with an edit button where the catalog takes edits. */
export function DescriptionCard({
  type,
  entity,
  onSaved,
  className,
}: {
  type: string;
  entity: OmEntity;
  onSaved: () => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Description</CardTitle>
        {canEdit() && (
          <CardAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit description"
                  onClick={() => setEditing(true)}
                >
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit description</TooltipContent>
            </Tooltip>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <Markdown text={entity.description} />
      </CardContent>
      {editing && (
        <DescriptionDialog
          type={type}
          entity={entity}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </Card>
  );
}

/** Mounted only while open, so the draft starts from the current text. */
function DescriptionDialog({
  onClose,
  type,
  entity,
  onSaved,
}: {
  onClose: () => void;
  type: string;
  entity: OmEntity;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(entity.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await call("setDescription", { type, id: entity.id, description: draft });
      onClose();
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Description of {displayName(entity)}</DialogTitle>
          <DialogDescription>
            Markdown. The catalog keeps the old text as a version.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="om-gov-description">Description</Label>
          <Textarea
            id="om-gov-description"
            rows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || draft === (entity.description ?? "")}
            onClick={() => void save()}
          >
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A card listing data assets (from a scan or an entity's `assets`), each a link into the Catalog. */
export function AssetsCard({
  title = "Assets",
  description,
  assets,
  error,
  partial,
  empty,
}: {
  title?: string;
  description?: string;
  assets: Asset[] | undefined;
  error?: string;
  partial?: boolean;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {assets && (
            <Badge variant="secondary" className="tabular-nums">
              {assets.length}
            </Badge>
          )}
        </CardTitle>
        {(description || partial) && (
          <CardDescription>
            {description}
            {partial
              ? `${description ? " " : ""}Read from the first 100 of each asset type, so some may be missing.`
              : ""}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!assets ? (
          error ? (
            <ErrorNote error={error} />
          ) : (
            <LoadingNote what="assets" />
          )
        ) : !assets.length ? (
          <p className="py-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {assets.map(({ type, entity }) => (
              <li key={`${type}|${entity.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/50"
                  onClick={() => openInCatalog({ type, fqn: fqnOf(entity) })}
                >
                  <TypeTile type={type} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {displayName(entity)}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {fqnOf(entity)}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {typeInfo(type)?.name ?? type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** A small table (MonoRail has no table primitive): header row and rows with dividers. */
export function SimpleTable({
  head,
  children,
  className,
}: {
  head: { label: string; className?: string }[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("-mx-2 overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn("px-2 py-2 font-medium", h.className)}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}
