import { Component, EventEmitter, Input, OnChanges, Output, ViewChild, ElementRef } from '@angular/core'
import { MarkdownService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main'

@Component({
  selector: 'my-video-description',
  templateUrl: './video-description.component.html',
  styleUrls: [ './video-description.component.scss' ]
})
export class VideoDescriptionComponent implements OnChanges {
  @ViewChild('descriptionHTML') descriptionHTML: ElementRef<HTMLElement>

  @Input() video: VideoDetails

  @Output() timestampClicked = new EventEmitter<number>()

  completeDescriptionShown = false

  videoHTMLDescription = ''

  constructor (
    private markdownService: MarkdownService
  ) { }

  ngOnChanges () {
    this.completeDescriptionShown = false

    this.setVideoDescriptionHTML()
  }

  hasEllipsis () {
    const el = this.descriptionHTML?.nativeElement
    if (!el) return false

    return el.offsetHeight < el.scrollHeight
  }

  showMoreDescription () {
    this.completeDescriptionShown = true
  }

  showLessDescription () {
    this.completeDescriptionShown = false
  }

  onTimestampClicked (timestamp: number) {
    this.timestampClicked.emit(timestamp)
  }

  private async setVideoDescriptionHTML () {
    const html = await this.markdownService.textMarkdownToHTML({ markdown: this.video.description })

    this.videoHTMLDescription = this.markdownService.processVideoTimestamps(this.video.shortUUID, html)
  }
}
