import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Params } from '@angular/router'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { buildPlaylistWatchPath, buildVideoWatchPath } from '@peertube/peertube-core-utils'
import { AuditLog, AuditLogActionType, AuditLogChange, AuditLogEntityTypeType, ResultList } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { catchError, map } from 'rxjs'
import { environment } from '../../../../environments/environment'

export type AuditLogEntityLink = {
  routerLink: string | any[]
  queryParams?: Params
}

export type AuditLogFormatted = AuditLog & {
  entityJSON: string
  entityLabel: string
  hasChanges: boolean
  oldChangesJSON: string
  newChangesJSON: string

  entityLink: AuditLogEntityLink | null
}

const entityTypesWithoutLinkOnDelete = new Set<AuditLogEntityTypeType>([
  'video',
  'comment',
  'channel',
  'playlist',
  'user',
  'plugin'
])

@Injectable()
export class AuditLogService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)

  private static BASE_AUDIT_LOG_URL = environment.apiUrl + '/api/v1/server/audit-logs'

  listAuditLogs (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
    entityType?: AuditLogEntityTypeType
    entityId?: number
    action?: AuditLogActionType
  }) {
    const { pagination, sort, search, entityType, entityId, action } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = this.restService.addObjectParams(params, { format: 'list', search, entityType, entityId, action })

    return this.authHttp.get<ResultList<AuditLog>>(AuditLogService.BASE_AUDIT_LOG_URL, { params })
      .pipe(
        map(res => ({
          total: res.total,
          data: res.data.map(log => this.formatAuditLog(log))
        })),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  private formatAuditLog (log: AuditLog): AuditLogFormatted {
    const changes = Object.entries(log.changes || {})

    return {
      ...log,

      entityJSON: JSON.stringify(log.entity, null, 2),
      entityLabel: this.buildEntityLabel(log.entity),
      entityLink: this.buildEntityLink(log),

      hasChanges: changes.length !== 0,
      oldChangesJSON: this.buildChangesJSON(changes, 'old'),
      newChangesJSON: this.buildChangesJSON(changes, 'new')
    }
  }

  private buildChangesJSON (changes: [string, AuditLogChange][], side: keyof AuditLogChange) {
    // Keep undefined values (added or removed attributes) that JSON.stringify would drop
    return JSON.stringify(Object.fromEntries(changes.map(([ key, change ]) => [ key, change[side] ?? null ])), null, 2)
  }

  // ---------------------------------------------------------------------------

  private buildEntityLabel (entity: AuditLog['entity']): string {
    const label = entity.displayName ??
      entity.name ??
      entity.username ??
      entity.npmName ??
      entity.listName ??
      entity.targetAccount?.handle ??
      entity.targetServer?.host ??
      entity.host ??
      entity.video?.name ??
      entity.videoChannel?.name ??
      entity.channel?.name ??
      entity.user?.username

    return typeof label === 'string'
      ? label
      : ''
  }

  private buildEntityLink (log: AuditLog): AuditLogEntityLink | null {
    const { entity, entityType } = log

    if (log.action === 'delete' && entityTypesWithoutLinkOnDelete.has(entityType)) return null

    switch (entityType) {
      case 'video':
        return this.buildVideoLink(entity)

      case 'video-import':
      case 'video-live':
      case 'video-source':
      case 'video-file':
      case 'video-caption':
      case 'video-chapters':
      case 'video-password':
      case 'video-embed-privacy':
      case 'video-transcoding':
      case 'video-transcription':
      case 'video-studio-edition':
      case 'video-player-settings':
      case 'video-block':
      case 'video-redundancy':
        return this.buildVideoLink(entity.video)

      case 'ownership-change':
        return this.buildVideoLink(entity.video) ?? this.buildChannelLink(entity.videoChannel)

      case 'comment':
        // Older comment entries don't have the video
        if (!entity.video?.uuid) return null

        return { routerLink: [ buildVideoWatchPath({ shortUUID: entity.video.uuid }), { threadId: entity.threadId } ] }

      case 'channel':
        return this.buildChannelLink(entity)

      case 'channel-sync':
      case 'channel-videos-import':
      case 'channel-collaborator':
      case 'channel-player-settings':
      case 'channel-playlists-order':
        return this.buildChannelLink(entity.channel)

      case 'playlist':
        return this.buildPlaylistLink(entity)

      case 'playlist-element':
      case 'playlist-elements-order':
        return this.buildPlaylistLink(entity.playlist)

      case 'user':
        return this.buildUserLink(entity)

      case 'password-reset':
      case 'token-session':
      case 'scoped-token':
      case 'user-export':
      case 'user-import':
        return this.buildUserLink(entity.user)

      case 'registration':
        if (!entity.username) return null

        return { routerLink: '/admin/moderation/registrations/list', queryParams: { search: entity.username } }

      case 'abuse':
        return this.buildAbuseLink(entity.id)

      case 'abuse-message':
        return this.buildAbuseLink(entity.abuseId)

      case 'account-block':
        if (!entity.targetAccount?.handle) return null

        return { routerLink: [ '/a', entity.targetAccount.handle ] }

      case 'config':
        return { routerLink: '/admin/settings/config' }

      case 'instance-image':
        return { routerLink: '/admin/settings/config/logo' }

      case 'instance-homepage':
        return { routerLink: '/admin/settings/config/homepage' }

      case 'plugin':
        if (!entity.npmName) return null

        return { routerLink: [ '/admin/settings/plugins/show', entity.npmName ] }

      case 'server-redundancy':
        return { routerLink: '/admin/settings/follows/following-list' }

      case 'job-queue':
      case 'job':
        return { routerLink: '/admin/settings/system/jobs' }

      case 'runner':
        return { routerLink: '/admin/settings/system/runners/runners-list' }

      case 'runner-registration-token':
        return { routerLink: '/admin/settings/system/runners/registration-tokens-list' }

      default:
        return null
    }
  }

  private buildVideoLink (video: { uuid?: string } | null | undefined): AuditLogEntityLink | null {
    if (!video?.uuid) return null

    return { routerLink: buildVideoWatchPath({ shortUUID: video.uuid }) }
  }

  private buildChannelLink (channel: { name?: string } | null | undefined): AuditLogEntityLink | null {
    if (!channel?.name) return null

    // Audit logs only concern local channels
    return { routerLink: [ '/c', channel.name ] }
  }

  private buildPlaylistLink (playlist: { uuid?: string } | null | undefined): AuditLogEntityLink | null {
    if (!playlist?.uuid) return null

    return { routerLink: buildPlaylistWatchPath({ shortUUID: playlist.uuid }) }
  }

  private buildUserLink (user: { id?: number } | null | undefined): AuditLogEntityLink | null {
    if (!user?.id) return null

    return { routerLink: [ '/admin/overview/users/update', user.id ] }
  }

  private buildAbuseLink (abuseId: number | undefined): AuditLogEntityLink | null {
    if (!abuseId) return null

    return { routerLink: '/admin/moderation/abuses/list', queryParams: { id: abuseId } }
  }
}
