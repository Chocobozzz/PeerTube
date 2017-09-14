import { Injectable } from '@angular/core'
import { HttpParams } from '@angular/common/http'
import { SortMeta } from 'primeng/primeng'

import { RestPagination } from './rest-pagination'

@Injectable()
export class RestService {

  addRestGetParams (params: HttpParams, pagination?: RestPagination, sort?: SortMeta | string) {
    let newParams = params

    if (pagination !== undefined) {
      newParams = newParams.set('start', pagination.start.toString())
                           .set('count', pagination.count.toString())
    }

    if (sort !== undefined) {
      let sortString = ''

      if (typeof sort === 'string') {
        sortString = sort
      } else {
        const sortPrefix = sort.order === 1 ? '' : '-'
        sortString = sortPrefix + sort.field
      }

      newParams = newParams.set('sort', sortString)
    }

    return newParams
  }

}
