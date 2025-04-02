import { NgFor, NgIf } from '@angular/common'
import { Component, ElementRef, inject, input, model, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { HooksService, ServerService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import {
  NgbCollapse,
  NgbModal,
  NgbNav,
  NgbNavContent,
  NgbNavItem,
  NgbNavLink,
  NgbNavLinkBase,
  NgbNavOutlet
} from '@ng-bootstrap/ng-bootstrap'
import { buildPlaylistLink, buildVideoLink, decoratePlaylistLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { VideoCaption, VideoPlaylistPrivacy, VideoPrivacy } from '@peertube/peertube-models'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { QRCodeComponent } from 'angularx-qrcode'
import { InputTextComponent } from '../shared-forms/input-text.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { TimestampInputComponent } from '../shared-forms/timestamp-input.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { AlertComponent } from '../shared-main/common/alert.component'
import { PluginPlaceholderComponent } from '../shared-main/plugins/plugin-placeholder.component'
import { VideoPlaylist } from '../shared-video-playlist/video-playlist.model'

type Customizations = {
  startAtCheckbox: boolean
  startAt: number

  stopAtCheckbox: boolean
  stopAt: number

  subtitleCheckbox: boolean
  subtitle: string

  loop: boolean
  originUrl: boolean
  autoplay: boolean
  muted: boolean

  embedP2P: boolean
  onlyEmbedUrl: boolean
  title: boolean
  warningTitle: boolean
  controlBar: boolean
  peertubeLink: boolean
  responsive: boolean

  includeVideoInPlaylist: boolean
}

type TabId = 'url' | 'qrcode' | 'embed'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  styleUrls: [ './video-share.component.scss' ],
  imports: [
    GlobalIconComponent,
    NgIf,
    RouterLink,
    NgbNav,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    InputTextComponent,
    QRCodeComponent,
    NgbNavOutlet,
    PeertubeCheckboxComponent,
    FormsModule,
    PluginPlaceholderComponent,
    TimestampInputComponent,
    NgFor,
    NgbCollapse,
    AlertComponent
  ]
})
export class VideoShareComponent {
  private modalService = inject(NgbModal)
  private sanitizer = inject(DomSanitizer)
  private server = inject(ServerService)
  private hooks = inject(HooksService)

  readonly modal = viewChild<ElementRef>('modal')

  readonly video = input<VideoDetails>(null)
  readonly videoCaptions = input<VideoCaption[]>([])
  readonly playlist = input<VideoPlaylist>(null)
  readonly playlistPosition = model<number>(null)

  activeVideoId: TabId = 'url'
  activePlaylistId: TabId = 'url'

  customizations: Customizations
  isAdvancedCustomizationCollapsed = true

  videoUrl: string
  playlistUrl: string

  videoEmbedUrl: string
  playlistEmbedUrl: string

  videoEmbedHTML: string
  videoEmbedSafeHTML: SafeHtml
  playlistEmbedHTML: string
  playlistEmbedSafeHTML: SafeHtml

  show (currentVideoTimestamp?: number, currentPlaylistPosition?: number) {
    let subtitle: string
    const videoCaptions = this.videoCaptions()
    if (videoCaptions && videoCaptions.length !== 0) {
      subtitle = videoCaptions[0].language.id
    }

    this.customizations = new Proxy({
      startAtCheckbox: false,
      startAt: currentVideoTimestamp ? Math.floor(currentVideoTimestamp) : 0,

      stopAtCheckbox: false,
      stopAt: this.video()?.duration,

      subtitleCheckbox: false,
      subtitle,

      loop: false,
      originUrl: false,
      autoplay: false,
      muted: false,

      // Embed options
      embedP2P: this.server.getHTMLConfig().defaults.p2p.embed.enabled,
      onlyEmbedUrl: false,
      title: true,
      warningTitle: true,
      controlBar: true,
      peertubeLink: true,
      responsive: false,

      includeVideoInPlaylist: false
    }, {
      set: (target, prop, value) => {
        ;(target as any)[prop] = value

        if (prop === 'embedP2P') {
          // Auto enabled warning title if P2P is enabled
          this.customizations.warningTitle = value
        }

        this.onUpdate()

        return true
      }
    })

    this.playlistPosition.set(currentPlaylistPosition)

    this.onUpdate()

    this.modalService.open(this.modal(), { centered: true }).shown.subscribe(() => {
      this.hooks.runAction('action:modal.share.shown', 'video-watch', { video: this.video(), playlist: this.playlist() })
    })
  }

  // ---------------------------------------------------------------------------

  getVideoUrl () {
    const url = this.customizations.originUrl
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

  getVideoEmbedUrl () {
    return this.hooks.wrapFun(
      decorateVideoLink,
      { url: this.video().embedUrl, ...this.getVideoOptions(true) },
      'video-watch',
      'filter:share.video-embed-url.build.params',
      'filter:share.video-embed-url.build.result'
    )
  }

  async getVideoEmbedCode (options: { responsive: boolean }) {
    const { responsive } = options
    return this.hooks.wrapFun(
      buildVideoOrPlaylistEmbed,
      { embedUrl: await this.getVideoEmbedUrl(), embedTitle: this.video().name, responsive, aspectRatio: this.video().aspectRatio },
      'video-watch',
      'filter:share.video-embed-code.build.params',
      'filter:share.video-embed-code.build.result'
    )
  }

  // ---------------------------------------------------------------------------

  getPlaylistUrl () {
    const url = buildPlaylistLink(this.playlist())

    return this.hooks.wrapFun(
      decoratePlaylistLink,
      { url, ...this.getPlaylistOptions() },
      'video-watch',
      'filter:share.video-playlist-url.build.params',
      'filter:share.video-playlist-url.build.result'
    )
  }

  getPlaylistEmbedUrl () {
    return this.hooks.wrapFun(
      decoratePlaylistLink,
      { url: this.playlist().embedUrl, ...this.getPlaylistOptions() },
      'video-watch',
      'filter:share.video-playlist-embed-url.build.params',
      'filter:share.video-playlist-embed-url.build.result'
    )
  }

  async getPlaylistEmbedCode (options: { responsive: boolean }) {
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

  // ---------------------------------------------------------------------------

  async onUpdate () {
    if (this.playlist()) {
      this.playlistUrl = await this.getPlaylistUrl()
      this.playlistEmbedUrl = await this.getPlaylistEmbedUrl()
      this.playlistEmbedHTML = await this.getPlaylistEmbedCode({ responsive: this.customizations.responsive })
      this.playlistEmbedSafeHTML = this.sanitizer.bypassSecurityTrustHtml(await this.getPlaylistEmbedCode({ responsive: false }))
    }

    if (this.video()) {
      this.videoUrl = await this.getVideoUrl()
      this.videoEmbedUrl = await this.getVideoEmbedUrl()
      this.videoEmbedHTML = await this.getVideoEmbedCode({ responsive: this.customizations.responsive })
      this.videoEmbedSafeHTML = this.sanitizer.bypassSecurityTrustHtml(await this.getVideoEmbedCode({ responsive: false }))
    }
  }

  notSecure () {
    return window.location.protocol === 'http:'
  }

  isInVideoEmbedTab () {
    return this.activeVideoId === 'embed'
  }

  isInPlaylistEmbedTab () {
    return this.activePlaylistId === 'embed'
  }

  isLocalVideo () {
    return this.video().isLocal
  }

  isPrivateVideo () {
    return this.video().privacy.id === VideoPrivacy.PRIVATE
  }

  isPrivatePlaylist () {
    return this.playlist().privacy.id === VideoPlaylistPrivacy.PRIVATE
  }

  isPasswordProtectedVideo () {
    return this.video().privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }

  private getPlaylistOptions (baseUrl?: string) {
    const playlistPosition = this.playlistPosition()
    return {
      baseUrl,

      playlistPosition: playlistPosition && this.customizations.includeVideoInPlaylist
        ? playlistPosition
        : undefined
    }
  }

  private getVideoOptions (forEmbed: boolean) {
    const embedOptions = forEmbed
      ? {
        title: this.customizations.title,
        warningTitle: this.customizations.warningTitle,
        controlBar: this.customizations.controlBar,
        peertubeLink: this.customizations.peertubeLink,

        // If using default value, we don't need to specify it
        p2p: this.customizations.embedP2P === this.server.getHTMLConfig().defaults.p2p.embed.enabled
          ? undefined
          : this.customizations.embedP2P
      }
      : {}

    return {
      startTime: this.customizations.startAtCheckbox ? this.customizations.startAt : undefined,
      stopTime: this.customizations.stopAtCheckbox ? this.customizations.stopAt : undefined,

      subtitle: this.customizations.subtitleCheckbox ? this.customizations.subtitle : undefined,

      loop: this.customizations.loop,
      autoplay: this.customizations.autoplay,
      muted: this.customizations.muted,

      ...embedOptions
    }
  }
}
