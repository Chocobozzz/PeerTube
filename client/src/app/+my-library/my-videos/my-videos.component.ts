import { concat, Observable, Subject } from 'rxjs'
import { debounceTime, tap, toArray } from 'rxjs/operators'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, Notifier, ScreenService, ServerService } from '@app/core'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'
import { immutableAssign } from '@app/helpers'
import { DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { LiveStreamInformationComponent } from '@app/shared/shared-video-live'
import { MiniatureDisplayOptions, OwnerDisplayType, SelectionType, VideosSelectionComponent } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@shared/models'
import { VideoChangeOwnershipComponent } from './modals/video-change-ownership.component'

@Component({
  templateUrl: './my-videos.component.html',
  styleUrls: [ './my-videos.component.scss' ]
})
export class MyVideosComponent implements OnInit, DisableForReuseHook {
  @ViewChild('videosSelection', { static: true }) videosSelection: VideosSelectionComponent
  @ViewChild('videoChangeOwnershipModal', { static: true }) videoChangeOwnershipModal: VideoChangeOwnershipComponent
  @ViewChild('liveStreamInformationModal', { static: true }) liveStreamInformationModal: LiveStreamInformationComponent

  titlePage: string
  selection: SelectionType = {}
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  miniatureDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    privacyLabel: false,
    privacyText: true,
    state: true,
    blacklistInfo: true
  }
  ownerDisplayType: OwnerDisplayType = 'videoChannel'

  videoActions: DropdownAction<{ video: Video }>[] = []

  videos: Video[] = []
  videosSearch: string
  videosSearchChanged = new Subject<string>()
  getVideosObservableFunction = this.getVideosObservable.bind(this)

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected notifier: Notifier,
    protected screenService: ScreenService,
    private confirmService: ConfirmService,
    private videoService: VideoService
  ) {
    this.titlePage = $localize`My videos`
  }

  ngOnInit () {
    this.buildActions()

    this.videosSearchChanged
      .pipe(debounceTime(500))
      .subscribe(() => {
        this.videosSelection.reloadVideos()
      })
  }

  resetSearch () {
    this.videosSearch = ''
    this.onVideosSearchChanged()
  }

  onVideosSearchChanged () {
    this.videosSearchChanged.next()
  }

  disableForReuse () {
    this.videosSelection.disableForReuse()
  }

  enabledForReuse () {
    this.videosSelection.enabledForReuse()
  }

  getVideosObservable (page: number, sort: VideoSortField) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoService.getMyVideos(newPagination, sort, this.videosSearch)
      .pipe(
        tap(res => this.pagination.totalItems = res.total)
      )
  }

  async deleteSelectedVideos () {
    const toDeleteVideosIds = Object.keys(this.selection)
                                    .filter(k => this.selection[ k ] === true)
                                    .map(k => parseInt(k, 10))

    const res = await this.confirmService.confirm(
      $localize`Do you really want to delete ${toDeleteVideosIds.length} videos?`,
      $localize`Delete`
    )
    if (res === false) return

    const observables: Observable<any>[] = []
    for (const videoId of toDeleteVideosIds) {
      const o = this.videoService.removeVideo(videoId)
                    .pipe(tap(() => this.removeVideoFromArray(videoId)))

      observables.push(o)
    }

    concat(...observables)
      .pipe(toArray())
      .subscribe(
        () => {
          this.notifier.success($localize`${toDeleteVideosIds.length} videos deleted.`)
          this.selection = {}
        },

        err => this.notifier.error(err.message)
      )
  }

  async deleteVideo (video: Video) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to delete ${video.name}?`,
      $localize`Delete`
    )
    if (res === false) return

    this.videoService.removeVideo(video.id)
        .subscribe(
          () => {
            this.notifier.success($localize`Video ${video.name} deleted.`)
            this.removeVideoFromArray(video.id)
          },

          error => this.notifier.error(error.message)
        )
  }

  changeOwnership (video: Video) {
    this.videoChangeOwnershipModal.show(video)
  }

  displayLiveInformation (video: Video) {
    this.liveStreamInformationModal.show(video)
  }

  private removeVideoFromArray (id: number) {
    this.videos = this.videos.filter(v => v.id !== id)
  }

  private buildActions () {
    this.videoActions = [
      {
        label: $localize`Display live information`,
        handler: ({ video }) => this.displayLiveInformation(video),
        isDisplayed: ({ video }) => video.isLive,
        iconName: 'live'
      },
      {
        label: $localize`Change ownership`,
        handler: ({ video }) => this.changeOwnership(video),
        iconName: 'ownership-change'
      },
      {
        label: $localize`Delete`,
        handler: ({ video }) => this.deleteVideo(video),
        iconName: 'delete'
      }
    ]
  }
}
