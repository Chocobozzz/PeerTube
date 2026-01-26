import {
  Component,
  EnvironmentInjector,
  OnInit,
  afterNextRender,
  forwardRef,
  inject,
  input,
  runInInjectionContext,
  viewChild
} from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { DragDropDirective } from '@app/+videos-publish-manage/+video-publish/shared/drag-drop.directive'
import { Notifier, ServerService } from '@app/core'
import { ReactiveFileComponent } from '@app/shared/shared-forms/reactive-file.component'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { EmbedComponent } from '@app/shared/shared-main/video/embed.component'
import { HTMLServerConfig, VideoState } from '@peertube/peertube-models'
import { imageToDataURL } from '@root-helpers/images'
import { PeerTubePlayer } from '../../../../standalone/embed-player-api/player'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { VideoEdit } from './video-edit.model'

@Component({
  selector: 'my-thumbnail-manager',
  styleUrls: [ './thumbnail-manager.component.scss' ],
  templateUrl: './thumbnail-manager.component.html',
  imports: [ ReactiveFileComponent, EmbedComponent, DragDropDirective, ButtonComponent ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ThumbnailManagerComponent),
      multi: true
    }
  ]
})
export class ThumbnailManagerComponent implements OnInit, ControlValueAccessor {
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)
  private environmentInjector = inject(EnvironmentInjector)

  readonly embed = viewChild<EmbedComponent>('embed')

  readonly videoEdit = input.required<VideoEdit>()

  imageSrc: string
  allowedExtensionsMessage = ''

  serverConfig: HTMLServerConfig
  bytesPipe: BytesPipe
  imageFile: Blob

  selectingFromVideo = false

  player: PeerTubePlayer

  constructor () {
    this.bytesPipe = new BytesPipe()
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
    const videoEdit = this.videoEdit()
    if (!videoEdit) return

    const attrs = videoEdit.getVideoAttributes()

    return !attrs.isLive && attrs.state === VideoState.PUBLISHED
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

  onFileDropped (files: FileList) {
    return this.onFileChanged(files[0])
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (file: Blob) {
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

    runInInjectionContext(this.environmentInjector, () => {
      afterNextRender(() => {
        try {
          this.player = new PeerTubePlayer(this.embed().getIframe())
        } catch (err) {
          this.notifier.error('Error creating PeerTube embed: ' + err.message)
          this.selectingFromVideo = false
          return
        }
      })
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
  private dataURItoBlob (dataURI: string) {
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
