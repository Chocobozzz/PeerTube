import { Component, Input } from '@angular/core'
import { PluginType_Type } from '@peertube/peertube-models'
import { NgClass } from '@angular/common'
import { RouterLink, RouterLinkActive } from '@angular/router'

@Component({
  selector: 'my-plugin-navigation',
  templateUrl: './plugin-navigation.component.html',
  styleUrls: [ './plugin-navigation.component.scss' ],
  standalone: true,
  imports: [ RouterLink, RouterLinkActive, NgClass ]
})
export class PluginNavigationComponent {
  @Input() pluginType: PluginType_Type
}
