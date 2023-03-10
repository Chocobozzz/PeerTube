import { Component, Input, OnInit } from '@angular/core'
import { HooksService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main'

type PluginMetadata = {
  label: string

  value?: string
  safeHTML?: string
}

@Component({
  selector: 'my-video-attributes',
  templateUrl: './video-attributes.component.html',
  styleUrls: [ './video-attributes.component.scss' ]
})
export class VideoAttributesComponent implements OnInit {
  @Input() video: VideoDetails

  pluginMetadata: PluginMetadata[] = []

  constructor (private hooks: HooksService) { }

  async ngOnInit () {
    this.pluginMetadata = await this.hooks.wrapFunResult(
      this.buildPluginMetadata.bind(this),
      { video: this.video },
      'video-watch',
      'filter:video-watch.video-plugin-metadata.result'
    )
  }

  getVideoHost () {
    return this.video.channel.host
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags
  }

  // Used for plugin hooks
  private buildPluginMetadata (_options: {
    video: VideoDetails
  }): PluginMetadata[] {
    return []
  }
}
