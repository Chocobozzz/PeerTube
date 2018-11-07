"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requests_1 = require("./requests");
const __1 = require("..");
function checkBadStartPagination(url, path, token, query = {}) {
    return requests_1.makeGetRequest({
        url,
        path,
        token,
        query: __1.immutableAssign(query, { start: 'hello' }),
        statusCodeExpected: 400
    });
}
exports.checkBadStartPagination = checkBadStartPagination;
function checkBadCountPagination(url, path, token, query = {}) {
    return requests_1.makeGetRequest({
        url,
        path,
        token,
        query: __1.immutableAssign(query, { count: 'hello' }),
        statusCodeExpected: 400
    });
}
exports.checkBadCountPagination = checkBadCountPagination;
function checkBadSortPagination(url, path, token, query = {}) {
    return requests_1.makeGetRequest({
        url,
        path,
        token,
        query: __1.immutableAssign(query, { sort: 'hello' }),
        statusCodeExpected: 400
    });
}
exports.checkBadSortPagination = checkBadSortPagination;
//# sourceMappingURL=check-api-params.js.map