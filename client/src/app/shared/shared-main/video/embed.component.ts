import { environment } from 'src/environments/environment'
import { Component, Input, OnInit } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { buildVideoEmbedLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import { Video } from '@peertube/peertube-models'

@Component({
  selector: 'my-embed',
  styleUrls: [ './embed.component.scss' ],
  templateUrl: './embed.component.html',
  standalone: true
})
export class EmbedComponent implements OnInit {
  @Input({ required: true }) video: Pick<Video, 'name' | 'uuid'> & Partial<Pick<Video, 'aspectRatio'>>

  embedHTML: SafeHtml

  constructor (private sanitizer: DomSanitizer) {

  }

  ngOnInit () {
    const html = buildVideoOrPlaylistEmbed({
      embedUrl: decorateVideoLink({
        url: buildVideoEmbedLink(this.video, environment.originServerUrl),

        title: false,
        warningTitle: false
      }),
      embedTitle: this.video.name,
      aspectRatio: this.video.aspectRatio
    })

    this.embedHTML = this.sanitizer.bypassSecurityTrustHtml(html)
  }
}
