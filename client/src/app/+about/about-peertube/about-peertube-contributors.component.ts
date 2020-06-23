import { Component, OnInit } from '@angular/core'
import { MarkdownService } from '@app/core'

@Component({
  selector: 'my-about-peertube-contributors',
  templateUrl: './about-peertube-contributors.component.html',
  styleUrls: [ './about-peertube-contributors.component.scss' ]
})
export class AboutPeertubeContributorsComponent implements OnInit {
  creditsHtml: string

  private markdown = require('raw-loader!../../../../../CREDITS.md')

  constructor (private markdownService: MarkdownService) { }

  async ngOnInit () {
    this.creditsHtml = await this.markdownService.completeMarkdownToHTML(this.markdown)
  }
}
