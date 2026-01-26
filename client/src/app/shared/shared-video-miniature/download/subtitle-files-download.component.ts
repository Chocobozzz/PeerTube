
import { Component, OnInit, input, output } from '@angular/core'
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { InputTextComponent } from '../../shared-forms/input-text.component'

@Component({
  selector: 'my-subtitle-files-download',
  templateUrl: './subtitle-files-download.component.html',
  imports: [
    InputTextComponent,
    NgbNavModule
]
})
export class SubtitleFilesDownloadComponent implements OnInit {
  readonly videoCaptions = input.required<VideoCaption[]>()

  readonly downloaded = output()

  activeNavId: string

  getCaptions () {
    const videoCaptions = this.videoCaptions()
    if (!videoCaptions) return []

    return videoCaptions
  }

  ngOnInit () {
    if (this.hasCaptions()) {
      this.activeNavId = this.videoCaptions()[0].language.id
    }
  }

  download () {
    window.location.assign(this.getCaptionLink())

    this.downloaded.emit()
  }

  hasCaptions () {
    return this.getCaptions().length !== 0
  }

  getCaption () {
    const caption = this.getCaptions()
      .find(c => c.language.id === this.activeNavId)

    if (!caption) {
      logger.error(`Cannot find caption ${this.activeNavId}`)
      return undefined
    }

    return caption
  }

  getCaptionLink () {
    const caption = this.getCaption()
    if (!caption) return ''

    return caption.fileUrl
  }
}
