"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("express-validator");
function setDefaultSort(req, res, next) {
    if (!req.query.sort)
        req.query.sort = '-createdAt';
    return next();
}
exports.setDefaultSort = setDefaultSort;
function setDefaultSearchSort(req, res, next) {
    if (!req.query.sort)
        req.query.sort = '-match';
    return next();
}
exports.setDefaultSearchSort = setDefaultSearchSort;
function setBlacklistSort(req, res, next) {
    let newSort = { sortModel: undefined, sortValue: '' };
    if (!req.query.sort)
        req.query.sort = '-createdAt';
    if (req.query.sort === '-createdAt' || req.query.sort === 'createdAt' ||
        req.query.sort === '-id' || req.query.sort === 'id') {
        newSort.sortModel = undefined;
    }
    else {
        newSort.sortModel = 'Video';
    }
    newSort.sortValue = req.query.sort;
    req.query.sort = newSort;
    return next();
}
exports.setBlacklistSort = setBlacklistSort;
//# sourceMappingURL=sort.js.map