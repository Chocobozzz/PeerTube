import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { UserRight } from '@shared/models'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { VideoActionsDisplayType } from '@app/shared/shared-video-miniature'

@Component({
  selector: 'my-video-list',
  templateUrl: './video-list.component.html',
  styleUrls: [ './video-list.component.scss' ]
})
export class VideoListComponent extends RestTable implements OnInit {
  videos: Video[] = []

  totalRecords = 0
  sort: SortMeta = { field: 'publishedAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  bulkVideoActions: DropdownAction<Video[]>[][] = []

  selectedVideos: Video[] = []

  inputFilters: AdvancedInputFilter[] = [
    {
      title: $localize`Advanced filters`,
      children: [
        {
          queryParams: { search: 'local:true' },
          label: $localize`Only local videos`
        }
      ]
    }
  ]

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

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private confirmService: ConfirmService,
    private auth: AuthService,
    private notifier: Notifier,
    private videoService: VideoService
  ) {
    super()
  }

  get authUser () {
    return this.auth.getUser()
  }

  ngOnInit () {
    this.initialize()

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

  protected reloadData () {
    this.selectedVideos = []

    this.videoService.getAdminVideos({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe({
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
