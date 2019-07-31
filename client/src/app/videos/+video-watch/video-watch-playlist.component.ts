import { Component, Input } from '@angular/core'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { VideoDetails, VideoPlaylistPrivacy } from '@shared/models'
import { Router } from '@angular/router'
import { AuthService } from '@app/core'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { VideoPlaylistElement } from '@app/shared/video-playlist/video-playlist-element.model'

@Component({
  selector: 'my-video-watch-playlist',
  templateUrl: './video-watch-playlist.component.html',
  styleUrls: [ './video-watch-playlist.component.scss' ]
})
export class VideoWatchPlaylistComponent {
  @Input() video: VideoDetails
  @Input() playlist: VideoPlaylist

  playlistElements: VideoPlaylistElement[] = []
  playlistPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 30,
    totalItems: null
  }

  noPlaylistVideos = false
  currentPlaylistPosition = 1

  constructor (
    private auth: AuthService,
    private videoPlaylist: VideoPlaylistService,
    private router: Router
  ) {}

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
              queryParams: { videoId: firstAvailableVideos.video.uuid },
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
}
