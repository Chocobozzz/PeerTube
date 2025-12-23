import { Component, OnChanges, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { HooksService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { TimeDurationFormatterPipe } from '@app/shared/shared-main/date/time-duration-formatter.pipe'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'

type PluginMetadata = {
  label: string

  value?: string
  safeHTML?: string
}

@Component({
  selector: 'my-video-attributes',
  templateUrl: './video-attributes.component.html',
  styleUrls: [ './video-attributes.component.scss' ],
  imports: [ RouterLink, GlobalIconComponent, TimeDurationFormatterPipe, PTDatePipe ]
})
export class VideoAttributesComponent implements OnChanges {
  private hooks = inject(HooksService)

  readonly video = input<VideoDetails>(undefined)

  pluginMetadata: PluginMetadata[] = []

  async ngOnChanges () {
    this.pluginMetadata = await this.hooks.wrapObject(
      this.pluginMetadata,
      'video-watch',
      'filter:video-watch.video-plugin-metadata.result',
      { video: this.video() }
    )
  }

  getVideoHost () {
    return this.video().channel.host
  }

  getVideoTags () {
    const video = this.video()
    if (!video || Array.isArray(video.tags) === false) return []

    return video.tags
  }
}
