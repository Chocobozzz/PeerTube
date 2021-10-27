import { buildVideoOrPlaylistEmbed } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { Component, Input, OnInit } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { buildVideoEmbedLink, decorateVideoLink } from '@shared/core-utils'
import { Video } from '@shared/models'

@Component({
  selector: 'my-embed',
  styleUrls: [ './embed.component.scss' ],
  templateUrl: './embed.component.html'
})
export class EmbedComponent implements OnInit {
  @Input() video: Pick<Video, 'name' | 'uuid'>

  embedHTML: SafeHtml

  constructor (private sanitizer: DomSanitizer) {

  }

  ngOnInit () {
    const html = buildVideoOrPlaylistEmbed(
      decorateVideoLink({
        url: buildVideoEmbedLink(this.video, environment.originServerUrl),

        title: false,
        warningTitle: false
      }),
      this.video.name
    )

    this.embedHTML = this.sanitizer.bypassSecurityTrustHtml(html)
  }
}
