import { Component, inject, OnDestroy, OnInit, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AuthService, AuthUser, ConfirmService, Notifier, RestPagination, ServerService } from '@app/core'
import { HeaderService } from '@app/header/header.service'
import { formatICU } from '@app/helpers'
import { ChannelToggleComponent } from '@app/shared/shared-channels/channel-toggle.component'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { TableColumnInfo, TableComponent, TableQueryParams } from '@app/shared/shared-tables/table.component'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { arrayify, pick } from '@peertube/peertube-core-utils'
import { VideoChannel, VideoExistInPlaylist, VideoPrivacy, VideoPrivacyType, VideosExistInPlaylists } from '@peertube/peertube-models'
import uniqBy from 'lodash-es/uniqBy'
import { SortMeta } from 'primeng/api'
import { tap } from 'rxjs/operators'
import { SelectOptionsItem } from 'src/types'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { SelectCheckboxComponent } from '../../shared/shared-forms/select/select-checkbox.component'
import { DropdownAction } from '../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { PTDatePipe } from '../../shared/shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { VideoCellComponent } from '../../shared/shared-tables/video-cell.component'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../shared/shared-video-miniature/video-actions-dropdown.component'
import { PrivacyBadgeComponent } from '../../shared/shared-video/privacy-badge.component'
import { VideoNSFWBadgeComponent } from '../../shared/shared-video/video-nsfw-badge.component'
import { VideoStateBadgeComponent } from '../../shared/shared-video/video-state-badge.component'
import { VideoChangeOwnershipComponent } from './modals/video-change-ownership.component'

type ColumnName = 'duration' | 'name' | 'privacy' | 'sensitive' | 'playlists' | 'insights' | 'published' | 'state' | 'comments'
type CommonFilter = 'live' | 'vod' | 'private' | 'internal' | 'unlisted' | 'password-protected' | 'public'

type VideoType = 'live' | 'vod'
type QueryParams = TableQueryParams & {
  channelNameOneOf?: string[]
  privacyOneOf?: string[]
  videoType?: VideoType
}

