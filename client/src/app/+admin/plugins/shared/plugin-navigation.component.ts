import { Component, Input } from '@angular/core'
import { PluginType_Type } from '@peertube/peertube-models'

@Component({
  selector: 'my-plugin-navigation',
  templateUrl: './plugin-navigation.component.html',
  styleUrls: [ './plugin-navigation.component.scss' ]
})
export class PluginNavigationComponent {
  @Input() pluginType: PluginType_Type
}
