import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { imageToDataURL } from '@root-helpers/images'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { NgIf, NgStyle } from '@angular/common'
import { ReactiveFileComponent } from './reactive-file.component'
import { BytesPipe } from '../shared-main/common/bytes.pipe'

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
  imports: [ ReactiveFileComponent, NgIf, NgStyle ]
})
export class PreviewUploadComponent implements OnInit, ControlValueAccessor {
  @Input() inputLabel: string
  @Input() inputName: string
  @Input() previewWidth: string
  @Input() previewHeight: string

  imageSrc: string
  allowedExtensionsMessage = ''
  maxSizeText: string

  private serverConfig: HTMLServerConfig
  private bytesPipe: BytesPipe
  private file: Blob

  constructor (
    private serverService: ServerService
  ) {
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
      imageToDataURL(this.file).then(result => this.imageSrc = result)
    }
  }
}
