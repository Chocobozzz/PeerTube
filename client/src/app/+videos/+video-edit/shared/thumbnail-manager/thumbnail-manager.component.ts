import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { imageToDataURL } from '@root-helpers/images'
import { BytesPipe } from '@app/shared/shared-main/angular/bytes.pipe'

import {
  Component,
  forwardRef,
  Input,
  OnInit
} from '@angular/core'
import {
  ServerService
} from '@app/core'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'
import { PeerTubePlayer } from 'src/standalone/embed-player-api/player'
import { getAbsoluteAPIUrl } from '@app/helpers'

@Component({
  selector: 'my-thumbnail-manager',
  styleUrls: [ './thumbnail-manager.component.scss' ],
  templateUrl: './thumbnail-manager.component.html',
  standalone: true,
  imports: [ CommonModule, ReactiveFileComponent ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ThumbnailManagerComponent),
      multi: true
    }
  ]
})
export class ThumbnailManagerComponent implements OnInit, ControlValueAccessor {

  @Input() uuid: string

  previewWidth = '360px'
  previewHeight = '200px'

  imageSrc: string
  allowedExtensionsMessage = ''
  maxSizeText: string

  serverConfig: HTMLServerConfig
  bytesPipe: BytesPipe
  imageFile: Blob

  // State Toggle (Upload, Select Frame)
  selectingFromVideo = false

  player: PeerTubePlayer

  constructor (
    private serverService: ServerService
  ) {
    this.bytesPipe = new BytesPipe()
    this.maxSizeText = $localize`max size`
  }

  // Section - Upload
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
    this.imageFile = file

    this.propagateChange(this.imageFile)
    this.updatePreview()
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (file: any) {
    this.imageFile = file
    this.updatePreview()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  private updatePreview () {
    if (this.imageFile) {
      imageToDataURL(this.imageFile).then(result => this.imageSrc = result)
    }
  }
  // End Section - Upload

  // Section - Select From Frame
  selectFromVideo () {

    this.selectingFromVideo = true

    const url = getAbsoluteAPIUrl()

    const iframe = document.createElement('iframe')
    iframe.src = `${url}/videos/embed/${this.uuid}?api=1&waitPasswordFromEmbedAPI=1&muted=1&title=0&peertubeLink=0`

    iframe.sandbox.add('allow-same-origin', 'allow-scripts', 'allow-popups')

    iframe.height = '100%'
    iframe.width = '100%'

    const mainElement = document.querySelector('#embedContainer')
    mainElement.appendChild(iframe)

    mainElement.classList.add('video-embed')

    this.player = new PeerTubePlayer(iframe)
  }

  resetSelectFromVideo () {

    if (this.player) this.player.destroy()

    const mainElement = document.querySelector('#embedContainer')

    mainElement.classList.remove('video-embed')

    this.selectingFromVideo = false
  }

  async selectFrame () {

    const dataUrl: string = await this.player.getImageDataUrl()

    // Checking for an empty data URL
    if (dataUrl.length <= 6) {
      return
    }

    this.imageSrc = dataUrl

    const blob: Blob = this.dataURItoBlob(dataUrl)

    const file = new File([ blob ], 'PreviewFile.jpg', { type: 'image/jpeg' })

    this.imageFile = file

    this.propagateChange(this.imageFile)

    this.resetSelectFromVideo()

  }

  /*
   * Credit: https://stackoverflow.com/a/7261048/1030669
   */
  dataURItoBlob (dataURI: string) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    const byteString = atob(dataURI.split(',')[1])

    // separate out the mime component
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    const ab = new ArrayBuffer(byteString.length)

    // create a view into the buffer
    const ia = new Uint8Array(ab)

    // set the bytes of the buffer to the correct values
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }

    // write the ArrayBuffer to a blob, and you're done
    const blob = new Blob([ ab ], { type: mimeString })
    return blob

  }
  // End Section - Upload
}
