import { environment } from 'src/environments/environment'
import { Component, ElementRef, OnInit, inject, input } from '@angular/core'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { buildPlaylistEmbedLink, buildVideoEmbedLink } from '@peertube/peertube-core-utils'
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

  loaded: undefined

  ngOnInit () {
    const link = this.type() === 'video'
      ? buildVideoEmbedLink({ uuid: this.uuid() }, environment.originServerUrl)
      : buildPlaylistEmbedLink({ uuid: this.uuid() }, environment.originServerUrl)

    this.el.nativeElement.innerHTML = buildVideoOrPlaylistEmbed({ 
      embedUrl: link, 
      embedTitle: this.uuid(),
      responsive: this.responsive() ?? false
    })
  }
}
