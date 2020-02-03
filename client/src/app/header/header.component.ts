import { Component, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ]
})

export class HeaderComponent implements OnInit {
  searchValue = ''
  ariaLabelTextForSearch = ''

  constructor (
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.ariaLabelTextForSearch = this.i18n('Search videos, channels')
  }
}
