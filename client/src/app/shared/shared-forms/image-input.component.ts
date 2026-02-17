import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, forwardRef, inject, input, OnInit } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { FileConstraints, HTMLServerConfig } from '@peertube/peertube-models'
import { imageToDataURL } from '@root-helpers/images'
import { DeleteButtonComponent } from '../shared-main/buttons/delete-button.component'
import { BytesPipe } from '../shared-main/common/bytes.pipe'
import { ReactiveFileComponent } from './reactive-file.component'

@Component({
  selector: 'my-image-input',
  styleUrls: [ './image-input.component.scss' ],
  templateUrl: './image-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ImageInputComponent),
      multi: true
    }
  ],
  imports: [ CommonModule, FormsModule, ReactiveFileComponent, DeleteButtonComponent ]
})
export class ImageInputComponent implements OnInit, ControlValueAccessor {
  private serverService = inject(ServerService)

  readonly inputName = input.required<string>()
  readonly inputLabel = input<string>()
  readonly displayDelete = input(false, { transform: booleanAttribute })
  readonly buttonsAside = input(false, { transform: booleanAttribute })
  readonly previewSize = input<{ width: string, height: string }>()
  readonly fileConstraints = input<FileConstraints>()

  imageSrc: string
  maxSizeText: string
  file: Blob

  imageExtensions: string[] = []
  maxImageSize: number
  maxImageSizeInBytes: string | number
  allowedExtensionsMessage = ''

  private serverConfig: HTMLServerConfig
  private bytesPipe: BytesPipe

  constructor () {
    this.bytesPipe = new BytesPipe()
    this.maxSizeText = $localize`max size`
  }

  getReactiveFileButtonTooltip () {
    return $localize`(extensions: ${this.imageExtensions.join(', ')}, max size\: ${this.maxImageSizeInBytes})`
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const fileContraints = this.fileConstraints() ?? this.serverConfig.video.image

    this.imageExtensions = fileContraints.extensions
    this.maxImageSize = fileContraints.size.max
    this.maxImageSizeInBytes = this.bytesPipe.transform(this.maxImageSize)

    this.allowedExtensionsMessage = this.imageExtensions.join(', ')
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
