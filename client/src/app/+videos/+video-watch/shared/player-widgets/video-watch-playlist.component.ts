import { NgClass, NgFor, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { Router } from '@angular/router'
import {
  AuthService,
  ComponentPagination,
  HooksService,
  Notifier,
  SessionStorageService,
  updatePaginationOnDelete,
  UserService
} from '@app/core'
import { isInViewport } from '@app/helpers'
import { VideoPlaylistElement } from '@app/shared/shared-video-playlist/video-playlist-element.model'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { getBoolOrDefault } from '@root-helpers/local-storage-utils'
import { peertubeSessionStorage } from '@root-helpers/peertube-web-storage'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { InfiniteScrollerDirective } from '../../../../shared/shared-main/common/infinite-scroller.directive'
import { VideoPlaylistElementMiniatureComponent } from '../../../../shared/shared-video-playlist/video-playlist-element-miniature.component'

@Component({
  selector: 'my-video-watch-playlist',
  templateUrl: './video-watch-playlist.component.html',
  styleUrls: [ './player-widget.component.scss', './video-watch-playlist.component.scss' ],
  standalone: true,
  imports: [ NgIf, InfiniteScrollerDirective, NgClass, NgbTooltip, GlobalIconComponent, NgFor, VideoPlaylistElementMiniatureComponent ]
})
export class VideoWatchPlaylistComponent {
  static SESSION_STORAGE_LOOP_PLAYLIST = 'loop_playlist'

  @Input() playlist: VideoPlaylist

  @Output() videoFound = new EventEmitter<string>()
  @Output() noVideoFound = new EventEmitter<void>()

  playlistElements: VideoPlaylistElement[] = []
  playlistPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 30,
    totalItems: null
  }

  autoPlayNextVideoPlaylist: boolean
  autoPlayNextVideoPlaylistSwitchText = ''

  loopPlaylist: boolean
  loopPlaylistSwitchText = ''

  noPlaylistVideos = false
  currentPlaylistPosition: number

  constructor (
    private hooks: HooksService,
    private userService: UserService,
    private auth: AuthService,
    private notifier: Notifier,
    private videoPlaylist: VideoPlaylistService,
    private sessionStorage: SessionStorageService,
    private router: Router
  ) {
    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.autoPlayNextVideoPlaylist = user.autoPlayNextVideoPlaylist)

    this.setAutoPlayNextVideoPlaylistSwitchText()

    this.loopPlaylist = getBoolOrDefault(this.sessionStorage.getItem(VideoWatchPlaylistComponent.SESSION_STORAGE_LOOP_PLAYLIST), false)
    this.setLoopPlaylistSwitchText()
  }

  onPlaylistVideosNearOfBottom (position?: number) {
    // Last page
    if (this.playlistPagination.totalItems <= (this.playlistPagination.currentPage * this.playlistPagination.itemsPerPage)) return

    this.playlistPagination.currentPage += 1
    this.loadPlaylistElements(this.playlist, false, position)
  }

  onElementRemoved (playlistElement: VideoPlaylistElement) {
    this.playlistElements = this.playlistElements.filter(e => e.id !== playlistElement.id)

    updatePaginationOnDelete(this.playlistPagination)
  }

  isPlaylistOwned () {
    return this.playlist.isLocal === true &&
      this.auth.isLoggedIn() &&
      this.playlist.ownerAccount.name === this.auth.getUser().username
  }

  isUnlistedPlaylist () {
    return this.playlist.privacy.id === VideoPlaylistPrivacy.UNLISTED
  }

  isPrivatePlaylist () {
    return this.playlist.privacy.id === VideoPlaylistPrivacy.PRIVATE
  }

  isPublicPlaylist () {
    return this.playlist.privacy.id === VideoPlaylistPrivacy.PUBLIC
  }

  loadPlaylistElements (playlist: VideoPlaylist, redirectToFirst = false, position?: number) {
    const obs = this.hooks.wrapObsFun(
      this.videoPlaylist.getPlaylistVideos.bind(this.videoPlaylist),
      { videoPlaylistId: playlist.uuid, componentPagination: this.playlistPagination },
      'video-watch',
      'filter:api.video-watch.video-playlist-elements.get.params',
      'filter:api.video-watch.video-playlist-elements.get.result'
    )

    obs.subscribe(({ total, data: playlistElements }) => {
      this.playlistElements = this.playlistElements.concat(playlistElements)
      this.playlistPagination.totalItems = total

      const firstAvailableVideo = this.playlistElements.find(e => !!e.video)
      if (!firstAvailableVideo) {
        this.noPlaylistVideos = true
        this.noVideoFound.emit()
        return
      }

      if (position) this.updatePlaylistIndex(position)

      if (redirectToFirst) {
        const extras = {
          queryParams: {
            start: firstAvailableVideo.startTimestamp,
            stop: firstAvailableVideo.stopTimestamp,
            playlistPosition: firstAvailableVideo.position
          },
          replaceUrl: true
        }
        this.router.navigate([], extras)
      }
    })
  }

  updatePlaylistIndex (position: number) {
    if (this.playlistElements.length === 0 || !position) return

    // Handle the reverse index
    if (position < 0) position = this.playlist.videosLength + position + 1

    for (const playlistElement of this.playlistElements) {
      // >= if the previous videos were not valid
      if (playlistElement.video && playlistElement.position >= position) {
        this.currentPlaylistPosition = playlistElement.position

        this.videoFound.emit(playlistElement.video.uuid)

        setTimeout(() => {
          const element = document.querySelector<HTMLElement>('.element-' + this.currentPlaylistPosition)
          const container = document.querySelector<HTMLElement>('.playlist')

          if (isInViewport(element, container)) return

          container.scrollTop = element.offsetTop
        })

        return
      }
    }

    // Load more videos to find our video
    this.onPlaylistVideosNearOfBottom(position)
  }

  // ---------------------------------------------------------------------------

  hasPreviousVideo () {
    return !!this.getPreviousVideo()
  }

  getPreviousVideo () {
    return this.findPlaylistVideo(this.currentPlaylistPosition - 1, 'previous')
  }

  // ---------------------------------------------------------------------------

  hasNextVideo () {
    return !!this.getNextVideo()
  }

  getNextVideo () {
    return this.findPlaylistVideo(this.currentPlaylistPosition + 1, 'next')
  }

  navigateToPreviousPlaylistVideo () {
    const previous = this.findPlaylistVideo(this.currentPlaylistPosition - 1, 'previous')
    if (!previous) return

    const start = previous.startTimestamp
    const stop = previous.stopTimestamp
    this.router.navigate([], { queryParams: { playlistPosition: previous.position, start, stop } })
  }

  findPlaylistVideo (position: number, type: 'previous' | 'next'): VideoPlaylistElement {
    if (
      (type === 'next' && position > this.playlistPagination.totalItems) ||
      (type === 'previous' && position < 1)
    ) {
      // End of the playlist: end the recursion if we're not in the loop mode
      if (!this.loopPlaylist) return

      // Loop mode
      position = type === 'previous'
        ? this.playlistPagination.totalItems
        : 1
    }

    const found = this.playlistElements.find(e => e.position === position)
    if (found?.video) return found

    const newPosition = type === 'previous'
      ? position - 1
      : position + 1

    return this.findPlaylistVideo(newPosition, type)
  }

  navigateToNextPlaylistVideo () {
    const next = this.findPlaylistVideo(this.currentPlaylistPosition + 1, 'next')
    if (!next) return

    const start = next.startTimestamp
    const stop = next.stopTimestamp
    this.router.navigate([], { queryParams: { playlistPosition: next.position, start, stop } })
  }

  switchAutoPlayNextVideoPlaylist () {
    this.autoPlayNextVideoPlaylist = !this.autoPlayNextVideoPlaylist
    this.setAutoPlayNextVideoPlaylistSwitchText()

    const details = { autoPlayNextVideoPlaylist: this.autoPlayNextVideoPlaylist }

    if (this.auth.isLoggedIn()) {
      this.userService.updateMyProfile(details)
        .subscribe({
          next: () => {
            this.auth.refreshUserInformation()
          },

          error: err => this.notifier.error(err.message)
        })
    } else {
      this.userService.updateMyAnonymousProfile(details)
    }
  }

  switchLoopPlaylist () {
    this.loopPlaylist = !this.loopPlaylist
    this.setLoopPlaylistSwitchText()

    peertubeSessionStorage.setItem(
      VideoWatchPlaylistComponent.SESSION_STORAGE_LOOP_PLAYLIST,
      this.loopPlaylist.toString()
    )
  }

  private setAutoPlayNextVideoPlaylistSwitchText () {
    this.autoPlayNextVideoPlaylistSwitchText = this.autoPlayNextVideoPlaylist
      ? $localize`Stop autoplaying next video`
      : $localize`Autoplay next video`
  }

  private setLoopPlaylistSwitchText () {
    this.loopPlaylistSwitchText = this.loopPlaylist
      ? $localize`Stop looping playlist videos`
      : $localize`Loop playlist videos`
  }
}
