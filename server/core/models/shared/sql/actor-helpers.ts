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
  includeAccount?: boolean // default false
  includeAvatars?: boolean // default false
}) {
  const { base = '', on, includeAccount = false, includeAvatars = false } = options

  const accountJoin = includeAccount
    ? getAccountJoin({ base: `${base}VideoChannel->`, on: `"${base}VideoChannel"."accountId"`, includeAvatars })
    : ''

  return ` LEFT JOIN "videoChannel" "${base}VideoChannel" ON "${base}VideoChannel"."id" = ${on} ` +
    getActorJoin({ base: `${base}VideoChannel->`, on: `"${base}VideoChannel"."actorId"`, includeAvatars }) +
    accountJoin
}

export function getAccountJoin (options: {
  base?: string
  on: string
  includeAvatars?: boolean // default false
}) {
  const { base = '', on, includeAvatars = false } = options

  return `LEFT JOIN "account" "${base}Account" ON "${base}Account"."id" = ${on} ` +
    getActorJoin({ base: `${base}Account->`, on: `"${base}Account"."actorId"`, includeAvatars })
}

export function getAvatarsJoin (options: {
  base?: string
  on: string
}) {
  const { base = '', on } = options

  return `LEFT JOIN "actorImage" "${base}Avatars" ` +
    `ON "${base}Avatars"."actorId" = ${on} ` +
    `AND "${base}Avatars"."type" = ${ActorImageType.AVATAR} `
}
