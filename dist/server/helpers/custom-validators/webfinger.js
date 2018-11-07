"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initializers_1 = require("../../initializers");
const core_utils_1 = require("../core-utils");
const misc_1 = require("./misc");
function isWebfingerLocalResourceValid(value) {
    if (!misc_1.exists(value))
        return false;
    if (value.startsWith('acct:') === false)
        return false;
    const actorWithHost = value.substr(5);
    const actorParts = actorWithHost.split('@');
    if (actorParts.length !== 2)
        return false;
    const host = actorParts[1];
    return core_utils_1.sanitizeHost(host, initializers_1.REMOTE_SCHEME.HTTP) === initializers_1.CONFIG.WEBSERVER.HOST;
}
exports.isWebfingerLocalResourceValid = isWebfingerLocalResourceValid;
