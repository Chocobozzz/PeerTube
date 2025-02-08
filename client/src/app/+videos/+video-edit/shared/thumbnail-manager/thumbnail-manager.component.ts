import { CommonModule } from '@angular/common'
import {
  Component,
  Input,
  OnInit,
  ViewChild,
  forwardRef
} from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import {
  ServerService
} from '@app/core'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { EmbedComponent, EmbedVideoInput } from '@app/shared/shared-main/video/embed.component'
import { HTMLServerConfig, Video, VideoState } from '@peertube/peertube-models'
import { imageToDataURL } from '@root-helpers/images'
import { PeerTubePlayer } from '../../../../../standalone/embed-player-api/player'

@Component({
  selector: 'my-thumbnail-manager',
  styleUrls: [ './thumbnail-manager.component.scss' ],
  templateUrl: './thumbnail-manager.component.html',
  imports: [ CommonModule, ReactiveFileComponent, EmbedComponent ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ThumbnailManagerComponent),
      multi: true
    }
  ]
})
export class ThumbnailManagerComponent implements OnInit, ControlValueAccessor {
  @ViewChild('embed') embed: EmbedComponent

  @Input() video: EmbedVideoInput & Pick<Video, 'isLive' | 'state'>

  imageSrc: string
  allowedExtensionsMessage = ''
  maxSizeText: string

  serverConfig: HTMLServerConfig
  bytesPipe: BytesPipe
  imageFile: Blob

  selectingFromVideo = false

  player: PeerTubePlayer

  constructor (
    private serverService: ServerService
  ) {
    this.bytesPipe = new BytesPipe()
    this.maxSizeText = $localize`max size`
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  get videoImageExtensions () {
    return this.serverConfig.video.image.extensions
  }

  get maxVideoImageSize () {
    return this.serverConfig.video.image.size.max
  }

  get maxVideoImageSizeInBytes () {
    return this.bytesPipe.transform(this.maxVideoImageSize)
  }

  canSelectFromVideo () {
    return this.video && !this.video.isLive && this.video.state.id === VideoState.PUBLISHED
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

  // ---------------------------------------------------------------------------
  // Select from frame
  // ---------------------------------------------------------------------------

  selectFromVideo () {
    this.selectingFromVideo = true

    setTimeout(() => {
      this.player = new PeerTubePlayer(this.embed.getIframe())
    })
  }

  resetSelectFromVideo () {
    if (this.player) {
      this.player.destroy()
      this.player = undefined
    }

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

    const file = new File([ blob ], 'preview-file-from-frame.jpg', { type: 'image/jpeg' })

    this.imageFile = file

    this.propagateChange(this.imageFile)

    this.resetSelectFromVideo()
  }

  // Credit: https://stackoverflow.com/a/7261048/1030669
  dataURItoBlob (dataURI: string) {
    const byteString = atob(dataURI.split(',')[1])
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    const ab = new ArrayBuffer(byteString.length)

    const ia = new Uint8Array(ab)

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }

    return new Blob([ ab ], { type: mimeString })
  }
}
