import { Component } from '@angular/core'
import { ScreenService } from '@app/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { PluginSelectorDirective } from '../shared/shared-main/plugins/plugin-selector.directive'
import { NgClass } from '@angular/common'

@Component({
  selector: 'my-about',
  templateUrl: './about.component.html',
  standalone: true,
  imports: [ NgClass, PluginSelectorDirective, RouterLink, RouterLinkActive, RouterOutlet ]
})

export class AboutComponent {
  constructor (
    private screenService: ScreenService
  ) { }

  get isBroadcastMessageDisplayed () {
    return this.screenService.isBroadcastMessageDisplayed
  }
}
