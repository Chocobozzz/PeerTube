import { HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/api'
import { ComponentPaginationLight } from './component-pagination.model'
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
      newParams = newParams.set('sort', this.buildSortString(sort))
    }

    return newParams
  }

  buildSortString (sort: SortMeta | string) {
    if (typeof sort === 'string') {
      return sort
    }

    const sortPrefix = sort.order === 1 ? '' : '-'
    return sortPrefix + sort.field
  }

  addArrayParams (params: HttpParams, name: string, values: (string | number)[]) {
    for (const v of values) {
      params = params.append(name, v)
    }

    return params
  }

  addObjectParams (params: HttpParams, object: { [name: string]: any }) {
    for (const name of Object.keys(object)) {
      const value = object[name]
      if (value === undefined || value === null) continue

      if (Array.isArray(value)) {
        params = this.addArrayParams(params, name, value)
      } else {
        params = params.set(name, value)
      }
    }

    return params
  }

  componentToRestPagination (componentPagination: ComponentPaginationLight): RestPagination {
    const { currentPage, itemsPerPage, itemsRemoved = 0 } = componentPagination

    const start = Math.max(0, (currentPage - 1) * itemsPerPage - itemsRemoved)

    return { start, count: itemsPerPage }
  }
}
