import { Component, ElementRef, OnInit, inject, input } from '@angular/core'
import {
  buildPlaylistEmbedLink,
  buildVideoEmbedLink,
  decoratePlaylistLink,
  decorateVideoLink,
  timeToInt
} from '@peertube/peertube-core-utils'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { environment } from 'src/environments/environment'
import { CustomMarkupComponent } from './shared'

@Component({
  selector: 'my-embed-markup',
  template: '',
  standalone: true
})
export class EmbedMarkupComponent implements CustomMarkupComponent, OnInit {
  private el = inject(ElementRef)

  readonly uuid = input<string>(undefined)
  readonly type = input<'video' | 'playlist'>('video')
  readonly responsive = input<boolean>(undefined)
  readonly startAt = input<string>(undefined)
  readonly stopAt = input<string>(undefined)
  readonly subtitle = input<string>(undefined)
  readonly autoplay = input<boolean>(undefined)
  readonly muted = input<boolean>(undefined)
  readonly loop = input<boolean>(undefined)
  readonly title = input<boolean>(undefined)
  readonly p2p = input<boolean>(undefined)
  readonly warningTitle = input<boolean>(undefined)
  readonly controlBar = input<boolean>(undefined)
  readonly peertubeLink = input<boolean>(undefined)
  readonly playlistPosition = input<number>(undefined)

  loaded: undefined

  ngOnInit () {
    this.el.nativeElement.innerHTML = buildVideoOrPlaylistEmbed({
      embedUrl: this.buildLink(),
      embedTitle: this.uuid(),
      responsive: this.responsive() ?? false
    })
  }

  private buildLink () {
    if (this.type() === 'playlist') {
      return decoratePlaylistLink({
        url: buildPlaylistEmbedLink({ uuid: this.uuid() }, environment.originServerUrl),
        playlistPosition: this.playlistPosition()
      })
    }

    const startTime = this.startAt()
      ? timeToInt(this.startAt())
      : undefined

    const stopTime = this.stopAt()
      ? timeToInt(this.stopAt())
      : undefined

    return decorateVideoLink({
      url: buildVideoEmbedLink({ uuid: this.uuid() }, environment.originServerUrl),
      startTime,
      stopTime,
      subtitle: this.subtitle(),
      loop: this.loop(),
      autoplay: this.autoplay(),
      muted: this.muted(),
      title: this.title(),
      warningTitle: this.warningTitle(),
      controlBar: this.controlBar(),
      peertubeLink: this.peertubeLink(),
      p2p: this.p2p()
    })
  }
}
