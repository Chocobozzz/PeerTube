import { Subject, Subscription } from 'rxjs'
import { CdkDragDrop } from '@angular/cdk/drag-drop'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ComponentPagination, ConfirmService, Notifier, ScreenService } from '@app/core'
import { DropdownAction } from '@app/shared/shared-main'
import { VideoShareComponent } from '@app/shared/shared-share-modal'
import { VideoPlaylist, VideoPlaylistElement, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoPlaylistType } from '@shared/models'

@Component({
  selector: 'my-account-video-playlist-elements',
  templateUrl: './my-account-video-playlist-elements.component.html',
  styleUrls: [ './my-account-video-playlist-elements.component.scss' ]
})
export class MyAccountVideoPlaylistElementsComponent implements OnInit, OnDestroy {
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent

  playlistElements: VideoPlaylistElement[] = []
  playlist: VideoPlaylist

  playlistActions: DropdownAction<VideoPlaylist>[][] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  private videoPlaylistId: string | number
  private paramsSub: Subscription

  constructor (
    private notifier: Notifier,
    private i18n: I18n,
    private router: Router,
    private confirmService: ConfirmService,
    private route: ActivatedRoute,
    private screenService: ScreenService,
    private videoPlaylistService: VideoPlaylistService
  ) {}

  ngOnInit () {
    this.playlistActions = [
      [
        {
          label: this.i18n('Update playlist'),
          iconName: 'edit',
          linkBuilder: playlist => [ '/my-account', 'video-playlists', 'update', playlist.uuid ]
        },
        {
          label: this.i18n('Delete playlist'),
          iconName: 'delete',
          handler: playlist => this.deleteVideoPlaylist(playlist)
        }
      ]
    ]

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

    const element = this.playlistElements[previousIndex]

    this.playlistElements.splice(previousIndex, 1)
    this.playlistElements.splice(newIndex, 0, element)

    this.videoPlaylistService.reorderPlaylist(this.playlist.id, oldPosition, insertAfter)
      .subscribe(
        () => {
          this.reorderClientPositions()
        },

        err => this.notifier.error(err.message)
      )
  }

  onElementRemoved (element: VideoPlaylistElement) {
    const oldFirst = this.findFirst()

    this.playlistElements = this.playlistElements.filter(v => v.id !== element.id)
    this.reorderClientPositions(oldFirst)
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

  isRegularPlaylist (playlist: VideoPlaylist) {
    return playlist?.type.id === VideoPlaylistType.REGULAR
  }

  showShareModal () {
    this.videoShareModal.show()
  }

  async deleteVideoPlaylist (videoPlaylist: VideoPlaylist) {
    const res = await this.confirmService.confirm(
      this.i18n(
        'Do you really want to delete {{playlistDisplayName}}?',
        { playlistDisplayName: videoPlaylist.displayName }
      ),
      this.i18n('Delete')
    )
    if (res === false) return

    this.videoPlaylistService.removeVideoPlaylist(videoPlaylist)
      .subscribe(
        () => {
          this.router.navigate([ '/my-account', 'video-playlists' ])

          this.notifier.success(
            this.i18n('Playlist {{playlistDisplayName}} deleted.', { playlistDisplayName: videoPlaylist.displayName })
          )
        },

        error => this.notifier.error(error.message)
      )
  }

  /**
   * Returns null to not have drag and drop delay.
   * In small views, where elements are about 100% wide,
   * we add a delay to prevent unwanted drag&drop.
   *
   * @see {@link https://github.com/Chocobozzz/PeerTube/issues/2078}
   *
   * @returns {null|number} Null for no delay, or a number in milliseconds.
   */
  getDragStartDelay (): null | number {
    if (this.screenService.isInTouchScreen()) {
      return 500
    }

    return null
  }

  private loadElements () {
    this.videoPlaylistService.getPlaylistVideos(this.videoPlaylistId, this.pagination)
        .subscribe(({ total, data }) => {
          this.playlistElements = this.playlistElements.concat(data)
          this.pagination.totalItems = total

          this.onDataSubject.next(data)
        })
  }

  private loadPlaylistInfo () {
    this.videoPlaylistService.getVideoPlaylist(this.videoPlaylistId)
      .subscribe(playlist => {
        this.playlist = playlist
      })
  }

  private reorderClientPositions (first?: VideoPlaylistElement) {
    if (this.playlistElements.length === 0) return

    const oldFirst = first || this.findFirst()
    let i = 1

    for (const element of this.playlistElements) {
      element.position = i
      i++
    }

    // Reload playlist thumbnail if the first element changed
    const newFirst = this.findFirst()
    if (oldFirst && newFirst && oldFirst.id !== newFirst.id) {
      this.playlist.refreshThumbnail()
    }
  }

  private findFirst () {
    return this.playlistElements.find(e => e.position === 1)
  }
}
