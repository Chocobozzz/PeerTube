import { environment } from 'src/environments/environment'
import { Component, ElementRef, Input, OnInit } from '@angular/core'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { buildPlaylistEmbedLink, buildVideoEmbedLink } from '@peertube/peertube-core-utils'
import { CustomMarkupComponent } from './shared'

@Component({
  selector: 'my-embed-markup',
  template: '',
  standalone: true
})
export class EmbedMarkupComponent implements CustomMarkupComponent, OnInit {
  @Input() uuid: string
  @Input() type: 'video' | 'playlist' = 'video'

  loaded: undefined

  constructor (private el: ElementRef) { }

  ngOnInit () {
    const link = this.type === 'video'
      ? buildVideoEmbedLink({ uuid: this.uuid }, environment.originServerUrl)
      : buildPlaylistEmbedLink({ uuid: this.uuid }, environment.originServerUrl)

    this.el.nativeElement.innerHTML = buildVideoOrPlaylistEmbed({ embedUrl: link, embedTitle: this.uuid })
  }
}
