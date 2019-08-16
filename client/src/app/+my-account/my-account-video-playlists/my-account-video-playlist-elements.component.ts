import { Component, OnDestroy, OnInit } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Video } from '@app/shared/video/video.model'
import { Subject, Subscription } from 'rxjs'
import { ActivatedRoute } from '@angular/router'
import { VideoService } from '@app/shared/video/video.service'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { CdkDragDrop, CdkDragMove } from '@angular/cdk/drag-drop'
import { throttleTime } from 'rxjs/operators'

@Component({
  selector: 'my-account-video-playlist-elements',
  templateUrl: './my-account-video-playlist-elements.component.html',
  styleUrls: [ './my-account-video-playlist-elements.component.scss' ]
})
export class MyAccountVideoPlaylistElementsComponent implements OnInit, OnDestroy {
  videos: Video[] = []
  playlist: VideoPlaylist

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 30,
    totalItems: null
  }

  private videoPlaylistId: string | number
  private paramsSub: Subscription
  private dragMoveSubject = new Subject<number>()

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private route: ActivatedRoute,
    private i18n: I18n,
    private videoService: VideoService,
    private videoPlaylistService: VideoPlaylistService
  ) {}

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      this.videoPlaylistId = routeParams[ 'videoPlaylistId' ]
      this.loadElements()

      this.loadPlaylistInfo()
    })

    this.dragMoveSubject.asObservable()
      .pipe(throttleTime(200))
      .subscribe(y => this.checkScroll(y))
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  drop (event: CdkDragDrop<any>) {
    const previousIndex = event.previousIndex
    const newIndex = event.currentIndex

    if (previousIndex === newIndex) return

    const oldPosition = this.videos[previousIndex].playlistElement.position
    let insertAfter = this.videos[newIndex].playlistElement.position

    if (oldPosition > insertAfter) insertAfter--

    this.videoPlaylistService.reorderPlaylist(this.playlist.id, oldPosition, insertAfter)
      .subscribe(
        () => { /* nothing to do */ },

        err => this.notifier.error(err.message)
      )

    const video = this.videos[previousIndex]

    this.videos.splice(previousIndex, 1)
    this.videos.splice(newIndex, 0, video)

    this.reorderClientPositions()
  }

  onDragMove (event: CdkDragMove<any>) {
    this.dragMoveSubject.next(event.pointerPosition.y)
  }

  checkScroll (pointerY: number) {
    // FIXME: Uncomment when https://github.com/angular/material2/issues/14098 is fixed
    // FIXME: Remove when https://github.com/angular/material2/issues/13588 is implemented
    // if (pointerY < 150) {
    //   window.scrollBy({
    //     left: 0,
    //     top: -20,
    //     behavior: 'smooth'
    //   })
    //
    //   return
    // }
    //
    // if (window.innerHeight - pointerY <= 50) {
    //   window.scrollBy({
    //     left: 0,
    //     top: 20,
    //     behavior: 'smooth'
    //   })
    // }
  }

  onElementRemoved (video: Video) {
    this.videos = this.videos.filter(v => v.id !== video.id)
    this.reorderClientPositions()
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadElements()
  }

  trackByFn (index: number, elem: Video) {
    return elem.id
  }

  private loadElements () {
    this.videoService.getPlaylistVideos(this.videoPlaylistId, this.pagination)
        .subscribe(({ totalVideos, videos }) => {
          this.videos = this.videos.concat(videos)
          this.pagination.totalItems = totalVideos
        })
  }

  private loadPlaylistInfo () {
    this.videoPlaylistService.getVideoPlaylist(this.videoPlaylistId)
      .subscribe(playlist => {
        this.playlist = playlist
      })
  }

  private reorderClientPositions () {
    let i = 1

    for (const video of this.videos) {
      video.playlistElement.position = i
      i++
    }
  }
}
