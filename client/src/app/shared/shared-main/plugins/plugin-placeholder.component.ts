import { Component, Input } from '@angular/core'
import { PluginElementPlaceholder } from '@shared/models'

@Component({
  selector: 'my-plugin-placeholder',
  template: '<div [id]="getId()"></div>',
  styles: [ 'div { height: 100%; }' ]
})

export class PluginPlaceholderComponent {
  @Input() pluginId: PluginElementPlaceholder

  getId () {
    return 'plugin-placeholder-' + this.pluginId
  }
}
