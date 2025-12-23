import { VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { getAvatarsJoin, getChannelJoin } from '@server/models/shared/sql/actor-helpers.js'
import { Sequelize } from 'sequelize'
import { VideoImportTableAttributes } from './video-import-table-attributes.js'

export interface ListVideoImportsOptions extends AbstractListQueryOptions {
  userId: number

  id?: number
  videoId?: number
  search?: string
  targetUrl?: string
  videoChannelSyncId?: number

  collaborationAccountId?: number
}

export class VideoImportListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoImportTableAttributes()

  private builtVideoJoin = false
  private builtTagJoin = false
  private builtChannelCollaboratorsJoin = false
  private builtThumbnailJoin = false
  private builtAccountAvatarJoin = false
  private builtChannelAvatarJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListVideoImportsOptions
  ) {
    super(sequelize, { modelName: 'VideoImportModel', tableName: 'videoImport' }, options)
  }

  // ---------------------------------------------------------------------------

  protected buildSubQueryWhere () {
    const where: string[] = []

    this.buildVideoJoin()

    if (this.options.collaborationAccountId) {
      this.buildChannelCollaboratorsJoin()

      where.push(
        '(' +
          '"VideoImportModel"."userId" = :userId OR ' +
          '"Video->VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId OR ' +
          '"Video->VideoChannel->Account"."userId" = :userId' +
          ')'
      )

      this.replacements.collaborationAccountId = this.options.collaborationAccountId
      this.replacements.userId = this.options.userId
    } else {
      where.push(
        '(' +
          '"VideoImportModel"."userId" = :userId OR ' +
          '"Video->VideoChannel->Account"."userId" = :userId' +
          ')'
      )

      this.replacements.userId = this.options.userId
    }

    if (this.options.id) {
      where.push('"VideoImportModel"."id" = :id')

      this.replacements.id = this.options.id
    }

    if (this.options.videoId) {
      where.push('"VideoImportModel"."videoId" = :videoId')

      this.replacements.videoId = this.options.videoId
    }

    if (this.options.targetUrl) {
      where.push('"VideoImportModel"."targetUrl" = :targetUrl')

      this.replacements.targetUrl = this.options.targetUrl
    }

    if (this.options.videoChannelSyncId) {
      where.push('"VideoImportModel"."videoChannelSyncId" = :videoChannelSyncId')

      this.replacements.videoChannelSyncId = this.options.videoChannelSyncId
    }

    if (this.options.search) {
      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      where.push(
        `(` +
          `lower(immutable_unaccent("Video"."name")) LIKE lower(immutable_unaccent(${escapedLikeSearch})) OR ` +
          `lower(immutable_unaccent("VideoImportModel"."targetUrl")) LIKE lower(immutable_unaccent(${escapedLikeSearch})) OR ` +
          `lower(immutable_unaccent("VideoImportModel"."torrentName")) LIKE lower(immutable_unaccent(${escapedLikeSearch})) OR ` +
          `lower(immutable_unaccent("VideoImportModel"."magnetUri")) LIKE lower(immutable_unaccent(${escapedLikeSearch}))` +
          `)`
      )
    }

    if (where.length !== 0) {
      this.subQueryWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  private buildVideoJoin () {
    if (this.builtVideoJoin) return

    this.subQueryJoin += ` LEFT JOIN "video" "Video" ON "Video"."id" = "VideoImportModel"."videoId" ` +
      getChannelJoin({
        base: 'Video->',
        on: '"Video"."channelId"',
        includeAccount: true,
        includeActors: true,
        includeAvatars: false,
        required: false
      })

    this.builtVideoJoin = true
  }

  private buildChannelCollaboratorsJoin () {
    if (this.builtChannelCollaboratorsJoin) return

    this.buildVideoJoin()

    this.subQueryJoin += ' LEFT JOIN "videoChannelCollaborator" "Video->VideoChannel->VideoChannelCollaborators" ' +
      'ON "Video->VideoChannel->VideoChannelCollaborators"."channelId" = "Video->VideoChannel"."id" ' +
      'AND "Video->VideoChannel->VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
      // Ensure we join with max 1 collaborator to not duplicate rows
      'AND "Video->VideoChannel->VideoChannelCollaborators"."accountId" = :collaborationAccountId '

    this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED
    this.replacements.collaborationAccountId = this.options.collaborationAccountId

    this.builtChannelCollaboratorsJoin = true
  }

  // ---------------------------------------------------------------------------

  private buildThumbnailJoin () {
    if (this.builtThumbnailJoin) return

    this.join += ' LEFT JOIN "thumbnail" "Video->Thumbnails" ON "Video->Thumbnails"."videoId" = "Video.id" '

    this.builtThumbnailJoin = true
  }

  private buildTagJoin () {
    if (this.builtTagJoin) return

    this.join += ' LEFT JOIN "videoTag" ON "videoTag"."videoId" = "Video.id" ' +
      'LEFT JOIN "tag" "Video->Tags" ON "Video->Tags"."id" = "videoTag"."tagId" '

    this.builtTagJoin = true
  }

  private buildAccountAvatarsJoin () {
    if (this.builtAccountAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'Video->VideoChannel->Account->Actor->', on: '"Video.VideoChannel.Account.Actor.id"' })

    this.builtAccountAvatarJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += getAvatarsJoin({ base: 'Video->VideoChannel->Actor->', on: '"Video.VideoChannel.Actor.id"' })

    this.builtChannelAvatarJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    this.buildChannelAvatarsJoin()
    this.buildAccountAvatarsJoin()
    this.buildTagJoin()
    this.buildThumbnailJoin()
  }

  protected buildQueryAttributes () {
    this.attributes = [
      ...this.attributes,

      this.tableAttributes.getVideoTagAttributes(),
      this.tableAttributes.getAccountAvatarAttributes(),
      this.tableAttributes.getChannelAvatarAttributes(),
      this.tableAttributes.getThumbnailAttributes()
    ]
  }

  protected buildSubQueryJoin () {
    this.buildVideoJoin()
  }

  protected buildSubQueryAttributes () {
    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getVideoImportAttributes(),
      this.tableAttributes.getVideoAttributes(),

      this.tableAttributes.getChannelAttributes(),
      this.tableAttributes.getChannelActorAttributes(),
      this.tableAttributes.getChannelServerAttributes(),

      this.tableAttributes.getAccountAttributes(),
      this.tableAttributes.getAccountActorAttributes(),
      this.tableAttributes.getAccountServerAttributes()
    ]
  }
}
