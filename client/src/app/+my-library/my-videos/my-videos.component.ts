import { Component, inject, OnDestroy, OnInit, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { AuthService, AuthUser, ConfirmService, Notifier, RestPagination, ServerService } from '@app/core'
import { HeaderService } from '@app/header/header.service'
import { formatICU } from '@app/helpers'
import { ChannelToggleComponent } from '@app/shared/shared-channels/channel-toggle.component'
import { AdvancedFilterDef } from '@app/shared/shared-forms/advanced-input-filter.component'
import { PeerTubeBadgeService } from '@app/shared/shared-main/common/peertube-badge.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { TableColumnInfo, TableComponent, TableQueryParams } from '@app/shared/shared-tables/table.component'
import { BulkUpdateVideosInPlaylistModalComponent } from '@app/shared/shared-video-playlist/bulk-update-videos-in-playlist-modal.component'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { arrayify } from '@peertube/peertube-core-utils'
import { VideoChannel, VideoExistInPlaylist, VideoPrivacy, VideoPrivacyType, VideosExistInPlaylists } from '@peertube/peertube-models'
import uniqBy from 'lodash-es/uniqBy'
import { SortMeta } from 'primeng/api'
import { tap } from 'rxjs/operators'
import { DropdownAction } from '../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { PTDatePipe } from '../../shared/shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { VideoCellComponent } from '../../shared/shared-tables/video-cell.component'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../shared/shared-video-miniature/video-actions-dropdown.component'
import { BulkUpdateVideosModalComponent } from '../../shared/shared-video/bulk-update-videos-modal.component'
import { PrivacyBadgeComponent } from '../../shared/shared-video/privacy-badge.component'
import { VideoNSFWBadgeComponent } from '../../shared/shared-video/video-nsfw-badge.component'
import { VideoStateBadgeComponent } from '../../shared/shared-video/video-state-badge.component'

type ColumnName =
  | 'duration'
  | 'name'
  | 'tags'
  | 'language'
  | 'privacy'
  | 'sensitive'
  | 'playlists'
  | 'insights'
  | 'published'
  | 'category'
  | 'licence'
  | 'state'
  | 'comments'

type QueryParams = TableQueryParams & {
  channelNameOneOf?: string[]
}

type DataLoaderParameter = Parameters<MyVideosComponent['_dataLoader']>[0]

@Component({
  selector: 'my-videos',
  templateUrl: './my-videos.component.html',
  styleUrls: [ './my-videos.component.scss' ],
  imports: [
    FormsModule,
    ButtonComponent,
    NgbTooltipModule,
    VideoActionsDropdownComponent,
    VideoCellComponent,
    RouterLink,
    NumberFormatterPipe,
    VideoStateBadgeComponent,
    ChannelToggleComponent,
    PTDatePipe,
    VideoNSFWBadgeComponent,
    TableComponent,
    PrivacyBadgeComponent,
    BulkUpdateVideosInPlaylistModalComponent,
    BulkUpdateVideosModalComponent
  ]
})
export class MyVideosComponent implements OnInit, OnDestroy {
  private confirmService = inject(ConfirmService)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private videoService = inject(VideoService)
  private playlistService = inject(VideoPlaylistService)
  private server = inject(ServerService)
  private headerService = inject(HeaderService)
  private badgeService = inject(PeerTubeBadgeService)
  private route = inject(ActivatedRoute)

  readonly table = viewChild<TableComponent<Video, DataLoaderParameter, ColumnName, QueryParams>>('table')
  readonly bulkUpdateVideosInPlaylistModal = viewChild<BulkUpdateVideosInPlaylistModalComponent>('bulkUpdateVideosInPlaylistModal')
  readonly bulkUpdateVideosModal = viewChild<BulkUpdateVideosModalComponent>('bulkUpdateVideosModal')

  videosContainedInPlaylists: VideosExistInPlaylists = {}

  bulkActions: DropdownAction<Video[]>[][] = []

  videoActionsOptions: VideoActionsDisplayType = {
    playlist: true,
    download: true,
    update: false,
    blacklist: false,
    delete: true,
    report: false,
    duplicate: false,
    muteByUser: false,
    muteByServer: false,
    liveInfo: true,
    removeFiles: false,
    transcoding: false
  }

  user: AuthUser
  channels: (VideoChannel & { selected: boolean })[] = []

  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = []

  columns: TableColumnInfo<ColumnName>[] = []

  customUpdateUrl: typeof this._customUpdateUrl
  customParseQueryParams: typeof this._customParseQueryParams
  dataLoader: typeof this._dataLoader

  constructor () {
    this.customUpdateUrl = this._customUpdateUrl.bind(this)
    this.customParseQueryParams = this._customParseQueryParams.bind(this)
    this.dataLoader = this._dataLoader.bind(this)
  }

  get serverConfig () {
    return this.server.getHTMLConfig()
  }

  ngOnInit () {
    this.headerService.setSearchHidden(true)

    this.user = this.auth.getUser()

    this.columns = [
      { id: 'duration', label: $localize`Duration`, selected: true, sortable: true },
      { id: 'name', label: $localize`Name`, selected: true, sortable: true },
      { id: 'tags', label: $localize`Tags`, selected: true, sortable: false },
      { id: 'privacy', label: $localize`Privacy`, selected: true, sortable: false },
      { id: 'sensitive', label: $localize`Sensitive`, selected: true, sortable: false },
      { id: 'insights', label: $localize`Insights`, selected: true, sortable: true, sortKey: 'views' },
      { id: 'comments', label: $localize`Comments`, selected: true, sortable: true },
      { id: 'published', label: $localize`Published`, selected: true, sortable: true, sortKey: 'publishedAt' },
      { id: 'state', label: $localize`State`, selected: true, sortable: false },
      { id: 'category', label: $localize`Category`, selected: false, sortable: false },
      { id: 'language', label: $localize`Language`, selected: false, sortable: false },
      { id: 'licence', label: $localize`Licence`, selected: false, sortable: false },
      { id: 'playlists', label: $localize`Playlists`, selected: true, sortable: false }
    ]

    this.inputFilters = [
      {
        type: 'options',
        key: 'isLive',
        title: $localize`Video type`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: true, label: $localize`Lives` },
          { value: false, label: $localize`VOD` }
        ]
      },

      {
        type: 'options',
        key: 'privacyOneOf',
        title: $localize`Privacy`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: VideoPrivacy.PUBLIC, label: $localize`Public videos` },
          { value: VideoPrivacy.INTERNAL, label: $localize`Internal videos` },
          { value: VideoPrivacy.UNLISTED, label: $localize`Unlisted videos` },
          { value: VideoPrivacy.PASSWORD_PROTECTED, label: $localize`Password protected videos` },
          { value: VideoPrivacy.PRIVATE, label: $localize`Private videos` }
        ]
      },

      {
        type: 'tags',
        key: 'tagsOneOf',
        title: $localize`One of these tags`
      }
    ]

    this._customParseQueryParams(this.route.snapshot.queryParams)

    this.buildActions()
  }

  ngOnDestroy () {
    this.headerService.setSearchHidden(false)
  }

  private _customParseQueryParams (queryParams: QueryParams) {
    const enabledChannels = queryParams.channelNameOneOf
      ? new Set(arrayify(queryParams.channelNameOneOf))
      : new Set<string>()

    this.user = this.auth.getUser()
    this.channels = [ ...this.user.videoChannels, ...this.user.videoChannelCollaborations ].map(c => ({
      ...c,

      selected: enabledChannels.has(c.name)
    }))
  }

  // ---------------------------------------------------------------------------

  getNoResults (hasSearchOrFilters?: boolean) {
    if (hasSearchOrFilters) {
      return $localize`No videos found matching your filters.`
    }

    if (this.channels.some(c => c.selected)) {
      return $localize`No videos found in selected channels.`
    }

    return $localize`You don't have any videos published yet.`
  }

  // ---------------------------------------------------------------------------

  private _customUpdateUrl (): Partial<Record<keyof QueryParams, any>> {
    const channelNameOneOf = this.channels.filter(c => c.selected).map(c => c.name)

    return {
      channelNameOneOf
    }
  }

  // ---------------------------------------------------------------------------

  private _dataLoader (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
    isLive?: boolean
    privacyOneOf?: VideoPrivacyType
    tagsOneOf?: string[]
  }) {
    const { pagination, sort, search, isLive, privacyOneOf, tagsOneOf } = options

    const channelNameOneOf = this.channels.filter(c => c.selected).map(c => c.name)

    return this.videoService.listMyVideos({
      restPagination: pagination,
      sort,
      search,
      includeCollaborations: true,

      channelNameOneOf: channelNameOneOf.length !== 0
        ? channelNameOneOf
        : undefined,

      isLive,

      privacyOneOf: privacyOneOf !== undefined
        ? [ privacyOneOf ]
        : undefined,

      tagsOneOf
    }).pipe(tap(({ data }) => this.fetchVideosContainedInPlaylists(data)))
  }

  fetchVideosContainedInPlaylists (videos: Pick<Video, 'id'>[]) {
    this.playlistService.doVideosExistInPlaylist(videos.map(v => v.id))
      .subscribe(result => {
        this.videosContainedInPlaylists = Object.keys(result).reduce((acc, videoId) => ({
          ...acc,
          [videoId]: uniqBy(result[+videoId], (p: VideoExistInPlaylist) => p.playlistId)
        }), this.videosContainedInPlaylists)
      })
  }

  getPlaylistBadge (playlistName: string) {
    return this.badgeService.getRandomBadge('playlist', playlistName)
  }

  async removeVideos (videos: Video[]) {
    const message = formatICU(
      $localize`Are you sure you want to delete {count, plural, =1 {this video} other {these {count} videos}}?`,
      { count: videos.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.videoService.removeVideo(videos.map(v => v.id))
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`Deleted {count, plural, =1 {1 video} other {{count} videos}}.`,
              { count: videos.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private buildActions () {
    this.bulkActions = [
      [
        {
          label: $localize`Add to playlist...`,
          handler: videos => {
            this.bulkUpdateVideosInPlaylistModal().show({ videos, videosContainedInPlaylists: this.videosContainedInPlaylists })
          },
          iconName: 'playlist-add'
        },
        {
          label: $localize`Update...`,
          handler: videos => this.bulkUpdateVideosModal().show({ videos }),
          iconName: 'edit'
        }
      ],

      [
        {
          label: $localize`Delete`,
          handler: videos => this.removeVideos(videos),
          iconName: 'delete'
        }
      ]
    ]
  }

  getPrivacyFilterTitle (privacy: string) {
    return $localize`Filter by privacy: ${privacy}`
  }
}
