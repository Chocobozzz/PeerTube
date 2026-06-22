import { Component, input, ChangeDetectionStrategy } from '@angular/core'
import { PluginElementPlaceholder } from '@peertube/peertube-models'

@Component({
  selector: 'my-plugin-placeholder',
  template: '<div [id]="getId()"></div>',
  styleUrls: [ './plugin-placeholder.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class PluginPlaceholderComponent {
  readonly pluginId = input<PluginElementPlaceholder>(undefined)

  getId () {
    return 'plugin-placeholder-' + this.pluginId()
  }
}
