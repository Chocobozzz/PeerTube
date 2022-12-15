import { Component, Input } from '@angular/core'
import { PeerTubePlugin, PeerTubePluginIndex, PluginType } from '@shared/models'
import { PluginApiService } from './plugin-api.service'

@Component({
  selector: 'my-plugin-card',
  templateUrl: './plugin-card.component.html',
  styleUrls: [ './plugin-card.component.scss' ]
})

export class PluginCardComponent {
  @Input() plugin: PeerTubePluginIndex | PeerTubePlugin
  @Input() version: string
  @Input() pluginType: PluginType

  constructor (
    private pluginApiService: PluginApiService
  ) {
  }

  getPluginOrThemeHref (name: string) {
    return this.pluginApiService.getPluginOrThemeHref(this.pluginType, name)
  }
}
