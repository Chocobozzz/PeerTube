import { ChangeDetectionStrategy, Component, inject, OnInit, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, ConfirmService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoFileTokenService } from '@app/shared/shared-main/video/video-file-token.service'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { AccountBlockBadgeInput } from '@app/shared/shared-moderation/account-block-badges.component'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockComponent } from '@app/shared/shared-moderation/video-block.component'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { BulkUpdateVideosModalComponent } from '@app/shared/shared-video/bulk-update-videos-modal.component'
import { PrivacyBadgeComponent } from '@app/shared/shared-video/privacy-badge.component'
import { getAllVideoStates, getVideoStateBadgeClass, getVideoStateLabel } from '@app/shared/shared-video/video-state-utils'
import { getAllFiles } from '@peertube/peertube-core-utils'
import {
  FileStorage,
  NSFWFlag,
  UserRight,
  VideoFile,
  VideoState,
  VideoStateType,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { videoRequiresFileToken } from '@root-helpers/video'
import { TableRowExpandEvent } from 'primeng/table'
import { AdvancedFilterDef } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../../shared/shared-video-miniature/video-actions-dropdown.component'
import { VideoNSFWBadgeComponent } from '../../../shared/shared-video/video-nsfw-badge.component'
import { VideoAdminService } from './video-admin.service'

type DataLoaderParameter = Parameters<VideoListComponent['_dataLoader']>[0]

type ColumnName =
  | 'video'
  | 'info'
  | 'localVideoFilesSize'
  | 'publishedAt'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    GlobalIconComponent,
    VideoActionsDropdownComponent,
    VideoCellComponent,
    EmbedComponent,
    VideoBlockComponent,
    PTDatePipe,
    RouterLink,
    BytesPipe,
    PrivacyBadgeComponent,
    VideoNSFWBadgeComponent,
    BulkUpdateVideosModalComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class VideoListComponent implements OnInit {
  private confirmService = inject(ConfirmService)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private videoService = inject(VideoService)
  private videoAdminService = inject(VideoAdminService)
  private videoBlockService = inject(VideoBlockService)
  private videoCaptionService = inject(VideoCaptionService)
  private server = inject(ServerService)
  private videoFileTokenService = inject(VideoFileTokenService)
  private blocklistService = inject(BlocklistService)
  private videoImportService = inject(VideoImportService)

  readonly videoBlockModal = viewChild<VideoBlockComponent>('videoBlockModal')
  readonly bulkUpdateVideosModal = viewChild<BulkUpdateVideosModalComponent>('bulkUpdateVideosModal')
  readonly table = viewChild<TableComponent<Video, DataLoaderParameter, ColumnName>>('table')

  bulkActions: DropdownAction<Video[]>[][] = []

  defaultInputFilterValues: Partial<DataLoaderParameter> = {}
  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = []

  videoActionsOptions: VideoActionsDisplayType = {
    playlist: false,
    download: false,
    update: true,
    blacklist: true,
    delete: true,
    report: false,
    duplicate: true,
    muteByUser: false,
    muteByServer: true,
    liveInfo: false,
    removeFiles: true,
    transcoding: true,
    generateTranscription: true,
    retryFailedImport: true
  }

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'video', label: $localize`Video`, sortable: false },
    { id: 'info', label: $localize`Info`, sortable: false },
    { id: 'localVideoFilesSize', label: $localize`Files`, sortable: true },
    { id: 'publishedAt', label: $localize`Published`, sortable: true }
  ]

  // Key is account id
  accountBlocklist = new Map<number, AccountBlockBadgeInput>()

  private videoFileTokens: { [videoId: number]: string } = {}

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  get authUser () {
    return this.auth.getUser()
  }

  get serverConfig () {
    return this.server.getHTMLConfig()
  }

  ngOnInit () {
    this.defaultInputFilterValues = { isLocal: true }

    this.inputFilters = [
      {
        type: 'options',
        key: 'isLocal',
        title: $localize`Videos scope`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: false, label: $localize`Remote videos` },
          { value: true, label: $localize`Local videos` }
        ]
      },

      {
        type: 'options',
        key: 'nsfw',
        title: $localize`Sensitive videos`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: 'true', label: $localize`Sensitive` },
          { value: 'false', label: $localize`Non sensitive` }
        ]
      },

      {
        type: 'title',
        title: $localize`Moderation`
      },

      {
        type: 'checkbox',
        key: 'excludeMuted',
        label: $localize`Exclude muted accounts`
      },

      {
        type: 'checkbox',
        key: 'excludePublic',
        label: $localize`Exclude public videos`
      },

      {
        type: 'options',
        key: 'isLive',
        title: $localize`Video type`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: false, label: $localize`VOD` },
          { value: true, label: $localize`Live` }
        ]
      },

      {
        type: 'select',
        key: 'state',
        title: $localize`Video state`,
        clearable: true,
        filter: true,
        items: getAllVideoStates().map(state => ({
          id: state + '',
          label: getVideoStateLabel(state).toLocaleUpperCase(),
          classes: [ 'pt-badge', getVideoStateBadgeClass(state) ]
        }))
      },

      {
        type: 'options',
        key: 'hasWebVideoFiles',
        title: $localize`Web files (local only)`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: true, label: $localize`With Web Videos files` },
          { value: false, label: $localize`Without Web Videos files` }
        ]
      },

      {
        type: 'options',
        key: 'hasHLSFiles',
        title: $localize`HLS files (local only)`,
        options: [
          { value: 'all', label: $localize`All` },
          { value: true, label: $localize`With HLS files` },
          { value: false, label: $localize`Without HLS files` }
        ]
      },

      {
        type: 'tags',
        key: 'autoTagOneOf',
        title: $localize`Auto tags`
      }
    ]

    this.bulkActions = [
      [
        {
          label: $localize`Update...`,
          handler: videos => this.bulkUpdateVideosModal().show({ videos }),
          isDisplayed: () => this.authUser.hasRight(UserRight.UPDATE_ANY_VIDEO),
          iconName: 'edit'
        },
        {
          label: $localize`Delete`,
          handler: videos => this.removeVideos(videos),
          isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO),
          iconName: 'delete'
        },
        {
          label: $localize`Block...`,
          handler: videos => this.videoBlockModal().show(videos),
          isDisplayed: videos => this.authUser.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) && videos.every(v => !v.blacklisted),
          iconName: 'no'
        },
        {
          label: $localize`Unblock`,
          handler: videos => this.unblockVideos(videos),
          isDisplayed: videos => this.authUser.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) && videos.every(v => v.blacklisted),
          iconName: 'undo'
        }
      ],
      [
        {
          label: $localize`Run HLS transcoding`,
          handler: videos => this.runTranscoding(videos, 'hls'),
          isDisplayed: videos => videos.every(v => v.canRunTranscoding(this.authUser)),
          iconName: 'cog'
        },
        {
          label: $localize`Run Web Video transcoding`,
          handler: videos => this.runTranscoding(videos, 'web-video'),
          isDisplayed: videos => videos.every(v => v.canRunTranscoding(this.authUser)),
          iconName: 'cog'
        },
        {
          label: $localize`Delete HLS files`,
          handler: videos => this.removeVideoFiles(videos, 'hls'),
          isDisplayed: videos => videos.every(v => v.canRemoveAllHLSOrWebFiles(this.authUser)),
          iconName: 'delete'
        },
        {
          label: $localize`Delete Web Video files`,
          handler: videos => this.removeVideoFiles(videos, 'web-videos'),
          isDisplayed: videos => videos.every(v => v.canRemoveAllHLSOrWebFiles(this.authUser)),
          iconName: 'delete'
        }
      ],
      [
        {
          label: $localize`Generate caption`,
          handler: videos => this.generateCaption(videos),
          isDisplayed: videos => videos.every(v => v.canGenerateTranscription(this.authUser, this.serverConfig.videoTranscription.enabled)),
          iconName: 'video-lang'
        }
      ],
      [
        {
          label: $localize`Retry import`,
          handler: videos => this.retryImport(videos),
          isDisplayed: videos => videos.every(v => this.authUser.hasRight(UserRight.MANAGE_VIDEO_IMPORTS) && this.isImportFailed(v)),
          iconName: 'refresh'
        }
      ]
    ]
  }

  isUnpublished (video: Video) {
    return video.state.id !== VideoState.LIVE_ENDED && video.state.id !== VideoState.PUBLISHED
  }

  isVideoBlocked (video: Video) {
    return video.blacklisted
  }

  isImport (video: Video) {
    const state = video.state.id

    return state === VideoState.TO_IMPORT || state === VideoState.TO_IMPORT_FAILED
  }

  isImportFailed (video: Video) {
    return video.state?.id === VideoState.TO_IMPORT_FAILED
  }

  hasOriginalFile (video: Video) {
    return !!video.videoSource?.fileDownloadUrl
  }

  hasHLS (video: Video) {
    const p = video.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    if (!p) return false

    return p.files.length !== 0
  }

  hasWebVideos (video: Video) {
    return video.files.length !== 0
  }

  hasObjectStorage (video: Video) {
    if (!video.isLocal) return false

    const files = getAllFiles(video)

    return files.some(f => f.storage === FileStorage.OBJECT_STORAGE)
  }

  canRemoveOneFile (video: Video) {
    return video.canRemoveOneFile(this.authUser)
  }

  getFilesSize (video: Video) {
    let total = getAllFiles(video).reduce((p, f) => p + f.size, 0)

    if (video.videoSource?.fileDownloadUrl) {
      total += video.videoSource.size || 0
    }

    return total
  }

  getVideoStateBadgeClass (state: VideoStateType) {
    return 'pt-badge ' + getVideoStateBadgeClass(state)
  }

  async removeVideoFile (video: Video, file: VideoFile, type: 'hls' | 'web-videos') {
    const message = $localize`Are you sure you want to delete this ${file.resolution.label} file?`
    const res = await this.confirmService.confirm(message, $localize`Delete file`)
    if (res === false) return

    this.videoService.removeFile(video.uuid, file.id, type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`File removed.`)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async removeVideoSourceFile (video: Video) {
    const message = $localize`Are you sure you want to delete the original file of this video?`
    const res = await this.confirmService.confirm(message, $localize`Delete original file`)
    if (res === false) return

    this.videoService.removeSourceFile(video.uuid)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Original file removed.`)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  // ---------------------------------------------------------------------------

  onRowExpand (event: TableRowExpandEvent) {
    const video = event.data as VideoDetails

    if (!video.videoSource?.inputFilename && !videoRequiresFileToken(video)) return

    this.videoFileTokenService.getVideoFileToken({ videoUUID: video.uuid })
      .subscribe(({ token }) => {
        this.videoFileTokens[video.id] = token
      })
  }

  getDownloadUrl (video: VideoDetails, downloadUrl: string) {
    const token = this.videoFileTokens[video.id]
    if (!token) return downloadUrl

    return downloadUrl + `?videoFileToken=${token}`
  }

  // ---------------------------------------------------------------------------

  onDataLoaded () {
    this.loadBlockStatus()
  }

  loadBlockStatus () {
    const videos = this.table().data

    const accounts = this.getUniqueAccounts(videos)
    const hosts = this.getUniqueHosts(videos)

    this.blocklistService.getStatus({ accounts: accounts.map(a => a.name + '@' + a.host), hosts })
      .subscribe(status => {
        this.accountBlocklist = new Map()

        for (const a of accounts) {
          const handle = a.name + '@' + a.host

          this.accountBlocklist.set(a.id, {
            mutedByInstance: status.accounts[handle].blockedByServer,
            mutedServerByInstance: status.hosts[a.host].blockedByServer
          })
        }
      })
  }

  private getUniqueAccounts (videos: Video[]) {
    const accountsDone = new Set<number>()

    return videos
      .map(a => {
        if (!a.account || accountsDone.has(a.account.id)) return null

        accountsDone.add(a.account.id)
        return a.account
      }).filter(a => !!a)
  }

  private getUniqueHosts (videos: Video[]) {
    return Array.from(new Set(videos.map(c => c.account.host)))
  }

  // ---------------------------------------------------------------------------

  private _dataLoader (
    options: DataLoaderOptionsBase & Partial<Parameters<VideoAdminService['listAdminVideos']>[0]> & {
      state?: VideoStateType | string
    }
  ) {
    return this.videoAdminService.listAdminVideos({
      // Always list NSFW video, overriding instance/user setting
      nsfwFlagsExcluded: NSFWFlag.NONE,
      nsfw: 'both',

      stateOneOf: options.state
        ? [ options.state as VideoStateType ]
        : undefined,

      ...options
    })
  }

  private async removeVideos (videos: Video[]) {
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

  private unblockVideos (videos: Video[]) {
    this.videoBlockService.unblockVideos(videos.map(v => v.id))
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`Unblocked {count, plural, =1 {1 video} other {{count} videos}}.`,
              { count: videos.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private async removeVideoFiles (videos: Video[], type: 'hls' | 'web-videos') {
    let message: string

    if (type === 'hls') {
      message = formatICU(
        $localize`Are you sure you want to delete {count, plural, =1 {1 HLS streaming playlist} other {{count} HLS streaming playlists}}?`,
        { count: videos.length }
      )
    } else {
      message = formatICU(
        $localize`Are you sure you want to delete Web Video files of {count, plural, =1 {1 video} other {{count} videos}}?`,
        { count: videos.length }
      )
    }

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.videoService.removeVideoFiles(videos.map(v => v.id), type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Files were removed.`)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private runTranscoding (videos: Video[], type: 'hls' | 'web-video') {
    this.videoService.runTranscoding({ videos, type })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Transcoding jobs created.`)

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private generateCaption (videos: Video[]) {
    this.videoCaptionService.generateCaption({ videos })
      .subscribe({
        next: result => {
          if (result.success) {
            this.notifier.success(
              formatICU(
                $localize`{count, plural, =1 {1 transcription job created.} other {{count} transcription jobs created.}}`,
                { count: result.success }
              )
            )
          }

          if (result.alreadyHasCaptions) {
            this.notifier.info(
              formatICU(
                $localize`{count, plural, =1 {1 video already has captions.} other {{count} videos already have captions.}}`,
                { count: result.alreadyHasCaptions }
              )
            )
          }

          if (result.alreadyBeingTranscribed) {
            this.notifier.info(
              formatICU(
                // eslint-disable-next-line max-len
                $localize`{count, plural, =1 {1 video is already being transcribed.} other {{count} videos are already being transcribed.}}`,
                { count: result.alreadyBeingTranscribed }
              )
            )
          }
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private retryImport (videos: Video[]) {
    this.videoImportService.retryVideoImportByVideos(videos)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`Retry import requested for {count, plural, =1 {1 video} other {{count} videos}}.`,
              { count: videos.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
