import { Component, inject, input } from '@angular/core'
import { PeerTubePlugin, PeerTubePluginIndex, PluginType_Type } from '@peertube/peertube-models'
import { PluginApiService } from '../../../shared/shared-admin/plugin-api.service'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-plugin-card',
  templateUrl: './plugin-card.component.html',
  styleUrls: [ './plugin-card.component.scss' ],
  imports: [ GlobalIconComponent ]
})
export class PluginCardComponent {
  private pluginApiService = inject(PluginApiService)

  readonly plugin = input<PeerTubePluginIndex | PeerTubePlugin>(undefined)
  readonly version = input<string>(undefined)
  readonly pluginType = input<PluginType_Type>(undefined)

  getPluginOrThemeHref (name: string) {
    return this.pluginApiService.getPluginOrThemeHref(this.pluginType(), name)
  }
}
