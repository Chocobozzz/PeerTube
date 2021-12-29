import { Component, Input } from '@angular/core'
import { PluginType } from '@shared/models/plugins'

@Component({
  selector: 'my-plugin-navigation',
  templateUrl: './plugin-navigation.component.html',
  styleUrls: [ './plugin-navigation.component.scss' ]
})
export class PluginNavigationComponent {
  @Input() pluginType: PluginType
}
