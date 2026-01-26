import { NgClass } from '@angular/common'
import { Component, inject, input, output } from '@angular/core'
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
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { InfiniteScrollerDirective } from '@app/shared/shared-main/common/infinite-scroller.directive'
import { VideoPlaylistElementMiniatureComponent } from '@app/shared/shared-video-playlist/video-playlist-element-miniature.component'
import { VideoPlaylistElement } from '@app/shared/shared-video-playlist/video-playlist-element.model'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { getBoolOrDefault } from '@root-helpers/local-storage-utils'
import { peertubeSessionStorage } from '@root-helpers/peertube-web-storage'

@Component({
  selector: 'my-video-watch-playlist',
  templateUrl: './video-watch-playlist.component.html',
  styleUrls: [ './player-widget.component.scss', './video-watch-playlist.component.scss' ],
  imports: [ InfiniteScrollerDirective, NgClass, NgbTooltip, GlobalIconComponent, VideoPlaylistElementMiniatureComponent ]
})
export class VideoWatchPlaylistComponent {
  private hooks = inject(HooksService)
  private userService = inject(UserService)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private videoPlaylist = inject(VideoPlaylistService)
  private sessionStorage = inject(SessionStorageService)
  private router = inject(Router)

  static SESSION_STORAGE_LOOP_PLAYLIST = 'loop_playlist'

  readonly playlist = input<VideoPlaylist>(undefined)

  readonly videoFound = output<string>()
  readonly noVideoFound = output()

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

  constructor () {
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
    this.loadPlaylistElements({ playlist: this.playlist(), redirectToFirst: false, position })
  }

  onElementRemoved (playlistElement: VideoPlaylistElement) {
    this.playlistElements = this.playlistElements.filter(e => e.id !== playlistElement.id)

    updatePaginationOnDelete(this.playlistPagination)
  }

  isPlaylistOwned () {
    const playlist = this.playlist()
    return playlist.isLocal === true &&
      this.auth.isLoggedIn() &&
      playlist.ownerAccount.name === this.auth.getUser().username
  }

  isUnlistedPlaylist () {
    return this.playlist().privacy.id === VideoPlaylistPrivacy.UNLISTED
  }

  isPrivatePlaylist () {
    return this.playlist().privacy.id === VideoPlaylistPrivacy.PRIVATE
  }

  isPublicPlaylist () {
    return this.playlist().privacy.id === VideoPlaylistPrivacy.PUBLIC
  }

  loadPlaylistElements (options: {
    playlist: VideoPlaylist
    redirectToFirst?: boolean // default false
    reset?: boolean // default false
    position?: number
  }) {
    const { playlist, redirectToFirst = false, reset = false, position } = options

    const obs = this.hooks.wrapObsFun(
      this.videoPlaylist.getPlaylistVideos.bind(this.videoPlaylist),
      { videoPlaylistId: playlist.uuid, componentPagination: this.playlistPagination },
      'video-watch',
      'filter:api.video-watch.video-playlist-elements.get.params',
      'filter:api.video-watch.video-playlist-elements.get.result'
    )

    obs.subscribe(({ total, data: playlistElements }) => {
      if (reset) this.playlistElements = []

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
    if (position < 0) position = this.playlist().videosLength + position + 1

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

          error: err => this.notifier.handleError(err)
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
