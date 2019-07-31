import { Component, OnDestroy, OnInit } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Subscription } from 'rxjs'
import { ActivatedRoute } from '@angular/router'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { CdkDragDrop } from '@angular/cdk/drag-drop'
import { VideoPlaylistElement } from '@app/shared/video-playlist/video-playlist-element.model'

@Component({
  selector: 'my-account-video-playlist-elements',
  templateUrl: './my-account-video-playlist-elements.component.html',
  styleUrls: [ './my-account-video-playlist-elements.component.scss' ]
})
export class MyAccountVideoPlaylistElementsComponent implements OnInit, OnDestroy {
  playlistElements: VideoPlaylistElement[] = []
  playlist: VideoPlaylist

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 30,
    totalItems: null
  }

  private videoPlaylistId: string | number
  private paramsSub: Subscription

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private route: ActivatedRoute,
    private i18n: I18n,
    private videoPlaylistService: VideoPlaylistService
  ) {}

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      this.videoPlaylistId = routeParams[ 'videoPlaylistId' ]
      this.loadElements()

      this.loadPlaylistInfo()
    })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  drop (event: CdkDragDrop<any>) {
    const previousIndex = event.previousIndex
    const newIndex = event.currentIndex

    if (previousIndex === newIndex) return

    const oldPosition = this.playlistElements[previousIndex].position
    let insertAfter = this.playlistElements[newIndex].position

    if (oldPosition > insertAfter) insertAfter--

    this.videoPlaylistService.reorderPlaylist(this.playlist.id, oldPosition, insertAfter)
      .subscribe(
        () => { /* nothing to do */ },

        err => this.notifier.error(err.message)
      )

    const element = this.playlistElements[previousIndex]

    this.playlistElements.splice(previousIndex, 1)
    this.playlistElements.splice(newIndex, 0, element)

    this.reorderClientPositions()
  }

  onElementRemoved (element: VideoPlaylistElement) {
    this.playlistElements = this.playlistElements.filter(v => v.id !== element.id)
    this.reorderClientPositions()
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadElements()
  }

  trackByFn (index: number, elem: VideoPlaylistElement) {
    return elem.id
  }

  private loadElements () {
    this.videoPlaylistService.getPlaylistVideos(this.videoPlaylistId, this.pagination)
        .subscribe(({ total, data }) => {
          this.playlistElements = this.playlistElements.concat(data)
          this.pagination.totalItems = total
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

    for (const element of this.playlistElements) {
      element.position = i
      i++
    }
  }
}
