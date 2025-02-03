import { LinkType } from 'src/types/link.type'
import { Component, Input, OnInit } from '@angular/core'
import { VideoPlaylist } from './video-playlist.model'
import { MarkdownService } from '@app/core'
import { FromNowPipe } from '../shared-main/date/from-now.pipe'
import { RouterLink } from '@angular/router'
import { LinkComponent } from '../shared-main/common/link.component'
import { NgClass, NgIf } from '@angular/common'

@Component({
  selector: 'my-video-playlist-miniature',
  styleUrls: [ './video-playlist-miniature.component.scss' ],
  templateUrl: './video-playlist-miniature.component.html',
  imports: [ NgClass, LinkComponent, NgIf, RouterLink, FromNowPipe ]
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
  playlistDescription: string

  constructor (
    private markdownService: MarkdownService
  ) {}

  async ngOnInit () {
    this.buildPlaylistUrl()
    if (this.displayDescription) {
      this.playlistDescription = await this.markdownService.textMarkdownToHTML({ markdown: this.playlist.description })
    }
  }

  buildPlaylistUrl () {
    if (this.toManage) {
      this.routerLink = [ '/my-library/video-playlists', this.playlist.shortUUID ]
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
