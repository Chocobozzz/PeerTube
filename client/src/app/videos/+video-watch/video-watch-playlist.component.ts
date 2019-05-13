import { Component, Input } from '@angular/core'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Video } from '@app/shared/video/video.model'
import { VideoDetails, VideoPlaylistPrivacy } from '@shared/models'
import { VideoService } from '@app/shared/video/video.service'
import { Router } from '@angular/router'
import { AuthService } from '@app/core'

@Component({
  selector: 'my-video-watch-playlist',
  templateUrl: './video-watch-playlist.component.html',
  styleUrls: [ './video-watch-playlist.component.scss' ]
})
export class VideoWatchPlaylistComponent {
  @Input() video: VideoDetails
  @Input() playlist: VideoPlaylist

  playlistVideos: Video[] = []
  playlistPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 30,
    totalItems: null
  }

  noPlaylistVideos = false
  currentPlaylistPosition = 1

  constructor (
    private auth: AuthService,
    private videoService: VideoService,
    private router: Router
  ) {}

  onPlaylistVideosNearOfBottom () {
    // Last page
    if (this.playlistPagination.totalItems <= (this.playlistPagination.currentPage * this.playlistPagination.itemsPerPage)) return

    this.playlistPagination.currentPage += 1
    this.loadPlaylistElements(this.playlist,false)
  }

  onElementRemoved (video: Video) {
    this.playlistVideos = this.playlistVideos.filter(v => v.id !== video.id)

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
    this.videoService.getPlaylistVideos(playlist.uuid, this.playlistPagination)
        .subscribe(({ totalVideos, videos }) => {
          this.playlistVideos = this.playlistVideos.concat(videos)
          this.playlistPagination.totalItems = totalVideos

          if (totalVideos === 0) {
            this.noPlaylistVideos = true
            return
          }

          this.updatePlaylistIndex(this.video)

          if (redirectToFirst) {
            const extras = {
              queryParams: { videoId: this.playlistVideos[ 0 ].uuid },
              replaceUrl: true
            }
            this.router.navigate([], extras)
          }
        })
  }

  updatePlaylistIndex (video: VideoDetails) {
    if (this.playlistVideos.length === 0 || !video) return

    for (const playlistVideo of this.playlistVideos) {
      if (playlistVideo.id === video.id) {
        this.currentPlaylistPosition = playlistVideo.playlistElement.position
        return
      }
    }

    // Load more videos to find our video
    this.onPlaylistVideosNearOfBottom()
  }

  navigateToNextPlaylistVideo () {
    if (this.currentPlaylistPosition < this.playlistPagination.totalItems) {
      const next = this.playlistVideos.find(v => v.playlistElement.position === this.currentPlaylistPosition + 1)

      const start = next.playlistElement.startTimestamp
      const stop = next.playlistElement.stopTimestamp
      this.router.navigate([],{ queryParams: { videoId: next.uuid, start, stop } })
    }
  }
}
