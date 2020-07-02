import { SortMeta } from 'primeng/api'
import { HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight } from './component-pagination.model'
import { RestPagination } from './rest-pagination'

interface QueryStringFilterPrefixes {
  [key: string]: {
    prefix: string
    handler?: (v: string) => string | number
    multiple?: boolean
    isBoolean?: boolean
  }
}

type ParseQueryStringFilterResult = {
  [key: string]: string | number | boolean | (string | number | boolean)[]
}

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

  addObjectParams (params: HttpParams, object: { [ name: string ]: any }) {
    for (const name of Object.keys(object)) {
      const value = object[name]
      if (value === undefined || value === null) continue

      if (Array.isArray(value) && value.length !== 0) {
        for (const v of value) params = params.append(name, v)
      } else {
        params = params.append(name, value)
      }
    }

    return params
  }

  componentPaginationToRestPagination (componentPagination: ComponentPaginationLight): RestPagination {
    const start: number = (componentPagination.currentPage - 1) * componentPagination.itemsPerPage
    const count: number = componentPagination.itemsPerPage

    return { start, count }
  }

  parseQueryStringFilter (q: string, prefixes: QueryStringFilterPrefixes): ParseQueryStringFilterResult {
    if (!q) return {}

    // Tokenize the strings using spaces that are not in quotes
    const tokens = q.match(/(?:[^\s"]+|"[^"]*")+/g)
                    .filter(token => !!token)

    // Build prefix array
    const prefixeStrings = Object.values(prefixes)
                           .map(p => p.prefix)

    // Search is the querystring minus defined filters
    const searchTokens = tokens.filter(t => {
      return prefixeStrings.every(prefixString => t.startsWith(prefixString) === false)
    })

    const additionalFilters: ParseQueryStringFilterResult = {}

    for (const prefixKey of Object.keys(prefixes)) {
      const prefixObj = prefixes[prefixKey]
      const prefix = prefixObj.prefix

      const matchedTokens = tokens.filter(t => t.startsWith(prefix))
                                  .map(t => t.slice(prefix.length)) // Keep the value filter
                                  .map(t => t.replace(/^"|"$/g, ''))
                                  .map(t => {
                                    if (prefixObj.handler) return prefixObj.handler(t)

                                    return t
                                  })
                                  .filter(t => !!t || t === 0)
                                  .map(t => prefixObj.isBoolean ? t === 'true' : t)

      if (matchedTokens.length === 0) continue

      additionalFilters[prefixKey] = prefixObj.multiple === true
        ? matchedTokens
        : matchedTokens[0]
    }

    return {
      search: searchTokens.join(' ') || undefined,

      ...additionalFilters
    }
  }
}
