
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'

@Component({
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.scss' ]
})

export class HomeComponent implements OnInit {
  @ViewChild('contentWrapper') contentWrapper: ElementRef<HTMLInputElement>

  constructor (
    private customMarkupService: CustomMarkupService
  ) { }

  async ngOnInit () {
    const text = `
    <div>
      <strong>hello</strong> *hihi*

      <peertube-button></peertube-button>

      <peertube-video-embed data-uuid="164f423c-ebed-4f84-9162-af5f311705da"></peertube-video-embed>
      <peertube-playlist-embed data-uuid="4b83a1cc-8e3b-4926-b1aa-8ed747557bc9"></peertube-playlist-embed>

      <h2>bonjour</h2>

      <div style="display: flex; justify-content: space-between;">
        <peertube-video-miniature data-uuid="164f423c-ebed-4f84-9162-af5f311705da"></peertube-video-miniature>
        <peertube-playlist-miniature data-uuid="4b83a1cc-8e3b-4926-b1aa-8ed747557bc9"></peertube-playlist-miniature>
      </div>

      <strong>
        <peertube-date></peertube-date> :joy:
      </strong>
    </div>
    `

    const element = await this.customMarkupService.buildElement(text)
    this.contentWrapper.nativeElement.appendChild(element)
  }
}
