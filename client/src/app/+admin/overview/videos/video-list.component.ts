import { SortMeta } from 'primeng/api'
import { finalize } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { VideoActionsDisplayType } from '@app/shared/shared-video-miniature'
import { UserRight, VideoPrivacy, VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { VideoAdminService } from './video-admin.service'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ]
})
export class VideoListComponent extends RestTable implements OnInit {
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
    liveInfo: false
  }

  loading = true

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private confirmService: ConfirmService,
    private auth: AuthService,
    private notifier: Notifier,
    private videoService: VideoService,
    private videoAdminService: VideoAdminService
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
          isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO)
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

  onVideoRemoved () {
    this.reloadData()
  }

  getPrivacyBadgeClass (privacy: VideoPrivacy) {
    if (privacy === VideoPrivacy.PUBLIC) return 'badge-blue'

    return 'badge-yellow'
  }

  isUnpublished (state: VideoState) {
    return state !== VideoState.LIVE_ENDED && state !== VideoState.PUBLISHED
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
      files = files.concat(video.streamingPlaylists[0].files)
    }

    return files.reduce((p, f) => p += f.size, 0)
  }

  protected reloadData () {
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
          this.notifier.success($localize`${videos.length} videos deleted.`)
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
