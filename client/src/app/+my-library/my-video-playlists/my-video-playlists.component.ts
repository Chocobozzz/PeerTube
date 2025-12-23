import { DragDropModule } from '@angular/cdk/drag-drop'
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AuthService, AuthUser, ConfirmService, Notifier, RestPagination, ScreenService } from '@app/core'
import { HeaderService } from '@app/header/header.service'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import { CollaboratorStateComponent } from '@app/shared/shared-main/channel/collaborator-state.component'
import { TableColumnInfo, TableComponent, TableQueryParams } from '@app/shared/shared-tables/table.component'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { VideoChannel, VideoPlaylistType } from '@peertube/peertube-models'
import debug from 'debug'
import { SortMeta } from 'primeng/api'
import { TableRowReorderEvent } from 'primeng/table'
import { Subject, tap } from 'rxjs'
import { ChannelToggleComponent } from '../../shared/shared-channels/channel-toggle.component'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { PTDatePipe } from '../../shared/shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { VideoPlaylistMiniatureComponent } from '../../shared/shared-video-playlist/video-playlist-miniature.component'
import { PrivacyBadgeComponent } from '../../shared/shared-video/privacy-badge.component'

type ColumnName = 'videoChannelPosition' | 'videos' | 'name' | 'privacy' | 'updatedAt'

type QueryParams = TableQueryParams & {
  channelName?: string
}

const debugLogger = debug('peertube:my-video-playlists')

@Component({
  templateUrl: './my-video-playlists.component.html',
  styleUrls: [ './my-video-playlists.component.scss' ],
  imports: [
    FormsModule,
    GlobalIconComponent,
    AdvancedInputFilterComponent,
    RouterLink,
    VideoPlaylistMiniatureComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    ChannelToggleComponent,
    TableComponent,
    NumberFormatterPipe,
    PrivacyBadgeComponent,
    PTDatePipe,
    DragDropModule,
    CollaboratorStateComponent
  ]
})
export class MyVideoPlaylistsComponent implements OnInit, OnDestroy {
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private videoPlaylistService = inject(VideoPlaylistService)
  private auth = inject(AuthService)
  private headerService = inject(HeaderService)
  private cdr = inject(ChangeDetectorRef)
  private screenService = inject(ScreenService)

  readonly table = viewChild<TableComponent<VideoPlaylist, ColumnName, QueryParams>>('table')

  user: AuthUser
  channels: (VideoChannel & { selected: boolean })[] = []

  onDataSubject = new Subject<any[]>()

  columns: TableColumnInfo<ColumnName>[] = []

  customUpdateUrl: typeof this._customUpdateUrl
  customParseQueryParams: typeof this._customParseQueryParams
  dataLoader: typeof this._dataLoader
  hasExpandedRow: typeof this._hasExpandedRow

  private playlistsAfterDrop: VideoPlaylist[] = []
  private playlistsBeforeDrop: VideoPlaylist[] = []
  private paginationStart = 0

  constructor () {
    this.customUpdateUrl = this._customUpdateUrl.bind(this)
    this.customParseQueryParams = this._customParseQueryParams.bind(this)
    this.dataLoader = this._dataLoader.bind(this)
    this.hasExpandedRow = this._hasExpandedRow.bind(this)
  }

  ngOnInit () {
    this.headerService.setSearchHidden(true)

    this.user = this.auth.getUser()

    this.columns = [
      {
        id: 'videoChannelPosition',
        label: $localize`Position`,
        selected: true,
        sortable: true,
        isDisplayed: () => this.hasReorderableRows()
      },
      { id: 'videos', label: $localize`Videos`, selected: true, sortable: false },
      { id: 'name', label: $localize`Name`, selected: true, sortable: true },
      { id: 'privacy', label: $localize`Privacy`, selected: true, sortable: false },
      { id: 'updatedAt', label: $localize`Updated`, selected: true, sortable: true }
    ]
  }

  ngOnDestroy () {
    this.headerService.setSearchHidden(false)
  }

