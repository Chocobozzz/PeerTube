import { Component, inject, input, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { HooksService, ServerService } from '@app/core'
import { NgbCollapse, NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet } from '@ng-bootstrap/ng-bootstrap'
import { buildVideoLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { VideoCaption, VideoPrivacy } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { QRCodeComponent } from 'angularx-qrcode'
import { InputTextComponent } from '../shared-forms/input-text.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { TimestampInputComponent } from '../shared-forms/timestamp-input.component'
import { AlertComponent } from '../shared-main/common/alert.component'
import { PluginPlaceholderComponent } from '../shared-main/plugins/plugin-placeholder.component'
import { VideoDetails } from '../shared-main/video/video-details.model'
import { VideoPlaylist } from '../shared-video-playlist/video-playlist.model'
import { Customizations, TabId } from './video-share.model'

@Component({
  selector: 'my-share-video',
  templateUrl: './share-video.component.html',
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
    TimestampInputComponent,
    NgbCollapse,
    AlertComponent
  ]
})
export class ShareVideoComponent implements OnInit {
  private sanitizer = inject(DomSanitizer)
  private server = inject(ServerService)
  private hooks = inject(HooksService)

  readonly video = input<VideoDetails>(null)
  readonly videoCaptions = input<VideoCaption[]>([])
  readonly playlist = input<VideoPlaylist>(null)
  readonly customizations = input<Customizations>(null)

  activeVideoId: TabId = 'url'
  isAdvancedCustomizationCollapsed = true

  videoUrl: string
  videoEmbedUrl: string
  videoEmbedHTML: string
  videoEmbedSafeHTML: SafeHtml

  ngOnInit () {
    this.onUpdate()
  }

  async onUpdate () {
    const video = this.video()
    const customizations = this.customizations()

    if (!video || !customizations) return

    this.videoUrl = await this.getVideoUrl()
    this.videoEmbedUrl = await this.getVideoEmbedUrl()
    this.videoEmbedHTML = await this.getVideoEmbedCode({ responsive: customizations.responsive })
    this.videoEmbedSafeHTML = this.sanitizer.bypassSecurityTrustHtml(await this.getVideoEmbedCode({ responsive: false }))
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  isInEmbedTab () {
    return this.activeVideoId === 'embed'
  }

  isLocalVideo () {
    return this.video().isLocal
  }

  isPrivateVideo () {
    return this.video().privacy.id === VideoPrivacy.PRIVATE
  }

  isPasswordProtectedVideo () {
    return this.video().privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }

  private getVideoUrl () {
    const customizations = this.customizations()
    const url = customizations?.originUrl
      ? this.video().url
      : buildVideoLink(this.video(), window.location.origin)

    return this.hooks.wrapFun(
      decorateVideoLink,
      { url, ...this.getVideoOptions(false) },
      'video-watch',
      'filter:share.video-url.build.params',
      'filter:share.video-url.build.result'
    )
  }

  private getVideoEmbedUrl () {
    return this.hooks.wrapFun(
      decorateVideoLink,
      { url: this.video().embedUrl, ...this.getVideoOptions(true) },
      'video-watch',
      'filter:share.video-embed-url.build.params',
      'filter:share.video-embed-url.build.result'
    )
  }

  private async getVideoEmbedCode (options: { responsive: boolean }) {
    const { responsive } = options

    return this.hooks.wrapFun(
      buildVideoOrPlaylistEmbed,
      {
        embedUrl: await this.getVideoEmbedUrl(),
        embedTitle: this.video().name,
        responsive,
        aspectRatio: this.video().aspectRatio
      },
      'video-watch',
      'filter:share.video-embed-code.build.params',
      'filter:share.video-embed-code.build.result'
    )
  }

  private getVideoOptions (forEmbed: boolean) {
    const customizations = this.customizations()

    if (!customizations) return {}

    const embedOptions = forEmbed
      ? {
        title: customizations.title,
        warningTitle: customizations.warningTitle,
        controlBar: customizations.controlBar,
        peertubeLink: customizations.peertubeLink,

        pip: customizations.embedPiP ? undefined : false,
        contextMenu: customizations.contextMenu ? undefined : false,

        p2p: customizations.embedP2P === this.server.getHTMLConfig().defaults.p2p.embed.enabled
          ? undefined
          : customizations.embedP2P
      }
      : {}

    return {
      startTime: customizations.startAtCheckbox ? customizations.startAt : undefined,
      stopTime: customizations.stopAtCheckbox ? customizations.stopAt : undefined,

      subtitle: customizations.subtitleCheckbox ? customizations.subtitle : undefined,

      loop: customizations.loop,
      autoplay: customizations.autoplay,
      muted: customizations.muted,

      ...embedOptions
    }
  }
}
