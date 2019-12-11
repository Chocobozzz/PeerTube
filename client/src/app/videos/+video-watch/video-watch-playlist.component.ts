import { Component, Input } from '@angular/core'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { VideoDetails, VideoPlaylistPrivacy } from '@shared/models'
import { Router } from '@angular/router'
import { User, UserService } from '@app/shared'
import { AuthService, Notifier } from '@app/core'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { VideoPlaylistElement } from '@app/shared/video-playlist/video-playlist-element.model'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-watch-playlist',
  templateUrl: './video-watch-playlist.component.html',
  styleUrls: [ './video-watch-playlist.component.scss' ]
})
export class VideoWatchPlaylistComponent {
  static LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST = 'auto_play_video_playlist'

  @Input() video: VideoDetails
  @Input() playlist: VideoPlaylist

  playlistElements: VideoPlaylistElement[] = []
  playlistPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 30,
    totalItems: null
  }

  autoPlayNextVideoPlaylist: boolean
  autoPlayNextVideoPlaylistSwitchText = ''
  noPlaylistVideos = false
  currentPlaylistPosition = 1

  constructor (
    private userService: UserService,
    private auth: AuthService,
    private notifier: Notifier,
    private i18n: I18n,
    private videoPlaylist: VideoPlaylistService,
    private router: Router
  ) {
    this.autoPlayNextVideoPlaylist = this.auth.isLoggedIn()
      ? this.auth.getUser().autoPlayNextVideoPlaylist
      : peertubeLocalStorage.getItem(VideoWatchPlaylistComponent.LOCAL_STORAGE_AUTO_PLAY_NEXT_VIDEO_PLAYLIST) !== 'false'
    this.setAutoPlayNextVideoPlaylistSwitchText()
  }

  onPlaylistVideosNearOfBottom () {
    // Last page
    if (this.playlistPagination.totalItems <= (this.playlistPagination.currentPage * this.playlistPagination.itemsPerPage)) return

    this.playlistPagination.currentPage += 1
    this.loadPlaylistElements(this.playlist,false)
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

  loadPlaylistElements (playlist: VideoPlaylist, redirectToFirst = false) {
    this.videoPlaylist.getPlaylistVideos(playlist.uuid, this.playlistPagination)
        .subscribe(({ total, data }) => {
          this.playlistElements = this.playlistElements.concat(data)
          this.playlistPagination.totalItems = total

          const firstAvailableVideos = this.playlistElements.find(e => !!e.video)
          if (!firstAvailableVideos) {
            this.noPlaylistVideos = true
            return
          }

          this.updatePlaylistIndex(this.video)

          if (redirectToFirst) {
            const extras = {
              queryParams: {
                start: firstAvailableVideos.startTimestamp,
                stop: firstAvailableVideos.stopTimestamp,
                videoId: firstAvailableVideos.video.uuid
              },
              replaceUrl: true
            }
            this.router.navigate([], extras)
          }
        })
  }

  updatePlaylistIndex (video: VideoDetails) {
    if (this.playlistElements.length === 0 || !video) return

    for (const playlistElement of this.playlistElements) {
      if (playlistElement.video && playlistElement.video.id === video.id) {
        this.currentPlaylistPosition = playlistElement.position
        return
      }
    }

    // Load more videos to find our video
    this.onPlaylistVideosNearOfBottom()
  }

  navigateToNextPlaylistVideo () {
    if (this.currentPlaylistPosition < this.playlistPagination.totalItems) {
      const next = this.playlistElements.find(e => e.position === this.currentPlaylistPosition + 1)

      if (!next || !next.video) {
        this.currentPlaylistPosition++
        this.navigateToNextPlaylistVideo()
        return
      }

      const start = next.startTimestamp
      const stop = next.stopTimestamp
      this.router.navigate([],{ queryParams: { videoId: next.video.uuid, start, stop } })
    }
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

  private setAutoPlayNextVideoPlaylistSwitchText () {
    this.autoPlayNextVideoPlaylistSwitchText = this.i18n('{{verb}} autoplay for playlists', {
      verb: this.autoPlayNextVideoPlaylist ? this.i18n('Disable') : this.i18n('Enable')
    })
  }
}
