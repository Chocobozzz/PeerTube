import { ActorImageType } from '@peertube/peertube-models'

export function getActorJoin (options: {
  base?: string
  on: string
  includeAvatars?: boolean // default false
}) {
  const { base = '', on, includeAvatars = false } = options

  const avatarsJoin = includeAvatars
    ? getAvatarsJoin({ base: `${base}Actor`, on: `"${base}Actor"."id"` })
    : ''

  return ` LEFT JOIN "actor" "${base}Actor" ON "${base}Actor"."id" = ${on} ` +
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
}) {
  const { base = '', on, includeAccount, includeAvatars, includeActors } = options

  const accountJoin = includeAccount
    ? getAccountJoin({
      base: `${base}VideoChannel->`,
      on: `"${base}VideoChannel"."accountId"`,
      includeAvatars,
      includeActor: includeActors
    })
    : ''

  const actorJoin = includeActors
    ? getActorJoin({ base: `${base}VideoChannel->`, on: `"${base}VideoChannel"."actorId"`, includeAvatars })
    : ''

  return ` LEFT JOIN "videoChannel" "${base}VideoChannel" ON "${base}VideoChannel"."id" = ${on} ` +
    actorJoin +
    accountJoin
}

export function getAccountJoin (options: {
  base?: string
  on: string
  includeAvatars: boolean
  includeActor: boolean
}) {
  const { base = '', on, includeAvatars, includeActor } = options

  const actorJoin = includeActor
    ? getActorJoin({ base: `${base}Account->`, on: `"${base}Account"."actorId"`, includeAvatars })
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
