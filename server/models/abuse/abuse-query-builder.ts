
import { exists } from '@server/helpers/custom-validators/misc'
import { AbuseFilter, AbuseState, AbuseVideoIs } from '@shared/models'
import { buildBlockedAccountSQL, buildDirectionAndField } from '../utils'

export type BuildAbusesQueryOptions = {
  start: number
  count: number
  sort: string

  // search
  search?: string
  searchReporter?: string
  searchReportee?: string

  // video releated
  searchVideo?: string
  searchVideoChannel?: string
  videoIs?: AbuseVideoIs

  // filters
  id?: number
  predefinedReasonId?: number
  filter?: AbuseFilter

  state?: AbuseState

  // accountIds
  serverAccountId?: number
  userAccountId?: number

  reporterAccountId?: number
}

function buildAbuseListQuery (options: BuildAbusesQueryOptions, type: 'count' | 'id') {
  const whereAnd: string[] = []
  const replacements: any = {}

  const joins = [
    'LEFT JOIN "videoAbuse" ON "videoAbuse"."abuseId" = "abuse"."id"',
    'LEFT JOIN "video" ON "videoAbuse"."videoId" = "video"."id"',
    'LEFT JOIN "videoBlacklist" ON "videoBlacklist"."videoId" = "video"."id"',
    'LEFT JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id"',
    'LEFT JOIN "account" "reporterAccount" ON "reporterAccount"."id" = "abuse"."reporterAccountId"',
    'LEFT JOIN "account" "flaggedAccount" ON "flaggedAccount"."id" = "abuse"."reporterAccountId"',
    'LEFT JOIN "commentAbuse" ON "commentAbuse"."abuseId" = "abuse"."id"',
    'LEFT JOIN "videoComment" ON "commentAbuse"."videoCommentId" = "videoComment"."id"'
  ]

  if (options.serverAccountId || options.userAccountId) {
    whereAnd.push('"abuse"."reporterAccountId" NOT IN (' + buildBlockedAccountSQL([ options.serverAccountId, options.userAccountId ]) + ')')
  }

  if (options.reporterAccountId) {
    whereAnd.push('"abuse"."reporterAccountId" = :reporterAccountId')
    replacements.reporterAccountId = options.reporterAccountId
  }

  if (options.search) {
    const searchWhereOr = [
      '"video"."name" ILIKE :search',
      '"videoChannel"."name" ILIKE :search',
      `"videoAbuse"."deletedVideo"->>'name' ILIKE :search`,
      `"videoAbuse"."deletedVideo"->'channel'->>'displayName' ILIKE :search`,
      '"reporterAccount"."name" ILIKE :search',
      '"flaggedAccount"."name" ILIKE :search'
    ]

    replacements.search = `%${options.search}%`
    whereAnd.push('(' + searchWhereOr.join(' OR ') + ')')
  }

  if (options.searchVideo) {
    whereAnd.push('"video"."name" ILIKE :searchVideo')
    replacements.searchVideo = `%${options.searchVideo}%`
  }

  if (options.searchVideoChannel) {
    whereAnd.push('"videoChannel"."name" ILIKE :searchVideoChannel')
    replacements.searchVideoChannel = `%${options.searchVideoChannel}%`
  }

  if (options.id) {
    whereAnd.push('"abuse"."id" = :id')
    replacements.id = options.id
  }

  if (options.state) {
    whereAnd.push('"abuse"."state" = :state')
    replacements.state = options.state
  }

  if (options.videoIs === 'deleted') {
    whereAnd.push('"videoAbuse"."deletedVideo" IS NOT NULL')
  } else if (options.videoIs === 'blacklisted') {
    whereAnd.push('"videoBlacklist"."id" IS NOT NULL')
  }

  if (options.predefinedReasonId) {
    whereAnd.push(':predefinedReasonId = ANY("abuse"."predefinedReasons")')
    replacements.predefinedReasonId = options.predefinedReasonId
  }

  if (options.filter === 'video') {
    whereAnd.push('"videoAbuse"."id" IS NOT NULL')
  } else if (options.filter === 'comment') {
    whereAnd.push('"commentAbuse"."id" IS NOT NULL')
  } else if (options.filter === 'account') {
    whereAnd.push('"videoAbuse"."id" IS NULL AND "commentAbuse"."id" IS NULL')
  }

  if (options.searchReporter) {
    whereAnd.push('"reporterAccount"."name" ILIKE :searchReporter')
    replacements.searchReporter = `%${options.searchReporter}%`
  }

  if (options.searchReportee) {
    whereAnd.push('"flaggedAccount"."name" ILIKE :searchReportee')
    replacements.searchReportee = `%${options.searchReportee}%`
  }

  const prefix = type === 'count'
    ? 'SELECT COUNT("abuse"."id") AS "total"'
    : 'SELECT "abuse"."id" '

  let suffix = ''
  if (type !== 'count') {

    if (options.sort) {
      const order = buildAbuseOrder(options.sort)
      suffix += `${order} `
    }

    if (exists(options.count)) {
      const count = parseInt(options.count + '', 10)
      suffix += `LIMIT ${count} `
    }

    if (exists(options.start)) {
      const start = parseInt(options.start + '', 10)
      suffix += `OFFSET ${start} `
    }
  }

  const where = whereAnd.length !== 0
    ? `WHERE ${whereAnd.join(' AND ')}`
    : ''

  return {
    query: `${prefix} FROM "abuse" ${joins.join(' ')} ${where} ${suffix}`,
    replacements
  }
}

function buildAbuseOrder (value: string) {
  const { direction, field } = buildDirectionAndField(value)

  return `ORDER BY "abuse"."${field}" ${direction}`
}

export {
  buildAbuseListQuery
}
