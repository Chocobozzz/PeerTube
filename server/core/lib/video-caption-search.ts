import { VideoCaptionSegment, VideoCaptionSegmentsSearchQueryAfterSanitize, VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { buildTSQueryTerms } from '@server/models/video/sql/video/videos-id-list-query-builder.js'

export type VideoCaptionSegmentsSearchOptions = Omit<VideoCaptionSegmentsSearchQueryAfterSanitize, 'search'> & { search: string }

/**
 * Search inside the caption text, and return the matching cues with their timestamps.
 */
export async function searchVideoCaptionSegments (options: VideoCaptionSegmentsSearchOptions): Promise<{
  total: number
  data: VideoCaptionSegment[]
}> {
  const { search, languageOneOf, sort, start, count } = options

  const tsQueryTerms = buildTSQueryTerms(search)
  if (tsQueryTerms === '') return { total: 0, data: [] }

  const tsQuery = 'WITH "tsQuery" AS (' +
    `SELECT to_tsquery('simple', immutable_unaccent(${sequelizeTypescript.escape(tsQueryTerms)})) AS "query"` +
    ')'

  const and: string[] = [
    '"videoCaptionSegment"."searchVector" @@ "tsQuery"."query"',

    // Captions of videos that are not publicly listed are never returned, even if they are indexed
    `"video"."state" = ${VideoState.PUBLISHED}`,
    `"video"."privacy" = ${VideoPrivacy.PUBLIC}`,
    '"video"."id" NOT IN (SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")'
  ]

  if (languageOneOf && languageOneOf.length !== 0) {
    and.push('"videoCaptionSegment"."language" IN (' +
      languageOneOf.map(language => sequelizeTypescript.escape(language)).join(', ') +
      ')'
    )
  }

  const where = and.join(' AND ')
  const order = sort === 'match' ? 'ASC' : 'DESC'

  const from = 'FROM "videoCaptionSegment" ' +
    'INNER JOIN "video" ON "video"."id" = "videoCaptionSegment"."videoId" ' +
    'CROSS JOIN "tsQuery" ' +
    `WHERE ${where}`

  const [ countRows, data ] = await Promise.all([
    sequelizeTypescript.query(
      `${tsQuery} SELECT COUNT(*) AS "total" ${from}`,
      { type: 'SELECT', plain: true }
    ) as Promise<{ total: string }>,

    sequelizeTypescript.query(
      `${tsQuery} SELECT ` +
      '  "video"."uuid" AS "videoUUID", ' +
      '  "video"."name" AS "videoName", ' +
      '  "videoCaptionSegment"."language" AS "language", ' +
      '  "videoCaptionSegment"."automaticallyGenerated" AS "automaticallyGenerated", ' +
      '  "videoCaptionSegment"."startMs" AS "startMs", ' +
      '  "videoCaptionSegment"."endMs" AS "endMs", ' +
      '  "videoCaptionSegment"."text" AS "text", ' +
      '  ts_rank("videoCaptionSegment"."searchVector", "tsQuery"."query") AS "similarity" ' +
      `${from} ` +
      `ORDER BY "similarity" ${order}, "videoCaptionSegment"."startMs" ASC ` +
      `LIMIT ${Math.floor(count)} OFFSET ${Math.floor(start)}`,
      { type: 'SELECT' }
    ) as Promise<VideoCaptionSegment[]>
  ])

  return {
    total: parseInt(countRows.total, 10),
    data: data.map(row => ({
      ...row,
      similarity: parseFloat(row.similarity as any)
    }))
  }
}
