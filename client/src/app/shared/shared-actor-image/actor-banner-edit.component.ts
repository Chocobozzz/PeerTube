import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { getBytes } from '@root-helpers/bytes'

@Component({
  selector: 'my-actor-banner-edit',
  templateUrl: './actor-banner-edit.component.html',
  styleUrls: [
    './actor-image-edit.scss',
    './actor-banner-edit.component.scss'
  ]
})
export class ActorBannerEditComponent implements OnInit {
  @ViewChild('bannerfileInput') bannerfileInput: ElementRef<HTMLInputElement>
  @ViewChild('bannerPopover') bannerPopover: NgbPopover

  @Input() actor: VideoChannel

  @Output() bannerChange = new EventEmitter<FormData>()
  @Output() bannerDelete = new EventEmitter<void>()

  bannerFormat = ''
  maxBannerSize = 0
  bannerExtensions = ''

  constructor (
    private serverService: ServerService,
    private notifier: Notifier
  ) { }

  ngOnInit (): void {
    this.serverService.getConfig()
        .subscribe(config => {
          this.maxBannerSize = config.banner.file.size.max
          this.bannerExtensions = config.banner.file.extensions.join(', ')

          this.bannerFormat = $localize`maxsize: ${getBytes(this.maxBannerSize)}, extensions: ${this.bannerExtensions}`
        })
  }

  onBannerChange (input: HTMLInputElement) {
    this.bannerfileInput = new ElementRef(input)

    const bannerfile = this.bannerfileInput.nativeElement.files[ 0 ]
    if (bannerfile.size > this.maxBannerSize) {
      this.notifier.error('Error', $localize`This image is too large.`)
      return
    }

    const formData = new FormData()
    formData.append('bannerfile', bannerfile)
    this.bannerPopover?.close()
    this.bannerChange.emit(formData)
  }

  deleteBanner () {
    this.bannerDelete.emit()
  }

  hasBanner () {
    return !!this.actor.bannerUrl
  }
}
