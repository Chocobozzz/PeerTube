import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'
import { ServerService } from '@app/core'

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

  private file: File

  constructor (
    private sanitizer: DomSanitizer,
    private serverService: ServerService
  ) {}

  get videoImageExtensions () {
    return this.serverService.getConfig().video.image.extensions
  }

  get maxVideoImageSize () {
    return this.serverService.getConfig().video.image.size.max
  }

  onFileChanged (file: File) {
    this.file = file

    this.propagateChange(this.file)
    this.updatePreview()
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
