import { Injectable } from '@angular/core'
import { HttpParams } from '@angular/common/http'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { ComponentPagination } from './component-pagination.model'

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

  addObjectParams (params: HttpParams, object: object) {
    for (const name of Object.keys(object)) {
      const value = object[name]
      if (!value) continue

      if (Array.isArray(value) && value.length !== 0) {
        for (const v of value) params = params.append(name, v)
      } else {
        params = params.append(name, value)
      }
    }

    return params
  }

  componentPaginationToRestPagination (componentPagination: ComponentPagination): RestPagination {
    const start: number = (componentPagination.currentPage - 1) * componentPagination.itemsPerPage
    const count: number = componentPagination.itemsPerPage

    return { start, count }
  }
}
