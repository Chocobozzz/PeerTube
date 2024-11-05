import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop'
import { NgFor, NgIf } from '@angular/common'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ComponentPagination, ConfirmService, HooksService, Notifier, ScreenService } from '@app/core'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { VideoShareComponent } from '@app/shared/shared-share-modal/video-share.component'
import { VideoPlaylistElement } from '@app/shared/shared-video-playlist/video-playlist-element.model'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { VideoPlaylistType } from '@peertube/peertube-models'
import { Subject, Subscription } from 'rxjs'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../shared/shared-main/buttons/action-dropdown.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { VideoPlaylistElementMiniatureComponent } from '../../shared/shared-video-playlist/video-playlist-element-miniature.component'
import { VideoPlaylistMiniatureComponent } from '../../shared/shared-video-playlist/video-playlist-miniature.component'

@Component({
  templateUrl: './my-video-playlist-elements.component.html',
  styleUrls: [ './my-video-playlist-elements.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    ButtonComponent,
    VideoPlaylistMiniatureComponent,
    GlobalIconComponent,
    ActionDropdownComponent,
    InfiniteScrollerDirective,
    CdkDropList,
    NgFor,
    CdkDrag,
    VideoPlaylistElementMiniatureComponent,
    VideoShareComponent
  ]
})
export class MyVideoPlaylistElementsComponent implements OnInit, OnDestroy {
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
    private hooks: HooksService,
    private notifier: Notifier,
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
          label: $localize`Update playlist`,
          iconName: 'edit',
          linkBuilder: playlist => [ '/my-library', 'video-playlists', 'update', playlist.shortUUID ]
        },
        {
          label: $localize`Delete playlist`,
          iconName: 'delete',
          handler: playlist => this.deleteVideoPlaylist(playlist)
        }
      ]
    ]

    this.paramsSub = this.route.params.subscribe(routeParams => {
      this.videoPlaylistId = routeParams['videoPlaylistId']
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
      .subscribe({
        next: () => {
          this.reorderClientPositions()
        },

        error: err => this.notifier.error(err.message)
      })
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
      $localize`Do you really want to delete ${videoPlaylist.displayName}?`,
      $localize`Delete`
    )
    if (res === false) return

    this.videoPlaylistService.removeVideoPlaylist(videoPlaylist)
      .subscribe({
        next: () => {
          this.router.navigate([ '/my-library', 'video-playlists' ])
          this.notifier.success($localize`Playlist ${videoPlaylist.displayName} deleted.`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  /**
   * Returns null to not have drag and drop delay.
   * In small views, where elements are about 100% wide,
   * we add a delay to prevent unwanted drag&drop.
   *
   * @see {@link https://github.com/Chocobozzz/PeerTube/issues/2078}
   */
  getDragStartDelay (): null | number {
    if (this.screenService.isInTouchScreen()) {
      return 500
    }

    return null
  }

  private loadElements () {
    this.hooks.wrapObsFun(
      this.videoPlaylistService.getPlaylistVideos.bind(this.videoPlaylistService),
      { videoPlaylistId: this.videoPlaylistId, componentPagination: this.pagination },
      'my-library',
      'filter:api.my-library.video-playlist-elements.list.params',
      'filter:api.my-library.video-playlist-elements.list.result'
    )
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
      this.loadPlaylistInfo()
    }
  }

  private findFirst () {
    return this.playlistElements.find(e => e.position === 1)
  }
}
