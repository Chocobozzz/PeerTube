import { buildPlaylistLink, buildVideoLink, buildVideoOrPlaylistEmbed } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { Component, ElementRef, Input, OnInit } from '@angular/core'

@Component({
  selector: 'my-embed-markup',
  template: ''
})
export class EmbedMarkupComponent implements OnInit {
  @Input() uuid: string
  @Input() type: 'video' | 'playlist' = 'video'

  constructor (private el: ElementRef) { }

  ngOnInit () {
    const link = this.type === 'video'
      ? buildVideoLink({ baseUrl: `${environment.originServerUrl}/videos/embed/${this.uuid}` })
      : buildPlaylistLink({ baseUrl: `${environment.originServerUrl}/video-playlists/embed/${this.uuid}` })

    this.el.nativeElement.innerHTML = buildVideoOrPlaylistEmbed(link, this.uuid)
  }
}
