import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ]
})
export class VideoDownloadComponent implements OnInit {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ElementRef

  downloadType: 'direct' | 'torrent' | 'magnet' = 'torrent'
  resolutionId: number | string = -1

  constructor (private modalService: NgbModal) {
    // empty
  }

  ngOnInit () {
    this.resolutionId = this.video.files[0].resolution.id
  }

  show () {
    this.modalService.open(this.modal)
  }

  download () {
    // HTML select send us a string, so convert it to a number
    this.resolutionId = parseInt(this.resolutionId.toString(), 10)

    const file = this.video.files.find(f => f.resolution.id === this.resolutionId)
    if (!file) {
      console.error('Could not find file with resolution %d.', this.resolutionId)
      return
    }

    const link = (() => {
      switch (this.downloadType) {
        case 'direct': {
          return file.fileDownloadUrl
        }
        case 'torrent': {
          return file.torrentDownloadUrl
        }
        case 'magnet': {
          return file.magnetUri
        }
      }
    })()
    window.location.assign(link)
  }
}
