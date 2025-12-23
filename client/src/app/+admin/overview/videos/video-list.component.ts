import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { AuthService, ConfirmService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoFileTokenService } from '@app/shared/shared-main/video/video-file-token.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoBlockComponent } from '@app/shared/shared-moderation/video-block.component'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { PrivacyBadgeComponent } from '@app/shared/shared-video/privacy-badge.component'
import { getAllFiles } from '@peertube/peertube-core-utils'
import { FileStorage, NSFWFlag, UserRight, VideoFile, VideoState, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { videoRequiresFileToken } from '@root-helpers/video'
import { TableRowExpandEvent } from 'primeng/table'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../../shared/shared-video-miniature/video-actions-dropdown.component'
import { VideoNSFWBadgeComponent } from '../../../shared/shared-video/video-nsfw-badge.component'
import { VideoAdminService } from './video-admin.service'

type ColumnName =
  | 'video'
  | 'info'
  | 'localVideoFilesSize'
  | 'publishedAt'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    VideoActionsDropdownComponent,
    VideoCellComponent,
    EmbedComponent,
    VideoBlockComponent,
    PTDatePipe,
    RouterLink,
    BytesPipe,
    PrivacyBadgeComponent,
    VideoNSFWBadgeComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class VideoListComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private confirmService = inject(ConfirmService)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private videoService = inject(VideoService)
  private videoAdminService = inject(VideoAdminService)
  private videoBlockService = inject(VideoBlockService)
  private videoCaptionService = inject(VideoCaptionService)
  private server = inject(ServerService)
  private videoFileTokenService = inject(VideoFileTokenService)

  readonly videoBlockModal = viewChild<VideoBlockComponent>('videoBlockModal')
  readonly table = viewChild<TableComponent<Video>>('table')

  bulkActions: DropdownAction<Video[]>[][] = []
  inputFilters: AdvancedInputFilter[]

  videoActionsOptions: VideoActionsDisplayType = {
    playlist: false,
    download: false,
    update: true,
    blacklist: true,
    delete: true,
    report: false,
    duplicate: true,
    mute: true,
    liveInfo: false,
    removeFiles: true,
    transcoding: true,
    generateTranscription: true
  }

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'video', label: $localize`Video`, sortable: false },
    { id: 'info', label: $localize`Info`, sortable: false },
    { id: 'localVideoFilesSize', label: $localize`Files`, sortable: true },
    { id: 'publishedAt', label: $localize`Published`, sortable: true }
  ]

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
    this.inputFilters = this.videoAdminService.buildAdminInputFilter()

    this.bulkActions = [
      [
        {
          label: $localize`Delete`,
          handler: videos => this.removeVideos(videos),
          isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO),
          iconName: 'delete'
        },
        {
          label: $localize`Block`,
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
      ]
    ]
  }

  isUnpublished (video: Video) {
    return video.state.id !== VideoState.LIVE_ENDED && video.state.id !== VideoState.PUBLISHED
  }

  isAccountBlocked (video: Video) {
    return video.blockedOwner
  }

  isServerBlocked (video: Video) {
    return video.blockedServer
  }

  isVideoBlocked (video: Video) {
    return video.blacklisted
  }

  isImport (video: Video) {
    const state = video.state.id

    return state === VideoState.TO_IMPORT || state === VideoState.TO_IMPORT_FAILED
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
    let total = getAllFiles(video).reduce((p, f) => p += f.size, 0)

    if (video.videoSource?.fileDownloadUrl) {
      total += video.videoSource.size || 0
    }

    return total
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

  buildSearchAutoTag (tag: string) {
    const str = `autoTag:"${tag}"`

    const search = this.route.snapshot.queryParams.search
    if (search) return search + ' ' + str

    return str
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

  private _dataLoader (options: DataLoaderOptions) {
    return this.videoAdminService.getAdminVideos({
      ...options,

      // Always list NSFW video, overriding instance/user setting
      nsfw: 'both',
      nsfwFlagsExcluded: NSFWFlag.NONE
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
    this.videoBlockService.unblockVideo(videos.map(v => v.id))
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
}
