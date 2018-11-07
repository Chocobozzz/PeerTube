"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("express-validator");
const initializers_1 = require("../initializers");
function setDefaultPagination(req, res, next) {
    if (!req.query.start)
        req.query.start = 0;
    else
        req.query.start = parseInt(req.query.start, 10);
    if (!req.query.count)
        req.query.count = initializers_1.PAGINATION.COUNT.DEFAULT;
    else
        req.query.count = parseInt(req.query.count, 10);
    if (req.query.count > initializers_1.PAGINATION.COUNT.MAX)
        req.query.count = initializers_1.PAGINATION.COUNT.MAX;
    return next();
}
exports.setDefaultPagination = setDefaultPagination;
