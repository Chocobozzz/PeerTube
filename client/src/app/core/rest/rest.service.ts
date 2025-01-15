import debug from 'debug'
import { SortMeta } from 'primeng/api'
import { HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight } from './component-pagination.model'
import { RestPagination } from './rest-pagination'

const debugLogger = debug('peertube:rest')

type ParseQueryHandlerResult = string | number | boolean | string[] | number[] | boolean[]

interface QueryStringFilterPrefixes {
  [key: string]: {
    prefix: string
    handler?: (v: string) => ParseQueryHandlerResult
    multiple?: boolean
    isBoolean?: boolean
  }
}

type ParseQueryStringFilters <K extends keyof any> = Partial<Record<K, ParseQueryHandlerResult | ParseQueryHandlerResult[]>>
type ParseQueryStringFiltersResult <K extends keyof any> = ParseQueryStringFilters<K> & { search?: string }

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

  addObjectParams (params: HttpParams, object: { [ name: string ]: any }) {
    for (const name of Object.keys(object)) {
      const value = object[name]
      if (value === undefined || value === null) continue

      if (Array.isArray(value)) {
        params = this.addArrayParams(params, name, value)
      } else {
        params = params.append(name, value)
      }
    }

    return params
  }

  componentToRestPagination (componentPagination: ComponentPaginationLight): RestPagination {
    const { currentPage, itemsPerPage, itemsRemoved = 0 } = componentPagination

    const start = Math.max(0, (currentPage - 1) * itemsPerPage - itemsRemoved)

    return { start, count: itemsPerPage }
  }

  /*
  * Returns an object containing the filters and the remaining search
  */
  parseQueryStringFilter <T extends QueryStringFilterPrefixes> (q: string, prefixes: T): ParseQueryStringFiltersResult<keyof T> {
    if (!q) return {}

    const tokens = this.tokenizeString(q)

    // Build prefix array
    const prefixeStrings = Object.values(prefixes)
                                 .map(p => p.prefix)

    debugLogger(`Built tokens "${tokens.join(', ')}" for prefixes "${prefixeStrings.join(', ')}"`)

    // Search is the querystring minus defined filters
    const searchTokens = tokens.filter(t => {
      return prefixeStrings.every(prefixString => t.startsWith(prefixString) === false)
    })

    const additionalFilters: ParseQueryStringFilters<keyof T> = {}

    for (const prefixKey of Object.keys(prefixes) as (keyof T)[]) {
      const prefixObj = prefixes[prefixKey]
      const prefix = prefixObj.prefix

      const matchedTokens = tokens.filter(t => t.startsWith(prefix))
                                  .map(t => t.slice(prefix.length)) // Keep the value filter
                                  .map(t => t.replace(/^"|"$/g, '')) // Remove ""
                                  .map(t => {
                                    if (prefixObj.handler) return prefixObj.handler(t)

                                    if (prefixObj.isBoolean) {
                                      if (t === 'true') return true
                                      if (t === 'false') return false

                                      return undefined
                                    }

                                    return t
                                  })
                                  .filter(t => t !== null && t !== undefined)

      if (matchedTokens.length === 0) continue

      additionalFilters[prefixKey] = prefixObj.multiple === true
        ? matchedTokens
        : matchedTokens[0]
    }

    const search = searchTokens.join(' ') || undefined

    debugLogger('Built search: ' + search, additionalFilters)

    return {
      search,

      ...additionalFilters
    }
  }

  tokenizeString (q: string) {
    if (!q) return []

    // Tokenize the strings using spaces that are not in quotes
    return q.match(/(?:[^\s"]+|"[^"]*")+/g)
            .filter(token => !!token)
  }
}
