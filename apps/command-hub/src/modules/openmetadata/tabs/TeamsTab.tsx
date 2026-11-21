import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { formatCount } from "@/lib/format";

import { useCall } from "../api";
import { Owners } from "../parts";
import type { OmEntity, OmRef } from "../types";
import { ago, displayName } from "../util";
import {
  AssetsCard,
  DescriptionCard,
  EmptyNote,
  EntityHeader,
  ErrorNote,
  Fact,
  LoadingNote,
  Muted,
  RefLinks,
  SideList,
  SplitLayout,
  type SideItem,
} from "./governance";
import {
  fqnOf,
  refsAsAssets,
  sortByName,
  useAll,
  useAssetScan,
  type AllState,
} from "./governance-data";
import type { OmTabProps } from "./types";

type Mode = "teams" | "users" | "bots" | "roles";
const refs = (v: unknown): OmRef[] => (Array.isArray(v) ? (v as OmRef[]) : []);

const TEAM_TYPE: Record<string, string> = {
  Organization: "Organization",
  BusinessUnit: "Business unit",
  Division: "Division",
  Department: "Department",
  Group: "Group",
};

/**
 * Teams and users: the team hierarchy, the people and bots, and the roles.
 * One team shows its members and the assets it owns; one user their teams,
 * roles and owned assets; one role its policies and who has it.
 */
export default function TeamsTab({ counts }: OmTabProps) {
  const teams = useAll("team");
  const users = useAll("user", 1000);
  const roles = useAll("role");
  const [mode, setMode] = useState<Mode>("teams");
  const [picked, setPicked] = useState<Partial<Record<Mode, string>>>({});
  const go = (m: Mode, fqn: string) => {
    setMode(m);
    setPicked((p) => ({ ...p, [m]: fqn }));
  };
  const openUser = (u: OmRef) =>
    go(
      users.data?.find((x) => x.id === u.id)?.isBot === true ? "bots" : "users",
      u.fullyQualifiedName ?? u.name ?? "",
    );

  // Teams as a tree, under their parents (the organization at the top).
  const teamItems = useMemo(() => {
    const all = teams.data ?? [];
    const ids = new Set(all.map((t) => t.id));
    const out: { t: OmEntity; depth: number }[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | undefined, depth: number) => {
      for (const t of sortByName(
        all.filter(
          (x) =>
            (refs(x.parents).find((p) => ids.has(p.id))?.id ?? undefined) ===
            parent,
        ),
      )) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push({ t, depth });
        walk(t.id, depth + 1);
      }
    };
    walk(undefined, 0);
    return out;
  }, [teams.data]);
  const people = useMemo(
    () =>
      sortByName(
        (users.data ?? []).filter((u) =>
          mode === "bots" ? u.isBot === true : u.isBot !== true,
        ),
      ),
    [users.data, mode],
  );
  const roleList = useMemo(() => sortByName(roles.data ?? []), [roles.data]);

  const state: AllState =
    mode === "teams"
      ? teams
      : mode === "roles"
        ? roles
        : { ...users, data: users.data && people };
  const items: SideItem[] =
    mode === "teams"
      ? teamItems.map(({ t, depth }) => ({
          key: t.id,
          title: displayName(t),
          subtitle: TEAM_TYPE[String(t.teamType)] ?? undefined,
          depth,
          meta:
            typeof t.userCount === "number"
              ? formatCount(t.userCount)
              : undefined,
          onClick: () => go("teams", fqnOf(t)),
        }))
      : mode === "roles"
        ? roleList.map((r) => ({
            key: r.id,
            title: displayName(r),
            subtitle: r.provider === "system" ? "System" : undefined,
            onClick: () => go("roles", fqnOf(r)),
          }))
        : people.map((u) => ({
            key: u.id,
            title: displayName(u),
            subtitle: typeof u.email === "string" ? u.email : u.name,
            meta: u.isAdmin === true ? "Admin" : undefined,
            onClick: () => go(mode, fqnOf(u)),
          }));
  const first = items[0]
    ? mode === "teams"
      ? fqnOf(teamItems[0].t)
      : mode === "roles"
        ? fqnOf(roleList[0])
        : fqnOf(people[0])
    : undefined;
  const current = picked[mode] ?? first;
  const shownItems = items.map((i, n) => ({
    ...i,
    active:
      (mode === "teams"
        ? fqnOf(teamItems[n].t)
        : mode === "roles"
          ? fqnOf(roleList[n])
          : fqnOf(people[n])) === current,
  }));
  const titles: Record<Mode, string> = {
    teams: "Teams",
    users: "Users",
    bots: "Bots",
    roles: "Roles",
  };
  const sideType: Record<Mode, string> = {
    teams: "team",
    users: "user",
    bots: "bot",
    roles: "role",
  };

  return (
    <div className="flex flex-col gap-6">
      <Segmented
        className="w-fit"
        aria-label="Show"
        value={mode}
        onChange={setMode}
        options={[
          { value: "teams", label: "Teams" },
          { value: "users", label: "Users" },
          { value: "bots", label: "Bots" },
          { value: "roles", label: "Roles" },
        ]}
      />
      <SplitLayout
        side={
          <SideList
            title={titles[mode]}
            type={sideType[mode]}
            state={state}
            items={shownItems}
            emptyTitle={`No ${titles[mode].toLowerCase()}`}
          />
        }
      >
        {!current ? (
          state.data ? (
            <EmptyNote
              type={sideType[mode]}
              title={`No ${titles[mode].toLowerCase()} to show`}
            />
          ) : null
        ) : mode === "teams" ? (
          <TeamDetail
            key={current}
            fqn={current}
            users={users}
            counts={counts.data}
            onOpenTeam={(f) => go("teams", f)}
            onOpenUser={openUser}
          />
        ) : mode === "roles" ? (
          <RoleDetail
            key={current}
            fqn={current}
            users={users}
            teams={teams}
            onOpenUser={openUser}
            onOpenTeam={(f) => go("teams", f)}
          />
        ) : (
          <UserDetail
            key={current}
            fqn={current}
            counts={counts.data}
            onOpenTeam={(f) => go("teams", f)}
            onOpenRole={(f) => go("roles", f)}
          />
        )}
      </SplitLayout>
    </div>
  );
}

