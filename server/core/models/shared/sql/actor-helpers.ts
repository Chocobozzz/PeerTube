import { ActorImageType } from '@peertube/peertube-models'

export function getActorJoin (options: {
  base?: string
  on: string
  required: boolean
  type: 'account' | 'channel'
  includeAvatars?: boolean // default false
}) {
  const { base = '', on, includeAvatars = false, type, required } = options

  const avatarsJoin = includeAvatars
    ? getAvatarsJoin({ base: `${base}Actor`, on: `"${base}Actor"."id"` })
    : ''

  const join = required
    ? 'INNER JOIN'
    : 'LEFT JOIN'

  const column = type === 'account'
    ? 'accountId'
    : 'videoChannelId'

  return ` ${join} "actor" "${base}Actor" ON "${base}Actor"."${column}" = ${on} ` +
    `LEFT JOIN "server" "${base}Actor->Server" ` +
    `  ON "${base}Actor->Server"."id" = "${base}Actor"."serverId" ` +
    avatarsJoin
}

export function getChannelJoin (options: {
  base?: string
  on: string
  includeAccount: boolean
  includeAvatars: boolean
  includeActors: boolean
  required: boolean
}) {
  const { base = '', on, includeAccount, includeAvatars, includeActors, required } = options

  const accountJoin = includeAccount
    ? getAccountJoin({
      base: `${base}VideoChannel->`,
      on: `"${base}VideoChannel"."accountId"`,
      includeAvatars,
      includeActor: includeActors,
      required
    })
    : ''

  const actorJoin = includeActors
    ? getActorJoin({
      base: `${base}VideoChannel->`,
      on: `"${base}VideoChannel"."id"`,
      type: 'channel',
      includeAvatars,
      required
    })
    : ''

  const join = required
    ? 'INNER JOIN'
    : 'LEFT JOIN'

  return ` ${join} "videoChannel" "${base}VideoChannel" ON "${base}VideoChannel"."id" = ${on} ` +
    actorJoin +
    accountJoin
}

export function getAccountJoin (options: {
  base?: string
  on: string
  includeAvatars: boolean
  includeActor: boolean
  required: boolean
}) {
  const { base = '', on, includeAvatars, includeActor, required } = options

  const actorJoin = includeActor
    ? getActorJoin({
      base: `${base}Account->`,
      on: `"${base}Account"."id"`,
      type: 'account',
      includeAvatars,
      required
    })
    : ''

  return ` LEFT JOIN "account" "${base}Account" ON "${base}Account"."id" = ${on} ` +
    actorJoin
}

export function getAvatarsJoin (options: {
  base?: string
  on: string
}) {
  const { base = '', on } = options

  return ` LEFT JOIN "actorImage" "${base}Avatars" ` +
    `ON "${base}Avatars"."actorId" = ${on} ` +
    `AND "${base}Avatars"."type" = ${ActorImageType.AVATAR} `
}

/**
 * Build JSON directly in PostgreSQL to reduce amount of rows transferred and processed in JS
 */
export function getAvatarsJSONJoin (options: {
  attributes: string
  base: string
  on: string
}) {
  const { attributes, base, on } = options

  return `LEFT JOIN LATERAL (` +
    `SELECT json_agg(` +
    `  jsonb_build_object(${attributes})` +
    `) AS "Avatars"` +
    ` FROM "actorImage" WHERE "actorId" = ${on} AND "type" = ${ActorImageType.AVATAR}` +
    `) AS "${base}AvatarsJSON" ON TRUE `
}

export function getAvatarsJSONAttributes (base: string) {
  return `"${base}AvatarsJSON"."Avatars" AS "${base.replace(/->/g, '.')}Avatars"`
}

/**
 * Build JSON directly in PostgreSQL to reduce amount of rows transferred and processed in JS
 */
export function getBannersJSONJoin (options: {
  attributes: string
  base: string
  on: string
}) {
  const { attributes, base, on } = options

  return `LEFT JOIN LATERAL (` +
    `SELECT json_agg(` +
    `  jsonb_build_object(${attributes})` +
    `) AS "Banners"` +
    ` FROM "actorImage" WHERE "actorId" = ${on} AND "type" = ${ActorImageType.BANNER}` +
    `) AS "${base}BannersJSON" ON TRUE `
}

export function getBannersJSONAttributes (base: string) {
  return `"${base}BannersJSON"."Banners" AS "${base.replace(/->/g, '.')}Banners"`
}
