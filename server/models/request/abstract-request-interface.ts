import * as Promise from 'bluebird'

export interface AbstractRequestClass <T> {
  countTotalRequests: () => Promise<number>
  listWithLimitAndRandom: (limitPods: number, limitRequestsPerPod: number) => Promise<T>
  removeWithEmptyTo: () => Promise<number>
  removeAll: () => Promise<void>
}

export interface AbstractRequestToPodClass {
  removeByRequestIdsAndPod: (ids: number[], podId: number) => Promise<number>
}
