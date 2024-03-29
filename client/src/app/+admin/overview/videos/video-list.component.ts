import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { formatICU, getAbsoluteAPIUrl } from '@app/helpers'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoBlockComponent } from '@app/shared/shared-moderation/video-block.component'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { getAllFiles } from '@peertube/peertube-core-utils'
import { UserRight, VideoFile, VideoPrivacy, VideoState, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { finalize } from 'rxjs/operators'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { AutoColspanDirective } from '../../../shared/shared-main/angular/auto-colspan.directive'
import { BytesPipe } from '../../../shared/shared-main/angular/bytes.pipe'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { TableExpanderIconComponent } from '../../../shared/shared-tables/table-expander-icon.component'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../../shared/shared-video-miniature/video-actions-dropdown.component'
import { VideoAdminService } from './video-admin.service'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    NgClass,
    SharedModule,
    NgIf,
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    NgbTooltip,
    TableExpanderIconComponent,
    VideoActionsDropdownComponent,
    VideoCellComponent,
    AutoColspanDirective,
    NgFor,
    EmbedComponent,
    VideoBlockComponent,
    DatePipe,
    RouterLink,
    BytesPipe
  ]
})
export class VideoListComponent extends RestTable <Video> implements OnInit {
  @ViewChild('videoBlockModal') videoBlockModal: VideoBlockComponent

  videos: Video[] = []

  totalRecords = 0
  sort: SortMeta = { field: 'publishedAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

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
    studio: true,
    stats: true
  }

  loading = true

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private confirmService: ConfirmService,
    private auth: AuthService,
    private notifier: Notifier,
    private videoService: VideoService,
    private videoAdminService: VideoAdminService,
    private videoBlockService: VideoBlockService
  ) {
    super()
  }

  get authUser () {
    return this.auth.getUser()
  }

  ngOnInit () {
    this.initialize()

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
          handler: videos => this.videoBlockModal.show(videos),
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
          isDisplayed: videos => videos.every(v => v.canRemoveFiles(this.authUser)),
          iconName: 'delete'
        },
        {
          label: $localize`Delete Web Video files`,
          handler: videos => this.removeVideoFiles(videos, 'web-videos'),
          isDisplayed: videos => videos.every(v => v.canRemoveFiles(this.authUser)),
          iconName: 'delete'
        }
      ]
    ]
  }

  getIdentifier () {
    return 'VideoListComponent'
  }

  getPrivacyBadgeClass (video: Video) {
    if (video.privacy.id === VideoPrivacy.PUBLIC) return 'badge-green'

    return 'badge-yellow'
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
    return video.state.id === VideoState.TO_IMPORT
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

    return files.some(f => !f.fileUrl.startsWith(getAbsoluteAPIUrl()))
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
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
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
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  buildSearchAutoTag (tag: string) {
    const str = `autoTag:"${tag}"`

    if (this.search) return this.search + ' ' + str

    return str
  }

  protected reloadDataInternal () {
    this.loading = true

    this.videoAdminService.getAdminVideos({
      pagination: this.pagination,
      sort: this.sort,
      nsfw: 'both', // Always list NSFW video, overriding instance/user setting
      search: this.search
    }).pipe(finalize(() => this.loading = false))
      .subscribe({
        next: resultList => {
          this.videos = resultList.data
          this.totalRecords = resultList.total
        },

        error: err => this.notifier.error(err.message)
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

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
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

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private async removeVideoFiles (videos: Video[], type: 'hls' | 'web-videos') {
    let message: string

    if (type === 'hls') {
      // eslint-disable-next-line max-len
      message = formatICU(
        $localize`Are you sure you want to delete {count, plural, =1 {1 HLS streaming playlist} other {{count} HLS streaming playlists}}?`,
        { count: videos.length }
      )
    } else {
      // eslint-disable-next-line max-len
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
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private runTranscoding (videos: Video[], type: 'hls' | 'web-video') {
    this.videoService.runTranscoding({ videos, type, askForForceTranscodingIfNeeded: true })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Transcoding jobs created.`)

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
