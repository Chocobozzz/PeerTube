import { Component, EventEmitter, Output, OnInit } from '@angular/core';

import { DROPDOWN_DIRECTIVES} from  'ng2-bootstrap/components/dropdown';

import { Search } from './search.model';
import { SearchField } from './search-field.type';
import { SearchService } from './search.service'; // Temporary

@Component({
    selector: 'my-search',
    template: require('./search.component.html'),
    directives: [ DROPDOWN_DIRECTIVES ]
})

export class SearchComponent implements OnInit {
  @Output() search = new EventEmitter<Search>();

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

  constructor(private searchService: SearchService) {}

  ngOnInit() {
    this.searchService.searchChanged.subscribe(
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
    this.doSearch();
  }

  doSearch() {
    this.search.emit(this.searchCriterias);
  }

  getStringChoice(choiceKey: SearchField) {
    return this.fieldChoices[choiceKey];
  }
}
