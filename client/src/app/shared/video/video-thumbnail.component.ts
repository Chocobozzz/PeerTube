import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core'
import { Video } from './video.model'
import { ScreenService } from '@app/shared/misc/screen.service'
import { AuthService, ThemeService } from '@app/core'
import { VideoPlaylistService } from '../video-playlist/video-playlist.service'
import { VideoPlaylistElementCreate } from '../../../../../shared'

@Component({
  selector: 'my-video-thumbnail',
  styleUrls: [ './video-thumbnail.component.scss' ],
  templateUrl: './video-thumbnail.component.html'
})
export class VideoThumbnailComponent {
  @Input() video: Video
  @Input() nsfw = false
  @Input() routerLink: any[]
  @Input() queryParams: any[]

  addToWatchLaterText = 'Add to watch later'
  addedToWatchLaterText = 'Added to watch later'
  addedToWatchLater: boolean

  watchLaterPlaylist: any

  constructor (
    private screenService: ScreenService,
    private authService: AuthService,
    private videoPlaylistService: VideoPlaylistService,
    private cd: ChangeDetectorRef
  ) {}

  load () {
    if (this.addedToWatchLater !== undefined) return
    if (!this.isUserLoggedIn()) return

    this.videoPlaylistService.doesVideoExistInPlaylist(this.video.id)
      .subscribe(
        existResult => {
          for (const playlist of this.authService.getUser().specialPlaylists) {
            const existingPlaylist = existResult[ this.video.id ].find(p => p.playlistId === playlist.id)
            this.addedToWatchLater = !!existingPlaylist

            if (existingPlaylist) {
              this.watchLaterPlaylist = {
                playlistId: existingPlaylist.playlistId,
                playlistElementId: existingPlaylist.playlistElementId
              }
            } else {
              this.watchLaterPlaylist = {
                playlistId: playlist.id
              }
            }

            this.cd.markForCheck()
          }
        }
      )
  }

  getImageUrl () {
    if (!this.video) return ''

    if (this.screenService.isInMobileView()) {
      return this.video.previewUrl
    }

    return this.video.thumbnailUrl
  }

  getProgressPercent () {
    if (!this.video.userHistory) return 0

    const currentTime = this.video.userHistory.currentTime

    return (currentTime / this.video.duration) * 100
  }

  getVideoRouterLink () {
    if (this.routerLink) return this.routerLink

    return [ '/videos/watch', this.video.uuid ]
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  addToWatchLater () {
    if (this.addedToWatchLater === undefined) return
    this.addedToWatchLater = true

    this.videoPlaylistService.addVideoInPlaylist(
      this.watchLaterPlaylist.playlistId,
      { videoId: this.video.id } as VideoPlaylistElementCreate
    ).subscribe(
      res => {
        this.addedToWatchLater = true
        this.watchLaterPlaylist.playlistElementId = res.videoPlaylistElement.id
      }
    )
  }

  removeFromWatchLater () {
    if (this.addedToWatchLater === undefined) return
    this.addedToWatchLater = false

    this.videoPlaylistService.removeVideoFromPlaylist(
      this.watchLaterPlaylist.playlistId,
      this.watchLaterPlaylist.playlistElementId
    ).subscribe(
      _ => {
        this.addedToWatchLater = false
      }
    )
  }
}
