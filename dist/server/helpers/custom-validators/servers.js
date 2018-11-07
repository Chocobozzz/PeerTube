"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
require("express-validator");
const misc_1 = require("./misc");
const core_utils_1 = require("../core-utils");
function isHostValid(host) {
    const isURLOptions = {
        require_host: true,
        require_tld: true
    };
    if (core_utils_1.isTestInstance()) {
        isURLOptions.require_tld = false;
    }
    return misc_1.exists(host) && validator.isURL(host, isURLOptions) && host.split('://').length === 1;
}
exports.isHostValid = isHostValid;
function isEachUniqueHostValid(hosts) {
    return misc_1.isArray(hosts) &&
        hosts.length !== 0 &&
        hosts.every(host => {
            return isHostValid(host) && hosts.indexOf(host) === hosts.lastIndexOf(host);
        });
}
exports.isEachUniqueHostValid = isEachUniqueHostValid;
//# sourceMappingURL=servers.js.map