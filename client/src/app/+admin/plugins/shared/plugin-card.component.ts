import { Component, Input } from '@angular/core'
import { PeerTubePlugin, PeerTubePluginIndex, PluginType_Type } from '@peertube/peertube-models'
import { PluginApiService } from './plugin-api.service'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-plugin-card',
  templateUrl: './plugin-card.component.html',
  styleUrls: [ './plugin-card.component.scss' ],
  imports: [ GlobalIconComponent ]
})

export class PluginCardComponent {
  @Input() plugin: PeerTubePluginIndex | PeerTubePlugin
  @Input() version: string
  @Input() pluginType: PluginType_Type

  constructor (
    private pluginApiService: PluginApiService
  ) {
  }

  getPluginOrThemeHref (name: string) {
    return this.pluginApiService.getPluginOrThemeHref(this.pluginType, name)
  }
}
