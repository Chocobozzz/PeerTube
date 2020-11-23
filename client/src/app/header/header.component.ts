import { Component } from '@angular/core'
import { ScreenService } from '@app/core'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ]
})

export class HeaderComponent {
  aboutText = $localize`About`

  constructor (
    private screenService: ScreenService
  ) { }

  get isInMobileView () {
    return this.screenService.isInMobileView()
  }
}
