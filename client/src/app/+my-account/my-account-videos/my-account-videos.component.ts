import { concat, Observable, Subject } from 'rxjs'
import { tap, toArray, debounceTime } from 'rxjs/operators'
import { Component, ViewChild, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { immutableAssign } from '@app/shared/misc/utils'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Notifier, ServerService } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { Video } from '../../shared/video/video.model'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { VideoChangeOwnershipComponent } from './video-change-ownership/video-change-ownership.component'
import { MiniatureDisplayOptions } from '@app/shared/video/video-miniature.component'
import { SelectionType, VideosSelectionComponent } from '@app/shared/video/videos-selection.component'
import { VideoSortField } from '@app/shared/video/sort-field.type'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'

@Component({
  selector: 'my-account-videos',
  templateUrl: './my-account-videos.component.html',
  styleUrls: [ './my-account-videos.component.scss' ]
})
export class MyAccountVideosComponent implements OnInit, DisableForReuseHook {
  @ViewChild('videosSelection', { static: true }) videosSelection: VideosSelectionComponent
  @ViewChild('videoChangeOwnershipModal', { static: true }) videoChangeOwnershipModal: VideoChangeOwnershipComponent

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
    by: false,
    privacyLabel: false,
    privacyText: true,
    state: true,
    blacklistInfo: true
  }
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
    private i18n: I18n,
    private confirmService: ConfirmService,
    private videoService: VideoService
  ) {
    this.titlePage = this.i18n('My videos')
  }

  ngOnInit () {
    this.videosSearchChanged
      .pipe(
        debounceTime(500))
      .subscribe(() => {
        this.videosSelection.reloadVideos()
      })
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
      this.i18n('Do you really want to delete {{deleteLength}} videos?', { deleteLength: toDeleteVideosIds.length }),
      this.i18n('Delete')
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
          this.notifier.success(this.i18n('{{deleteLength}} videos deleted.', { deleteLength: toDeleteVideosIds.length }))

          this.selection = {}
        },

        err => this.notifier.error(err.message)
      )
  }

  async deleteVideo (video: Video) {
    const res = await this.confirmService.confirm(
      this.i18n('Do you really want to delete {{videoName}}?', { videoName: video.name }),
      this.i18n('Delete')
    )
    if (res === false) return

    this.videoService.removeVideo(video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video {{videoName}} deleted.', { videoName: video.name }))
            this.removeVideoFromArray(video.id)
          },

          error => this.notifier.error(error.message)
        )
  }

  changeOwnership (event: Event, video: Video) {
    event.preventDefault()
    this.videoChangeOwnershipModal.show(video)
  }

  private removeVideoFromArray (id: number) {
    this.videos = this.videos.filter(v => v.id !== id)
  }
}
