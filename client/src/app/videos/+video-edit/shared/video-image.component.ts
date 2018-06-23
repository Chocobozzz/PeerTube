import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'
import { ServerService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-image',
  styleUrls: [ './video-image.component.scss' ],
  templateUrl: './video-image.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VideoImageComponent),
      multi: true
    }
  ]
})
export class VideoImageComponent implements ControlValueAccessor {
  @Input() inputLabel: string
  @Input() inputName: string
  @Input() previewWidth: string
  @Input() previewHeight: string

  imageSrc: SafeResourceUrl

  private file: Blob

  constructor (
    private sanitizer: DomSanitizer,
    private serverService: ServerService,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {}

  get videoImageExtensions () {
    return this.serverService.getConfig().video.image.extensions.join(',')
  }

  get maxVideoImageSize () {
    return this.serverService.getConfig().video.image.size.max
  }

  fileChange (event: any) {
    if (event.target.files && event.target.files.length) {
      const [ file ] = event.target.files

      if (file.size > this.maxVideoImageSize) {
        this.notificationsService.error(this.i18n('Error'), this.i18n('This image is too large.'))
        return
      }

      this.file = file
      this.propagateChange(this.file)
      this.updatePreview()
    }
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (file: any) {
    this.file = file
    this.updatePreview()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  private updatePreview () {
    if (this.file) {
      const url = URL.createObjectURL(this.file)
      this.imageSrc = this.sanitizer.bypassSecurityTrustResourceUrl(url)
    }
  }
}
