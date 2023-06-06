import { SortMeta } from 'primeng/api'
import { finalize } from 'rxjs/operators'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { formatICU } from '@app/helpers'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { VideoBlockComponent, VideoBlockService } from '@app/shared/shared-moderation'
import { VideoActionsDisplayType } from '@app/shared/shared-video-miniature'
import { getAllFiles } from '@shared/core-utils'
import { UserRight, VideoFile, VideoPrivacy, VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { VideoAdminService } from './video-admin.service'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ]
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
          label: $localize`Run WebTorrent transcoding`,
          handler: videos => this.runTranscoding(videos, 'webtorrent'),
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
          label: $localize`Delete WebTorrent files`,
          handler: videos => this.removeVideoFiles(videos, 'webtorrent'),
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

  isHLS (video: Video) {
    const p = video.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    if (!p) return false

    return p.files.length !== 0
  }

  isWebTorrent (video: Video) {
    return video.files.length !== 0
  }

  hasObjectStorage (video: Video) {
    if (!video.isLocal) return false

    const files = getAllFiles(video)

    return files.some(f => !f.fileUrl.startsWith(window.location.origin))
  }

  canRemoveOneFile (video: Video) {
    return video.canRemoveOneFile(this.authUser)
  }

  getFilesSize (video: Video) {
    let files = video.files

    if (this.isHLS(video)) {
      files = files.concat(video.streamingPlaylists[0].files)
    }

    return files.reduce((p, f) => p += f.size, 0)
  }

  async removeVideoFile (video: Video, file: VideoFile, type: 'hls' | 'webtorrent') {
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

  private async removeVideoFiles (videos: Video[], type: 'hls' | 'webtorrent') {
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
        $localize`Are you sure you want to delete WebTorrent files of {count, plural, =1 {1 video} other {{count} videos}}?`,
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

  private runTranscoding (videos: Video[], type: 'hls' | 'webtorrent') {
    this.videoService.runTranscoding(videos.map(v => v.id), type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Transcoding jobs created.`)

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
