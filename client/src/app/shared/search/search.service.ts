import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';

import { Search } from './search.model';

// This class is needed to communicate between videos/ and search component
// Remove it when we'll be able to subscribe to router changes
@Injectable()
export class SearchService {
  searchUpdated: Subject<Search>;
  updateSearch: Subject<Search>;

  constructor() {
    this.updateSearch = new Subject<Search>();
    this.searchUpdated = new Subject<Search>();
  }
}
