import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'

import { Search } from './search.model'
import { SearchField } from './search-field.type'
import { SearchService } from './search.service'

@Component({
  selector: 'my-search',
  templateUrl: './search.component.html',
  styleUrls: [ './search.component.scss' ]
})

export class SearchComponent implements OnInit {
  fieldChoices = {
    name: 'Name',
    account: 'Account',
    host: 'Host',
    tags: 'Tags'
  }
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

  get choiceKeys () {
    return Object.keys(this.fieldChoices)
  }

  choose ($event: MouseEvent, choice: SearchField) {
    $event.preventDefault()
    $event.stopPropagation()

    this.searchCriteria.field = choice

    if (this.searchCriteria.value) {
      this.doSearch()
    }
  }

  doSearch () {
    if (this.router.url.indexOf('/videos/list') === -1) {
      this.router.navigate([ '/videos/list' ])
    }

    this.searchService.searchUpdated.next(this.searchCriteria)
  }

  getStringChoice (choiceKey: SearchField) {
    return this.fieldChoices[choiceKey]
  }
}
