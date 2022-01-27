import { SortMeta } from 'primeng/api'
import { finalize } from 'rxjs/operators'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { VideoBlockComponent, VideoBlockService } from '@app/shared/shared-moderation'
import { VideoActionsDisplayType } from '@app/shared/shared-video-miniature'
import { UserRight, VideoPrivacy, VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { VideoAdminService } from './video-admin.service'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ]
})
export class VideoListComponent extends RestTable implements OnInit {
  @ViewChild('videoBlockModal') videoBlockModal: VideoBlockComponent

  videos: Video[] = []

  totalRecords = 0
  sort: SortMeta = { field: 'publishedAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  bulkVideoActions: DropdownAction<Video[]>[][] = []

  selectedVideos: Video[] = []

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
    transcoding: true
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

    this.bulkVideoActions = [
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

  isInSelectionMode () {
    return this.selectedVideos.length !== 0
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

  getFilesSize (video: Video) {
    let files = video.files

    if (this.isHLS(video)) {
      files = files.concat(...video.streamingPlaylists.map(p => p.files))
    }

    return files.reduce((p, f) => p += f.size, 0)
  }

  reloadData () {
    this.selectedVideos = []

    this.loading = true

    this.videoAdminService.getAdminVideos({
      pagination: this.pagination,
      sort: this.sort,
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
    const message = $localize`Are you sure you want to delete these ${videos.length} videos?`
    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.videoService.removeVideo(videos.map(v => v.id))
      .subscribe({
        next: () => {
          this.notifier.success($localize`Deleted ${videos.length} videos.`)
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private unblockVideos (videos: Video[]) {
    this.videoBlockService.unblockVideo(videos.map(v => v.id))
      .subscribe({
        next: () => {
          this.notifier.success($localize`Unblocked ${videos.length} videos.`)
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private async removeVideoFiles (videos: Video[], type: 'hls' | 'webtorrent') {
    const message = type === 'hls'
      ? $localize`Are you sure you want to delete ${videos.length} HLS streaming playlists?`
      : $localize`Are you sure you want to delete WebTorrent files of ${videos.length} videos?`

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
