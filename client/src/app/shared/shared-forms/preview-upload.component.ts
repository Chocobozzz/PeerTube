import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, forwardRef, inject, input, OnInit } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { imageToDataURL } from '@root-helpers/images'
import { BytesPipe } from '../shared-main/common/bytes.pipe'
import { ReactiveFileComponent } from './reactive-file.component'
import { DeleteButtonComponent } from '../shared-main/buttons/delete-button.component'

@Component({
  selector: 'my-preview-upload',
  styleUrls: [ './preview-upload.component.scss' ],
  templateUrl: './preview-upload.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PreviewUploadComponent),
      multi: true
    }
  ],
  imports: [ CommonModule, FormsModule, ReactiveFileComponent, DeleteButtonComponent ]
})
export class PreviewUploadComponent implements OnInit, ControlValueAccessor {
  private serverService = inject(ServerService)

  readonly inputName = input.required<string>()
  readonly inputLabel = input<string>(undefined)
  readonly displayDelete = input(false, { transform: booleanAttribute })
  readonly buttonsAside = input(false, { transform: booleanAttribute })
  readonly previewSize = input<{ width: string, height: string }>(undefined)

  imageSrc: string
  allowedExtensionsMessage = ''
  maxSizeText: string
  file: Blob

  private serverConfig: HTMLServerConfig
  private bytesPipe: BytesPipe

  constructor () {
    this.bytesPipe = new BytesPipe()
    this.maxSizeText = $localize`max size`
  }

  get videoImageExtensions () {
    return this.serverConfig.video.image.extensions
  }

  get maxVideoImageSize () {
    return this.serverConfig.video.image.size.max
  }

  get maxVideoImageSizeInBytes () {
    return this.bytesPipe.transform(this.maxVideoImageSize)
  }

  getReactiveFileButtonTooltip () {
    return $localize`(extensions: ${this.videoImageExtensions}, ${this.maxSizeText}\: ${this.maxVideoImageSizeInBytes})`
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.allowedExtensionsMessage = this.videoImageExtensions.join(', ')
  }

  onFileChanged (file: Blob) {
    this.file = file

    this.propagateChange(this.file)
    this.updatePreview()
  }

  propagateChange = (_: any) => {
    // empty
  }

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
      imageToDataURL(this.file).then(result => this.imageSrc = result)
    } else {
      this.imageSrc = undefined
    }
  }
}
