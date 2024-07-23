import { NgFor, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { InputTextComponent } from '../../shared-forms/input-text.component'

@Component({
  selector: 'my-subtitle-files-download',
  templateUrl: './subtitle-files-download.component.html',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    InputTextComponent,
    NgbNav,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    NgbNavOutlet
  ]
})
export class SubtitleFilesDownloadComponent implements OnInit {
  @Input({ required: true }) videoCaptions: VideoCaption[]

  @Output() downloaded = new EventEmitter<void>()

  activeNavId: string

  getCaptions () {
    if (!this.videoCaptions) return []

    return this.videoCaptions
  }

  ngOnInit () {
    if (this.hasCaptions()) {
      this.activeNavId = this.videoCaptions[0].language.id
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

    return window.location.origin + caption.captionPath
  }
}
