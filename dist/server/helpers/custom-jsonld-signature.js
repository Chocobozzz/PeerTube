"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AsyncLRU = require("async-lru");
const jsonld = require("jsonld/");
const jsig = require("jsonld-signatures");
exports.jsig = jsig;
const nodeDocumentLoader = jsonld.documentLoaders.node();
const lru = new AsyncLRU({
    max: 10,
    load: (key, cb) => {
        nodeDocumentLoader(key, cb);
    }
});
jsonld.documentLoader = (url, cb) => {
    lru.get(url, cb);
};
jsig.use('jsonld', jsonld);
