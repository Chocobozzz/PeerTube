"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
require("express-validator");
const misc_1 = require("./misc");
function isNumberArray(value) {
    return misc_1.isArray(value) && value.every(v => validator.isInt('' + v));
}
exports.isNumberArray = isNumberArray;
function isStringArray(value) {
    return misc_1.isArray(value) && value.every(v => typeof v === 'string');
}
exports.isStringArray = isStringArray;
function isNSFWQueryValid(value) {
    return value === 'true' || value === 'false' || value === 'both';
}
exports.isNSFWQueryValid = isNSFWQueryValid;