@Component({
  selector: 'my-videos',
  templateUrl: './my-videos.component.html',
  styleUrls: [ './my-videos.component.scss' ],
  imports: [
    FormsModule,
    AdvancedInputFilterComponent,
    ButtonComponent,
    NgbTooltipModule,
    VideoActionsDropdownComponent,
    VideoCellComponent,
    RouterLink,
    NumberFormatterPipe,
    VideoStateBadgeComponent,
    ChannelToggleComponent,
    SelectCheckboxComponent,
    PTDatePipe,
    VideoNSFWBadgeComponent,
    TableComponent,
    PrivacyBadgeComponent
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

  readonly videoChangeOwnershipModal = viewChild<VideoChangeOwnershipComponent>('videoChangeOwnershipModal')
  readonly table = viewChild<TableComponent<Video, ColumnName, QueryParams>>('table')

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
    mute: false,
    liveInfo: true,
    removeFiles: false,
    transcoding: false
  }

  user: AuthUser
  channels: (VideoChannel & { selected: boolean })[] = []

  filterItems: SelectOptionsItem<CommonFilter>[] = []
  selectedFilterItems: CommonFilter[] = []

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
      { id: 'privacy', label: $localize`Privacy`, selected: true, sortable: false },
      { id: 'sensitive', label: $localize`Sensitive`, selected: true, sortable: false },
      { id: 'playlists', label: $localize`Playlists`, selected: true, sortable: false },
      { id: 'insights', label: $localize`Insights`, selected: true, sortable: true, sortKey: 'views' },
      { id: 'comments', label: $localize`Comments`, selected: true, sortable: true },
      { id: 'published', label: $localize`Published`, selected: true, sortable: true, sortKey: 'publishedAt' },
      { id: 'state', label: $localize`State`, selected: true, sortable: false }
    ]

    this.filterItems = [
      {
        id: 'live',
        label: $localize`Lives`
      },
      {
        id: 'vod',
        label: $localize`VOD`
      },
      {
        id: 'public',
        label: $localize`Public videos`
      },
      {
        id: 'internal',
        label: $localize`Internal videos`
      },
      {
        id: 'unlisted',
        label: $localize`Unlisted videos`
      },
      {
        id: 'password-protected',
        label: $localize`Password protected videos`
      },
      {
        id: 'private',
        label: $localize`Private videos`
      }
    ]

    this.buildActions()
  }

  ngOnDestroy () {
    this.headerService.setSearchHidden(false)
  }

  private _customParseQueryParams (queryParams: QueryParams) {
    {
      const enabledChannels = queryParams.channelNameOneOf
        ? new Set(arrayify(queryParams.channelNameOneOf))
        : new Set<string>()

      this.user = this.auth.getUser()
      this.channels = [ ...this.user.videoChannels, ...this.user.videoChannelCollaborations ].map(c => ({
        ...c,

        selected: enabledChannels.has(c.name)
      }))
    }

    {
      this.selectedFilterItems = []
      const videoType = arrayify(queryParams.videoType)

      if (videoType.includes('live')) this.selectedFilterItems.push('live')
      if (videoType.includes('vod')) this.selectedFilterItems.push('vod')

      const enabledPrivacies = queryParams.privacyOneOf
        ? new Set(arrayify(queryParams.privacyOneOf).map(t => parseInt(t) as VideoPrivacyType))
        : new Set<VideoPrivacyType>()

      if (enabledPrivacies.has(VideoPrivacy.PUBLIC)) this.selectedFilterItems.push('public')
      if (enabledPrivacies.has(VideoPrivacy.INTERNAL)) this.selectedFilterItems.push('internal')
      if (enabledPrivacies.has(VideoPrivacy.UNLISTED)) this.selectedFilterItems.push('unlisted')
      if (enabledPrivacies.has(VideoPrivacy.PASSWORD_PROTECTED)) this.selectedFilterItems.push('password-protected')
      if (enabledPrivacies.has(VideoPrivacy.PRIVATE)) this.selectedFilterItems.push('private')
    }
  }

  // ---------------------------------------------------------------------------

  getNoResults (search?: string) {
    if (search || this.selectedFilterItems.length !== 0) {
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
      ...pick(this.buildCommonVideoFilters(), [ 'privacyOneOf', 'videoType' ]),

      channelNameOneOf
    }
  }

  private buildCommonVideoFilters () {
    const selectedFilterSet = new Set(this.selectedFilterItems)

    let isLive: boolean
    const videoType: VideoType[] = []
    if (selectedFilterSet.has('live')) {
      videoType.push('live')

      if (!selectedFilterSet.has('vod')) isLive = true
    }

    if (selectedFilterSet.has('vod')) {
      videoType.push('vod')

      if (!selectedFilterSet.has('live')) isLive = false
    }

    const privacyOneOf: VideoPrivacyType[] = []
    if (selectedFilterSet.has('public')) privacyOneOf.push(VideoPrivacy.PUBLIC)
    if (selectedFilterSet.has('internal')) privacyOneOf.push(VideoPrivacy.INTERNAL)
    if (selectedFilterSet.has('unlisted')) privacyOneOf.push(VideoPrivacy.UNLISTED)
    if (selectedFilterSet.has('password-protected')) privacyOneOf.push(VideoPrivacy.PASSWORD_PROTECTED)
    if (selectedFilterSet.has('private')) privacyOneOf.push(VideoPrivacy.PRIVATE)

    return {
      isLive,
      videoType,
      privacyOneOf
    }
  }

  // ---------------------------------------------------------------------------

  private _dataLoader (options: {
    pagination: RestPagination
    sort: SortMeta
    search: string
  }) {
    const { pagination, sort, search } = options

    const channelNameOneOf = this.channels.filter(c => c.selected).map(c => c.name)

    return this.videoService.listMyVideos({
      restPagination: pagination,
      sort,
      search,
      includeCollaborations: true,

      channelNameOneOf: channelNameOneOf.length !== 0
        ? channelNameOneOf
        : undefined,

      ...pick(this.buildCommonVideoFilters(), [ 'isLive', 'privacyOneOf' ])
    }).pipe(tap(({ data }) => this.fetchVideosContainedInPlaylists(data)))
  }

  fetchVideosContainedInPlaylists (videos: Video[]) {
    this.playlistService.doVideosExistInPlaylist(videos.map(v => v.id))
      .subscribe(result => {
        this.videosContainedInPlaylists = Object.keys(result).reduce((acc, videoId) => ({
          ...acc,
          [videoId]: uniqBy(result[+videoId], (p: VideoExistInPlaylist) => p.playlistId)
        }), this.videosContainedInPlaylists)
      })
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
          label: $localize`Delete`,
          handler: videos => this.removeVideos(videos),
          iconName: 'delete'
        }
      ]
    ]
  }
}
