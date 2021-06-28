import { LinkType } from 'src/types/link.type'
import { Component, Input, OnInit } from '@angular/core'
import { VideoPlaylist } from './video-playlist.model'

@Component({
  selector: 'my-video-playlist-miniature',
  styleUrls: [ './video-playlist-miniature.component.scss' ],
  templateUrl: './video-playlist-miniature.component.html'
})
export class VideoPlaylistMiniatureComponent implements OnInit {
  @Input() playlist: VideoPlaylist

  @Input() toManage = false

  @Input() displayChannel = false
  @Input() displayDescription = false
  @Input() displayPrivacy = false
  @Input() displayAsRow = false

  @Input() linkType: LinkType = 'internal'

  routerLink: any
  playlistHref: string
  playlistTarget: string

  ngOnInit () {
    this.buildPlaylistUrl()
  }

  buildPlaylistUrl () {
    if (this.toManage) {
      this.routerLink = [ '/my-library/video-playlists', this.playlist.uuid ]
      return
    }

    if (this.playlist.videosLength === 0) {
      this.routerLink = null
      return
    }

    if (this.linkType === 'internal' || !this.playlist.url) {
      this.routerLink = VideoPlaylist.buildWatchUrl(this.playlist)
      return
    }

    if (this.linkType === 'external') {
      this.routerLink = null
      this.playlistHref = this.playlist.url
      this.playlistTarget = '_blank'
      return
    }

    // Lazy load
    this.routerLink = [ '/search/lazy-load-playlist', { url: this.playlist.url } ]

    return
  }
}
