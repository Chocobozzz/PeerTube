import * as AsyncLRU from 'async-lru'
import * as jsonld from 'jsonld'
import * as jsig from 'jsonld-signatures'

jsig.use('jsonld', jsonld)

const nodeDocumentLoader = jsonld.documentLoaders.node()

const lru = new AsyncLRU({
  max: 10,
  load: (key, cb) => {
    nodeDocumentLoader(key, cb)
  }
})

jsonld.documentLoader = (url, cb) => {
  lru.get(url, cb)
}

export { jsig }
