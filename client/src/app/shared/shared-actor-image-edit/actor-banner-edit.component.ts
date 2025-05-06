import { NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, ElementRef, OnInit, inject, input, output, viewChild } from '@angular/core'
import { SafeResourceUrl } from '@angular/platform-browser'
import { Notifier, ServerService } from '@app/core'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle, NgbPopover, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { getBytes } from '@root-helpers/bytes'
import { imageToDataURL } from '@root-helpers/images'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-actor-banner-edit',
  templateUrl: './actor-banner-edit.component.html',
  styleUrls: [
    './actor-image-edit.scss',
    './actor-banner-edit.component.scss'
  ],
  imports: [ NgIf, NgbTooltip, NgTemplateOutlet, NgbDropdown, NgbDropdownToggle, GlobalIconComponent, NgbDropdownMenu ]
})
export class ActorBannerEditComponent implements OnInit {
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)

  readonly bannerfileInput = viewChild<ElementRef<HTMLInputElement>>('bannerfileInput')
  readonly bannerPopover = viewChild<NgbPopover>('bannerPopover')

  readonly bannerUrl = input<string>(undefined)
  readonly previewImage = input(false)

  readonly bannerChange = output<FormData>()
  readonly bannerDelete = output()

  bannerFormat = ''
  maxBannerSize = 0
  bannerExtensions = ''

  preview: SafeResourceUrl

  ngOnInit (): void {
    const config = this.serverService.getHTMLConfig()
    this.maxBannerSize = config.banner.file.size.max
    this.bannerExtensions = config.banner.file.extensions.join(', ')

    this.bannerFormat = $localize`ratio 6/1, recommended size: 1920x317, max size: ${
      getBytes(this.maxBannerSize)
    }, extensions: ${this.bannerExtensions}`
  }

  onBannerChange () {
    const bannerfile = this.bannerfileInput().nativeElement.files[0]
    if (bannerfile.size > this.maxBannerSize) {
      this.notifier.error('Error', $localize`This image is too large.`)
      return
    }

    const formData = new FormData()
    formData.append('bannerfile', bannerfile)
    this.bannerPopover()?.close()
    this.bannerChange.emit(formData)

    if (this.previewImage()) {
      imageToDataURL(bannerfile).then(result => this.preview = result)
    }
  }

  deleteBanner () {
    this.preview = undefined
    this.bannerDelete.emit()
  }

  hasBanner () {
    return !!this.preview || !!this.bannerUrl()
  }
}
