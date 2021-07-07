
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, ComponentPagination, LocalStorageService, Notifier, SessionStorageService, UserService } from '@app/core'
import { VideoPlaylist, VideoPlaylistElement, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { peertubeLocalStorage, peertubeSessionStorage } from '@root-helpers/peertube-web-storage'
import { VideoPlaylistPrivacy } from '@shared/models'

@Component({
  selector: 'my-video-watch-playlist',
  templateUrl: './video-watch-playlist.component.html',
  styleUrls: [ './video-watch-playlist.component.scss' ]
})
export class VideoWatchPlaylistComponent {
  static LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST = 'auto_play_video_playlist'
  static SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST = 'loop_playlist'

  @Input() playlist: VideoPlaylist

  @Output() videoFound = new EventEmitter<string>()

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
    private userService: UserService,
    private auth: AuthService,
    private notifier: Notifier,
    private videoPlaylist: VideoPlaylistService,
    private localStorageService: LocalStorageService,
    private sessionStorageService: SessionStorageService,
    private router: Router
  ) {
    // defaults to true
    this.autoPlayNextVideoPlaylist = this.auth.isLoggedIn()
      ? this.auth.getUser().autoPlayNextVideoPlaylist
      : this.localStorageService.getItem(VideoWatchPlaylistComponent.LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST) !== 'false'

    this.setAutoPlayNextVideoPlaylistSwitchText()

    // defaults to false
    this.loopPlaylist = this.sessionStorageService.getItem(VideoWatchPlaylistComponent.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST) === 'true'
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

    this.playlistPagination.totalItems--
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
    this.videoPlaylist.getPlaylistVideos(playlist.uuid, this.playlistPagination)
        .subscribe(({ total, data }) => {
          this.playlistElements = this.playlistElements.concat(data)
          this.playlistPagination.totalItems = total

          const firstAvailableVideo = this.playlistElements.find(e => !!e.video)
          if (!firstAvailableVideo) {
            this.noPlaylistVideos = true
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
          document.querySelector('.element-' + this.currentPlaylistPosition).scrollIntoView(false)
        })

        return
      }
    }

    // Load more videos to find our video
    this.onPlaylistVideosNearOfBottom(position)
  }

  navigateToPreviousPlaylistVideo () {
    const previous = this.findPlaylistVideo(this.currentPlaylistPosition - 1, 'previous')
    if (!previous) return

    const start = previous.startTimestamp
    const stop = previous.stopTimestamp
    this.router.navigate([],{ queryParams: { playlistPosition: previous.position, start, stop } })
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
    if (found && found.video) return found

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
    this.router.navigate([],{ queryParams: { playlistPosition: next.position, start, stop } })
  }

  switchAutoPlayNextVideoPlaylist () {
    this.autoPlayNextVideoPlaylist = !this.autoPlayNextVideoPlaylist
    this.setAutoPlayNextVideoPlaylistSwitchText()

    peertubeLocalStorage.setItem(
      VideoWatchPlaylistComponent.LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST,
      this.autoPlayNextVideoPlaylist.toString()
    )

    if (this.auth.isLoggedIn()) {
      const details = {
        autoPlayNextVideoPlaylist: this.autoPlayNextVideoPlaylist
      }

      this.userService.updateMyProfile(details).subscribe(
        () => {
          this.auth.refreshUserInformation()
        },
        err => this.notifier.error(err.message)
      )
    }
  }

  switchLoopPlaylist () {
    this.loopPlaylist = !this.loopPlaylist
    this.setLoopPlaylistSwitchText()

    peertubeSessionStorage.setItem(
      VideoWatchPlaylistComponent.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST,
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
