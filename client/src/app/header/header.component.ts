import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { getParameterByName } from '../shared/misc/utils'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ]
})

export class HeaderComponent implements OnInit {
  searchValue = ''

  constructor (private router: Router) {}

  ngOnInit () {
    const searchQuery = getParameterByName('search', window.location.href)
    if (searchQuery) this.searchValue = searchQuery
  }

  doSearch () {
    this.router.navigate([ '/videos', 'search' ], {
      queryParams: { search: this.searchValue }
    })
  }
}
