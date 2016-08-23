import { Injectable } from '@angular/core';
import { URLSearchParams } from '@angular/http';

import { RestPagination } from './rest-pagination';

@Injectable()
export class RestService {

  buildRestGetParams(pagination?: RestPagination, sort?: string) {
    const params = new URLSearchParams();

    if (pagination) {
      const start: number = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const count: number = pagination.itemsPerPage;

      params.set('start', start.toString());
      params.set('count', count.toString());
    }

    if (sort) {
      params.set('sort', sort);
    }

    return params;
  }

}
