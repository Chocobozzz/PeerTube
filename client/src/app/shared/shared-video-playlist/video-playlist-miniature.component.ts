import { LinkType } from 'src/types/link.type'
import { Component, OnInit, inject, input } from '@angular/core'
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
  private markdownService = inject(MarkdownService)

  readonly playlist = input<VideoPlaylist>(undefined)

  readonly toManage = input(false)

  readonly displayChannel = input(false)
  readonly displayDescription = input(false)
  readonly displayPrivacy = input(false)
  readonly displayAsRow = input(false)

  readonly linkType = input<LinkType>('internal')

  ownerRouterLink: any
  ownerHref: string
  ownerTarget: string

  playlistRouterLink: any
  playlistHref: string
  playlistTarget: string

  playlistDescription: string

  async ngOnInit () {
    this.buildPlaylistUrl()
    this.buildOwnerUrl()

    if (this.displayDescription()) {
      this.playlistDescription = await this.markdownService.textMarkdownToHTML({ markdown: this.playlist().description })
    }
  }

  buildPlaylistUrl () {
    if (this.toManage()) {
      this.playlistRouterLink = [ '/my-library/video-playlists', this.playlist().shortUUID ]
      return
    }

    const playlist = this.playlist()
    if (playlist.videosLength === 0) {
      this.playlistRouterLink = null
      return
    }

    const linkType = this.linkType()
    if (linkType === 'internal' || !playlist.url) {
      this.playlistRouterLink = VideoPlaylist.buildWatchUrl(playlist)
      return
    }

    if (linkType === 'external') {
      this.playlistRouterLink = null
      this.playlistHref = playlist.url
      this.playlistTarget = '_blank'
      return
    }

    // Lazy load
    this.playlistRouterLink = [ '/search/lazy-load-playlist', { url: playlist.url } ]
  }

  buildOwnerUrl () {
    const playlist = this.playlist()
    const linkType = this.linkType()

    if (!playlist.videoChannel) return

    if (linkType === 'internal' || !playlist.videoChannel.url) {
      this.ownerRouterLink = `/c/${playlist.videoChannelBy}`
      return
    }

    if (linkType === 'external') {
      this.ownerRouterLink = null
      this.ownerHref = playlist.videoChannel.url
      this.ownerTarget = '_blank'
      return
    }

    // Lazy load
    this.ownerRouterLink = [ '/search/lazy-load-channel', { url: playlist.videoChannel.url } ]
    return
  }
}
