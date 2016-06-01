import { Component, EventEmitter, Output } from '@angular/core';

import { DROPDOWN_DIRECTIVES} from  'ng2-bootstrap/components/dropdown';

import { Search } from './search.model';
import { SearchField } from './search-field.type';

@Component({
    selector: 'my-search',
    templateUrl: 'client/app/shared/search/search.component.html',
    directives: [ DROPDOWN_DIRECTIVES ]
})

export class SearchComponent {
  @Output() search = new EventEmitter<Search>();

  fieldChoices = {
    name: 'Name',
    author: 'Author',
    podUrl: 'Pod Url',
    magnetUri: 'Magnet Uri'
  };
  searchCriterias: Search = {
    field: 'name',
    value: ''
  };

  get choiceKeys() {
    return Object.keys(this.fieldChoices);
  }

  choose($event: MouseEvent, choice: SearchField) {
    $event.preventDefault();
    $event.stopPropagation();

    this.searchCriterias.field = choice;
  }

  doSearch() {
    this.search.emit(this.searchCriterias);
  }

  getStringChoice(choiceKey: SearchField) {
    return this.fieldChoices[choiceKey];
  }
}
