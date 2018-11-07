"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("express-validator");
const express_utils_1 = require("../helpers/express-utils");
function setBodyHostsPort(req, res, next) {
    if (!req.body.hosts)
        return next();
    for (let i = 0; i < req.body.hosts.length; i++) {
        const hostWithPort = express_utils_1.getHostWithPort(req.body.hosts[i]);
        if (hostWithPort === null) {
            return res.sendStatus(500);
        }
        req.body.hosts[i] = hostWithPort;
    }
    return next();
}
exports.setBodyHostsPort = setBodyHostsPort;
//# sourceMappingURL=servers.js.map