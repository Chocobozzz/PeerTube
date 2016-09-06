import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { Search } from './search.model';
import { SearchField } from './search-field.type';
import { SearchService } from './search.service';

@Component({
  selector: 'my-search',
  template: require('./search.component.html')
})

export class SearchComponent implements OnInit {
  fieldChoices = {
    name: 'Name',
    author: 'Author',
    podUrl: 'Pod Url',
    magnetUri: 'Magnet Uri',
    tags: 'Tags'
  };
  searchCriterias: Search = {
    field: 'name',
    value: ''
  };

  constructor(private searchService: SearchService, private router: Router) {}

  ngOnInit() {
    // Subscribe if the search changed
    // Usually changed by videos list component
    this.searchService.updateSearch.subscribe(
      newSearchCriterias => {
        // Put a field by default
        if (!newSearchCriterias.field) {
          newSearchCriterias.field = 'name';
        }

        this.searchCriterias = newSearchCriterias;
      }
    );
  }

  get choiceKeys() {
    return Object.keys(this.fieldChoices);
  }

  choose($event: MouseEvent, choice: SearchField) {
    $event.preventDefault();
    $event.stopPropagation();

    this.searchCriterias.field = choice;

    if (this.searchCriterias.value) {
      this.doSearch();
    }
  }

  doSearch() {
    if (this.router.url.indexOf('/videos/list') === -1) {
      this.router.navigate([ '/videos/list' ]);
    }

    this.searchService.searchUpdated.next(this.searchCriterias);
  }

  getStringChoice(choiceKey: SearchField) {
    return this.fieldChoices[choiceKey];
  }
}
