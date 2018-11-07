"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
function getStats(url, useCache = false) {
    const path = '/api/v1/server/stats';
    const query = {
        t: useCache ? undefined : new Date().getTime()
    };
    return __1.makeGetRequest({
        url,
        path,
        query,
        statusCodeExpected: 200
    });
}
exports.getStats = getStats;
//# sourceMappingURL=stats.js.map