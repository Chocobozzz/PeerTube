import { Component, ElementRef, inject, input, model, viewChild } from '@angular/core'
import { HooksService, ServerService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { VideoPlaylist } from '../shared-video-playlist/video-playlist.model'
import { SharePlaylistComponent } from './share-playlist.component'
import { ShareVideoComponent } from './share-video.component'
import { Customizations } from './video-share.model'

@Component({
  selector: 'my-video-share',
  templateUrl: './video-share.component.html',
  imports: [
    GlobalIconComponent,
    SharePlaylistComponent,
    ShareVideoComponent
  ]
})
export class VideoShareComponent {
  private modalService = inject(NgbModal)
  private server = inject(ServerService)
  private hooks = inject(HooksService)

  readonly modal = viewChild<ElementRef>('modal')
  readonly playlistShare = viewChild(SharePlaylistComponent)
  readonly videoShare = viewChild(ShareVideoComponent)

  readonly video = input<VideoDetails>(null)
  readonly videoCaptions = input<VideoCaption[]>([])
  readonly playlist = input<VideoPlaylist>(null)
  readonly playlistPosition = model<number>(null)

  customizations: Customizations

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
      embedPiP: true,
      onlyEmbedUrl: false,
      title: true,
      warningTitle: true,
      controlBar: true,
      contextMenu: true,
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

  onUpdate () {
    this.playlistShare()?.onUpdate()
    this.videoShare()?.onUpdate()
  }
}