  private _customParseQueryParams (queryParams: QueryParams) {
    this.user = this.auth.getUser()
    this.channels = [ ...this.user.videoChannels, ...this.user.videoChannelCollaborations ].map(c => ({
      ...c,

      selected: queryParams.channelName === c.name
    }))

    this.cdr.detectChanges()
  }

  // ---------------------------------------------------------------------------

  getNoResults (search?: string) {
    if (search) {
      return $localize`No playlists found matching your search.`
    }

    if (this.getFilteredChannel()) {
      return $localize`No playlists found in selected channels.`
    }

    return $localize`You don't have any playlists published yet.`
  }

  // ---------------------------------------------------------------------------

  private _customUpdateUrl (): Partial<Record<keyof QueryParams, any>> {
    return { channelName: this.getFilteredChannel()?.name }
  }

  async deleteVideoPlaylist (videoPlaylist: VideoPlaylist) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to delete ${videoPlaylist.displayName}?`,
      $localize`Delete`
    )
    if (res === false) return

    this.videoPlaylistService.removeVideoPlaylist(videoPlaylist)
      .subscribe({
        next: () => {
          this.table().loadData()

          this.notifier.success($localize`Playlist ${videoPlaylist.displayName} deleted.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  isRegularPlaylist (playlist: VideoPlaylist) {
    return playlist.type.id === VideoPlaylistType.REGULAR
  }

  onRowReorder (event: TableRowReorderEvent) {
    const { dragIndex, dropIndex } = event

    // PrimeNG index takes into account the pagination
    const previousIndex = dragIndex - this.paginationStart
    const newIndex = dropIndex - this.paginationStart

    const dragPlaylist = this.playlistsBeforeDrop[previousIndex]
    const dropAfterPlaylist = this.playlistsBeforeDrop[newIndex]

    debugLogger('onRowReorder', { previousIndex, newIndex, dragPlaylist, dropAfterPlaylist })

    if (previousIndex === newIndex) return

    const oldPosition = dragPlaylist.videoChannelPosition
    let insertAfter = dropAfterPlaylist.videoChannelPosition

    if (oldPosition > insertAfter) insertAfter--

    debugLogger('Will reorder', { oldPosition, insertAfter })

    for (let i = 1; i <= this.playlistsAfterDrop.length; i++) {
      this.playlistsAfterDrop[i - 1].videoChannelPosition = i + this.paginationStart
    }

    this.videoPlaylistService.reorderPlaylistsOfChannel(this.getFilteredChannel().name, oldPosition, insertAfter)
      .subscribe({
        next: () => {
          this.table().loadData({ skipLoader: !this.screenService.isInTouchScreen() })

          this.notifier.success($localize`Playlists reordered`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  onChannelFilter (channel: VideoChannel & { selected: boolean }) {
    for (const c of this.channels) {
      if (c.id !== channel.id) {
        c.selected = false
      }
    }

    this.table().onFilter()
  }

  hasReorderableRows () {
    return !!this.getFilteredChannel()
  }

  private _dataLoader (options: {
    pagination: RestPagination
    sort: SortMeta
    search: string
  }) {
    const { pagination, sort, search } = options

    this.paginationStart = pagination.start

    const channel = this.getFilteredChannel()
    const obs = channel
      ? this.videoPlaylistService.listChannelPlaylists({
        videoChannel: { nameWithHost: Actor.CREATE_BY_STRING(channel.name, channel.host) },
        includeCollaborations: true,
        restPagination: pagination,
        sort,
        search
      })
      : this.videoPlaylistService.listAccountPlaylists({
        account: this.user.account,
        includeCollaborations: true,
        restPagination: pagination,
        sort,
        search
      })

    // Keep a duplicate array of playlists to calculate the position before the drag and drop
    return obs.pipe(
      tap(({ data }) => {
        this.playlistsAfterDrop = data
        this.playlistsBeforeDrop = [ ...data ]
      })
    )
  }

  private _hasExpandedRow (playlist: VideoPlaylist) {
    return !!playlist.description
  }

  getFilteredChannel () {
    return this.channels.find(c => c.selected)
  }
}
