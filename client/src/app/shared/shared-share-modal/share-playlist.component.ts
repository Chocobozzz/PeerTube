import { Component, inject, input, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { HooksService } from '@app/core'
import { NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet } from '@ng-bootstrap/ng-bootstrap'
import { buildPlaylistLink, decoratePlaylistLink } from '@peertube/peertube-core-utils'
import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { QRCodeComponent } from 'angularx-qrcode'
import { InputTextComponent } from '../shared-forms/input-text.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { AlertComponent } from '../shared-main/common/alert.component'
import { PluginPlaceholderComponent } from '../shared-main/plugins/plugin-placeholder.component'
import { VideoDetails } from '../shared-main/video/video-details.model'
import { VideoPlaylist } from '../shared-video-playlist/video-playlist.model'
import { Customizations, TabId } from './video-share.model'

@Component({
  selector: 'my-share-playlist',
  templateUrl: './share-playlist.component.html',
  styleUrls: [ './share-common.component.scss' ],
  imports: [
    RouterLink,
    NgbNav,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    NgbNavOutlet,
    InputTextComponent,
    QRCodeComponent,
    PeertubeCheckboxComponent,
    FormsModule,
    PluginPlaceholderComponent,
    AlertComponent
  ]
})
export class SharePlaylistComponent implements OnInit {
  private sanitizer = inject(DomSanitizer)
  private hooks = inject(HooksService)

  readonly playlist = input<VideoPlaylist>()
  readonly playlistPosition = input<number>()
  readonly video = input<VideoDetails>()
  readonly customizations = input<Customizations>()

  activePlaylistId: TabId = 'url'

  playlistUrl: string
  playlistEmbedUrl: string
  playlistEmbedHTML: string
  playlistEmbedSafeHTML: SafeHtml

  ngOnInit () {
    this.onUpdate()
  }

  async onUpdate () {
    const playlist = this.playlist()
    const customizations = this.customizations()

    if (!playlist || !customizations) return

    this.playlistUrl = await this.getPlaylistUrl()
    this.playlistEmbedUrl = await this.getPlaylistEmbedUrl()
    this.playlistEmbedHTML = await this.getPlaylistEmbedCode({ responsive: customizations.responsive })
    this.playlistEmbedSafeHTML = this.sanitizer.bypassSecurityTrustHtml(await this.getPlaylistEmbedCode({ responsive: false }))
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  isInEmbedTab () {
    return this.activePlaylistId === 'embed'
  }

  isPrivatePlaylist () {
    return this.playlist().privacy.id === VideoPlaylistPrivacy.PRIVATE
  }

  private getPlaylistUrl () {
    const url = buildPlaylistLink(this.playlist())

    return this.hooks.wrapFun(
      decoratePlaylistLink,
      { url, ...this.getPlaylistOptions() },
      'video-watch',
      'filter:share.video-playlist-url.build.params',
      'filter:share.video-playlist-url.build.result'
    )
  }

  private getPlaylistEmbedUrl () {
    return this.hooks.wrapFun(
      decoratePlaylistLink,
      { url: this.playlist().embedUrl, ...this.getPlaylistOptions() },
      'video-watch',
      'filter:share.video-playlist-embed-url.build.params',
      'filter:share.video-playlist-embed-url.build.result'
    )
  }

  private async getPlaylistEmbedCode (options: { responsive: boolean }) {
    const { responsive } = options

    return this.hooks.wrapFun(
      buildVideoOrPlaylistEmbed,
      {
        embedUrl: await this.getPlaylistEmbedUrl(),
        embedTitle: this.playlist().displayName,
        responsive,
        aspectRatio: this.video()?.aspectRatio
      },
      'video-watch',
      'filter:share.video-playlist-embed-code.build.params',
      'filter:share.video-playlist-embed-code.build.result'
    )
  }

  private getPlaylistOptions (baseUrl?: string) {
    const customizations = this.customizations()

    if (!customizations) return { baseUrl }

    const playlistPosition = this.playlistPosition()

    return {
      baseUrl,
      playlistPosition: playlistPosition && customizations.includeVideoInPlaylist
        ? playlistPosition
        : undefined
    }
  }
}
