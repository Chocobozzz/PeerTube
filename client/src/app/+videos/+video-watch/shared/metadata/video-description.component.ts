import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core'
import { MarkdownService, Notifier } from '@app/core'
import { VideoDetails, VideoService } from '@app/shared/shared-main'
import { logger } from '@root-helpers/logger'

@Component({
  selector: 'my-video-description',
  templateUrl: './video-description.component.html',
  styleUrls: [ './video-description.component.scss' ]
})
export class VideoDescriptionComponent implements OnChanges {
  @Input() video: VideoDetails

  @Output() timestampClicked = new EventEmitter<number>()

  descriptionLoading = false
  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''

  constructor (
    private videoService: VideoService,
    private notifier: Notifier,
    private markdownService: MarkdownService
  ) { }

  ngOnChanges () {
    this.descriptionLoading = false
    this.completeDescriptionShown = false
    this.completeVideoDescription = undefined

    this.setVideoDescriptionHTML()
  }

  showMoreDescription () {
    if (this.completeVideoDescription === undefined) {
      return this.loadCompleteDescription()
    }

    this.updateVideoDescription(this.completeVideoDescription)
    this.completeDescriptionShown = true
  }

  showLessDescription () {
    this.updateVideoDescription(this.shortVideoDescription)
    this.completeDescriptionShown = false
  }

  loadCompleteDescription () {
    this.descriptionLoading = true

    this.videoService.loadCompleteDescription(this.video.descriptionPath)
        .subscribe({
          next: description => {
            this.completeDescriptionShown = true
            this.descriptionLoading = false

            this.shortVideoDescription = this.video.description
            this.completeVideoDescription = description

            this.updateVideoDescription(this.completeVideoDescription)
          },

          error: err => {
            this.descriptionLoading = false
            this.notifier.error(err.message)
          }
        })
  }

  onTimestampClicked (timestamp: number) {
    this.timestampClicked.emit(timestamp)
  }

  private updateVideoDescription (description: string) {
    this.video.description = description
    this.setVideoDescriptionHTML()
      .catch(err => logger.error(err))
  }

  private async setVideoDescriptionHTML () {
    const html = await this.markdownService.textMarkdownToHTML(this.video.description)

    this.videoHTMLDescription = this.markdownService.processVideoTimestamps(this.video.shortUUID, html)
  }
}
