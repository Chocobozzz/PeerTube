import { Component, OnChanges, ElementRef, inject, input, output, viewChild } from '@angular/core'
import { MarkdownService } from '@app/core'
import { NgClass } from '@angular/common'
import { TimestampRouteTransformerDirective } from '../timestamp-route-transformer.directive'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'

@Component({
  selector: 'my-video-description',
  templateUrl: './video-description.component.html',
  styleUrls: [ './video-description.component.scss' ],
  imports: [ TimestampRouteTransformerDirective, NgClass ]
})
export class VideoDescriptionComponent implements OnChanges {
  private markdownService = inject(MarkdownService)

  readonly descriptionHTML = viewChild<ElementRef<HTMLElement>>('descriptionHTML')

  readonly video = input<VideoDetails>(undefined)

  readonly timestampClicked = output<number>()

  completeDescriptionShown = false

  videoHTMLDescription = ''

  ngOnChanges () {
    this.completeDescriptionShown = false

    this.setVideoDescriptionHTML()
  }

  hasEllipsis () {
    const el = this.descriptionHTML()?.nativeElement
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
    const html = await this.markdownService.textMarkdownToHTML({ markdown: this.video().description, withHtml: true, withEmoji: true })

    this.videoHTMLDescription = this.markdownService.processVideoTimestamps(this.video().shortUUID, html)
  }
}
