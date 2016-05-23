import { Component, EventEmitter, Output } from '@angular/core';
import { RouteConfig, ROUTER_DIRECTIVES, ROUTER_PROVIDERS, Router } from '@angular/router-deprecated';
import { HTTP_PROVIDERS } from '@angular/http';

import { DROPDOWN_DIRECTIVES} from  'ng2-bootstrap/components/dropdown';

import { Search, SearchField } from './search';

@Component({
    selector: 'my-search',
    templateUrl: 'app/angular/app/search.component.html',
    directives: [ DROPDOWN_DIRECTIVES ]
})

export class SearchComponent {
  @Output() search: EventEmitter<Search> = new EventEmitter<Search>();

  searchCriterias: Search = {
    field: "name",
    value: ""
  }
  fieldChoices = {
    name: "Name",
    author: "Author",
    podUrl: "Pod Url",
    magnetUri: "Magnet Uri"
  }

  get choiceKeys() {
    return Object.keys(this.fieldChoices);
  }

  getStringChoice(choiceKey: SearchField): string {
    return this.fieldChoices[choiceKey];
  }

  choose($event:MouseEvent, choice: SearchField){
    $event.preventDefault();
    $event.stopPropagation();

    this.searchCriterias.field = choice;
  }

  doSearch(): void {
    this.search.emit(this.searchCriterias);
  }

}
