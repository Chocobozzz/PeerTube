import { addValuesToSet, areSetMembers, popSetMembers, replaceSet } from './redis-client.js'

export type ActorFollowHealthKind = 'good-inboxes' | 'bad-inboxes' | 'good-server-ids' | 'bad-server-ids'

export async function addActorFollowHealth (kind: ActorFollowHealthKind, values: string[]) {
  if (values.length === 0) return

  await addValuesToSet(buildKey(kind), values)
}

export function popActorFollowHealth (kind: ActorFollowHealthKind) {
  return popSetMembers(buildKey(kind))
}

// ---------------------------------------------------------------------------

export function setLastBadInboxes (inboxes: string[]) {
  return replaceSet(buildKey('last-bad-inboxes'), inboxes)
}

export function areLastBadInboxes (inboxes: string[]) {
  return areSetMembers(buildKey('last-bad-inboxes'), inboxes)
}

// ---------------------------------------------------------------------------

function buildKey (kind: ActorFollowHealthKind | 'last-bad-inboxes') {
  return 'actor-follow-health-' + kind
}
