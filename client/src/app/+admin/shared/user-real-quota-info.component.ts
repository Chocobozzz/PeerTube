import { Component, Input, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { HTMLServerConfig, VideoResolution } from '@peertube/peertube-models'
import { BytesPipe } from '../../shared/shared-main/common/bytes.pipe'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-user-real-quota-info',
  templateUrl: './user-real-quota-info.component.html',
  imports: [ NgIf, BytesPipe ]
})
export class UserRealQuotaInfoComponent implements OnInit {
  @Input() videoQuota: number | string

  private serverConfig: HTMLServerConfig

  constructor (private server: ServerService) { }

  ngOnInit () {
    this.serverConfig = this.server.getHTMLConfig()
  }

  isTranscodingInformationDisplayed () {
    return this.serverConfig.transcoding.enabledResolutions.length !== 0
  }

  computeQuotaWithTranscoding () {
    const transcodingConfig = this.serverConfig.transcoding

    const resolutions = transcodingConfig.enabledResolutions
    const higherResolution = VideoResolution.H_4K
    let multiplier = 0

    for (const resolution of resolutions) {
      multiplier += resolution / higherResolution
    }

    if (transcodingConfig.hls.enabled) multiplier *= 2

    return multiplier * this.getQuotaAsNumber()
  }

  getQuotaAsNumber () {
    return parseInt(this.videoQuota + '', 10)
  }
}
