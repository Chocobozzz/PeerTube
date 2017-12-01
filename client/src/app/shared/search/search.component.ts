import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { Search } from './search.model'
import { SearchService } from './search.service'

@Component({
  selector: 'my-search',
  templateUrl: './search.component.html',
  styleUrls: [ './search.component.scss' ]
})

export class SearchComponent implements OnInit {
  searchCriteria: Search = {
    field: 'name',
    value: ''
  }

  constructor (private searchService: SearchService, private router: Router) {}

  ngOnInit () {
    // Subscribe if the search changed
    // Usually changed by videos list component
    this.searchService.updateSearch.subscribe(
      newSearchCriteria => {
        // Put a field by default
        if (!newSearchCriteria.field) {
          newSearchCriteria.field = 'name'
        }

        this.searchCriteria = newSearchCriteria
      }
    )
  }

  doSearch () {
    // if (this.router.url.indexOf('/videos/list') === -1) {
    //   this.router.navigate([ '/videos/list' ])
    // }

    this.searchService.searchUpdated.next(this.searchCriteria)
  }
}
