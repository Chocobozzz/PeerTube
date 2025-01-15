import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { HomeMenuComponent } from '@app/menu/home-menu.component'
import { DisableForReuseHook } from './core'

@Component({
  templateUrl: './videos-parent.component.html',
  standalone: true,
  imports: [
    HomeMenuComponent,
    RouterOutlet
  ]
})
export class VideosParentComponent implements DisableForReuseHook {

  disableForReuse () {
    // empty
  }

  enabledForReuse () {
    // empty
  }
}