function Detail({
  q,
  what,
  children,
}: {
  q: { data?: OmEntity; error?: string; reload: () => void };
  what: string;
  children: (e: OmEntity) => ReactNode;
}) {
  if (!q.data)
    return q.error ? (
      <ErrorNote error={q.error} onRetry={q.reload} />
    ) : (
      <LoadingNote what={what} />
    );
  return <>{children(q.data)}</>;
}

function LinkList({
  items,
  onOpen,
  empty,
}: {
  items: OmRef[];
  onOpen: (r: OmRef) => void;
  empty: string;
}) {
  if (!items.length) return <Muted>{empty}</Muted>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1">
      {items.map((r) => (
        <button
          key={r.id}
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => onOpen(r)}
        >
          {displayName(r)}
        </button>
      ))}
    </span>
  );
}

/** People as rows: name, email, and a link to open them. */
function PeopleCard({
  title,
  description,
  people,
  loading,
  error,
  onOpen,
  empty,
}: {
  title: string;
  description?: string;
  people: OmRef[] | undefined;
  loading?: boolean;
  error?: string;
  onOpen: (r: OmRef) => void;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {people && (
            <Badge variant="secondary" className="tabular-nums">
              {people.length}
            </Badge>
          )}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {!people ? (
          error ? (
            <ErrorNote error={error} />
          ) : loading ? (
            <LoadingNote what="people" />
          ) : null
        ) : !people.length ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {sortByName(people).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/50"
                  onClick={() => onOpen(u)}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
                    aria-hidden
                  >
                    {displayName(u)
                      .split(/[\s.]+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {displayName(u)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.name}
                    </span>
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

function TeamDetail({
  fqn,
  users,
  counts,
  onOpenTeam,
  onOpenUser,
}: {
  fqn: string;
  users: AllState;
  counts: OmTabProps["counts"]["data"];
  onOpenTeam: (fqn: string) => void;
  onOpenUser: (r: OmRef) => void;
}) {
  const q = useCall("get", { type: "team", fqn });
  const assets = useAssetScan(counts, q.data ? { owner: q.data.id } : null);
  return (
    <Detail q={q} what="team">
      {(t) => {
        // Members from the team, else from the users that list it.
        const members =
          "users" in t
            ? refs(t.users)
            : users.data
                ?.filter((u) => refs(u.teams).some((x) => x.id === t.id))
                .map((u) => ({
                  id: u.id,
                  type: "user",
                  name: u.name,
                  fullyQualifiedName: u.fullyQualifiedName,
                  displayName: u.displayName,
                }));
        const owns = refs(t.owns);
        return (
          <>
            <EntityHeader
              type="team"
              entity={t}
              badges={
                typeof t.teamType === "string" && (
                  <Badge variant="primary">
                    {TEAM_TYPE[t.teamType] ?? t.teamType}
                  </Badge>
                )
              }
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <DescriptionCard
                className="xl:col-span-2"
                type="team"
                entity={t}
                onSaved={q.reload}
              />
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <Fact label="Type">
                    {TEAM_TYPE[String(t.teamType)] ?? <Muted>Not set</Muted>}
                  </Fact>
                  <Fact label="Email">
                    {typeof t.email === "string" ? (
                      t.email
                    ) : (
                      <Muted>None</Muted>
                    )}
                  </Fact>
                  <Fact label="Members">
                    {typeof t.userCount === "number"
                      ? formatCount(t.userCount)
                      : members
                        ? formatCount(members.length)
                        : "–"}
                  </Fact>
                  <Fact label="Part of">
                    <LinkList
                      items={refs(t.parents)}
                      onOpen={(r) =>
                        onOpenTeam(r.fullyQualifiedName ?? r.name ?? "")
                      }
                      empty="Top level"
                    />
                  </Fact>
                  <Fact label="Sub-teams">
                    <LinkList
                      items={refs(t.children)}
                      onOpen={(r) =>
                        onOpenTeam(r.fullyQualifiedName ?? r.name ?? "")
                      }
                      empty="None"
                    />
                  </Fact>
                  <Fact label="Default roles">
                    <RefLinks refs={refs(t.defaultRoles)} />
                  </Fact>
                  <Fact label="Owners">
                    <Owners owners={t.owners} />
                  </Fact>
                </CardContent>
              </Card>
            </div>
            <PeopleCard
              title="Members"
              people={members}
              loading={users.loading}
              error={users.error}
              onOpen={onOpenUser}
              empty="This team has no members."
            />
            {owns.length ? (
              <AssetsCard
                title="Owned assets"
                assets={refsAsAssets(owns)}
                empty="This team owns nothing."
              />
            ) : (
              <AssetsCard
                title="Owned assets"
                description="Data assets this team owns."
                assets={assets.data}
                error={assets.error}
                partial={assets.partial}
                empty="This team owns no data assets."
              />
            )}
          </>
        );
      }}
    </Detail>
  );
}

function UserDetail({
  fqn,
  counts,
  onOpenTeam,
  onOpenRole,
}: {
  fqn: string;
  counts: OmTabProps["counts"]["data"];
  onOpenTeam: (fqn: string) => void;
  onOpenRole: (fqn: string) => void;
}) {
  const q = useCall("get", { type: "user", fqn });
  const owns = refs(q.data?.owns);
  const assets = useAssetScan(
    counts,
    q.data && !owns.length ? { owner: q.data.id } : null,
  );
  return (
    <Detail q={q} what="user">
      {(u) => (
        <>
          <EntityHeader
            type="user"
            entity={u}
            badges={
              <>
                {u.isBot === true && <Badge variant="secondary">Bot</Badge>}
                {u.isAdmin === true && <Badge variant="primary">Admin</Badge>}
              </>
            }
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <DescriptionCard
              className="xl:col-span-2"
              type="user"
              entity={u}
              onSaved={q.reload}
            />
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Fact label="User name">
                  <span className="font-mono">{u.name}</span>
                </Fact>
                <Fact label="Email">
                  {typeof u.email === "string" ? u.email : <Muted>None</Muted>}
                </Fact>
                <Fact label="Teams">
                  <LinkList
                    items={refs(u.teams)}
                    onOpen={(r) =>
                      onOpenTeam(r.fullyQualifiedName ?? r.name ?? "")
                    }
                    empty="No team"
                  />
                </Fact>
                <Fact label="Roles">
                  <LinkList
                    items={refs(u.roles)}
                    onOpen={(r) =>
                      onOpenRole(r.fullyQualifiedName ?? r.name ?? "")
                    }
                    empty="No role"
                  />
                </Fact>
                {refs(u.inheritedRoles).length > 0 && (
                  <Fact label="Roles from teams">
                    <LinkList
                      items={refs(u.inheritedRoles)}
                      onOpen={(r) =>
                        onOpenRole(r.fullyQualifiedName ?? r.name ?? "")
                      }
                      empty="None"
                    />
                  </Fact>
                )}
                <Fact label="Updated">{ago(u.updatedAt) || "–"}</Fact>
              </CardContent>
            </Card>
          </div>
          {owns.length ? (
            <AssetsCard
              title="Owns"
              assets={refsAsAssets(owns)}
              empty="Owns nothing."
            />
          ) : (
            <AssetsCard
              title="Owns"
              description="Data assets this user owns directly."
              assets={assets.data}
              error={assets.error}
              partial={assets.partial}
              empty="This user owns no data assets."
            />
          )}
          {refs(u.follows).length > 0 && (
            <AssetsCard
              title="Follows"
              assets={refsAsAssets(refs(u.follows))}
              empty="Follows nothing."
            />
          )}
        </>
      )}
    </Detail>
  );
}

function RoleDetail({
  fqn,
  users,
  teams,
  onOpenUser,
  onOpenTeam,
}: {
  fqn: string;
  users: AllState;
  teams: AllState;
  onOpenUser: (r: OmRef) => void;
  onOpenTeam: (fqn: string) => void;
}) {
  const q = useCall("get", { type: "role", fqn });
  return (
    <Detail q={q} what="role">
      {(r) => {
        const holders =
          "users" in r
            ? refs(r.users)
            : users.data
                ?.filter((u) => refs(u.roles).some((x) => x.id === r.id))
                .map((u) => ({
                  id: u.id,
                  type: "user",
                  name: u.name,
                  fullyQualifiedName: u.fullyQualifiedName,
                  displayName: u.displayName,
                }));
        const teamHolders =
          "teams" in r
            ? refs(r.teams)
            : (teams.data ?? [])
                .filter((t) => refs(t.defaultRoles).some((x) => x.id === r.id))
                .map((t) => ({
                  id: t.id,
                  type: "team",
                  name: t.name,
                  fullyQualifiedName: t.fullyQualifiedName,
                  displayName: t.displayName,
                }));
        return (
          <>
            <EntityHeader
              type="role"
              entity={r}
              badges={
                r.provider === "system" && (
                  <Badge variant="outline">System</Badge>
                )
              }
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <DescriptionCard
                className="xl:col-span-2"
                type="role"
                entity={r}
                onSaved={q.reload}
              />
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <Fact label="Policies">
                    <RefLinks refs={refs(r.policies)} empty="No policies" />
                  </Fact>
                  <Fact label="Teams with this role by default">
                    <LinkList
                      items={teamHolders}
                      onOpen={(t) =>
                        onOpenTeam(t.fullyQualifiedName ?? t.name ?? "")
                      }
                      empty="None"
                    />
                  </Fact>
                  <Fact label="Default role">
                    {r.defaultRole === true
                      ? "Yes: every new user gets it"
                      : "No"}
                  </Fact>
                </CardContent>
              </Card>
            </div>
            <PeopleCard
              title="Users with this role"
              people={holders}
              loading={users.loading}
              error={users.error}
              onOpen={onOpenUser}
              empty="No user has this role directly."
            />
          </>
        );
      }}
    </Detail>
  );
}
