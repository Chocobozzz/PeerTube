
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

    for (const playlistElement of this.playlistElements) {
      // >= if the previous videos were not valid
      if (playlistElement.video && playlistElement.position >= position) {
        this.currentPlaylistPosition = playlistElement.position

        this.videoFound.emit(playlistElement.video.uuid)

        setTimeout(() => {
          document.querySelector('.element-' + this.currentPlaylistPosition).scrollIntoView(false)
        }, 0)

        return
      }
    }

    // Load more videos to find our video
    this.onPlaylistVideosNearOfBottom(position)
  }

  findNextPlaylistVideo (position = this.currentPlaylistPosition): VideoPlaylistElement {
    if (this.currentPlaylistPosition >= this.playlistPagination.totalItems) {
      // we have reached the end of the playlist: either loop or stop
      if (this.loopPlaylist) {
        this.currentPlaylistPosition = position = 0
      } else {
        return
      }
    }

    const next = this.playlistElements.find(e => e.position === position)

    if (!next || !next.video) {
      return this.findNextPlaylistVideo(position + 1)
    }

    return next
  }

  navigateToNextPlaylistVideo () {
    const next = this.findNextPlaylistVideo(this.currentPlaylistPosition + 1)
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
