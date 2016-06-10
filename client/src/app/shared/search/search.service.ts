import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';

import { Search } from './search.model';

// This class is needed to communicate between videos/list and search component
// Remove it when we'll be able to subscribe to router changes
@Injectable()
export class SearchService {
  searchChanged: Subject<Search>;

  constructor() {
    this.searchChanged = new Subject<Search>();
  }
}
