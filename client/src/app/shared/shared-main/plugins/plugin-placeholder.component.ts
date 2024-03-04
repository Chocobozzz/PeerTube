import { Component, Input } from '@angular/core'
import { PluginElementPlaceholder } from '@peertube/peertube-models'

@Component({
  selector: 'my-plugin-placeholder',
  template: '<div [id]="getId()"></div>',
  styleUrls: [ './plugin-placeholder.component.scss' ],
  standalone: true
})

export class PluginPlaceholderComponent {
  @Input() pluginId: PluginElementPlaceholder

  getId () {
    return 'plugin-placeholder-' + this.pluginId
  }
}
