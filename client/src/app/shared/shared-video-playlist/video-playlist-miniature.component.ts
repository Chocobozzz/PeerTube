import { Component, Input } from '@angular/core'
import { VideoPlaylist } from './video-playlist.model'

@Component({
  selector: 'my-video-playlist-miniature',
  styleUrls: [ './video-playlist-miniature.component.scss' ],
  templateUrl: './video-playlist-miniature.component.html'
})
export class VideoPlaylistMiniatureComponent {
  @Input() playlist: VideoPlaylist
  @Input() toManage = false
  @Input() displayChannel = false
  @Input() displayDescription = false
  @Input() displayPrivacy = false

  getPlaylistUrl () {
    if (this.toManage) return [ '/my-account/video-playlists', this.playlist.uuid ]
    if (this.playlist.videosLength === 0) return null

    return [ '/videos/watch/playlist', this.playlist.uuid ]
  }
}
