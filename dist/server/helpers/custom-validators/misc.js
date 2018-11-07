"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("multer");
const validator = require("validator");
function exists(value) {
    return value !== undefined && value !== null;
}
exports.exists = exists;
function isArray(value) {
    return Array.isArray(value);
}
exports.isArray = isArray;
function isDateValid(value) {
    return exists(value) && validator.isISO8601(value);
}
exports.isDateValid = isDateValid;
function isIdValid(value) {
    return exists(value) && validator.isInt('' + value);
}
exports.isIdValid = isIdValid;
function isUUIDValid(value) {
    return exists(value) && validator.isUUID('' + value, 4);
}
exports.isUUIDValid = isUUIDValid;
function isIdOrUUIDValid(value) {
    return isIdValid(value) || isUUIDValid(value);
}
exports.isIdOrUUIDValid = isIdOrUUIDValid;
function isBooleanValid(value) {
    return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value));
}
exports.isBooleanValid = isBooleanValid;
function toIntOrNull(value) {
    if (value === 'null')
        return null;
    return validator.toInt(value);
}
exports.toIntOrNull = toIntOrNull;
function toValueOrNull(value) {
    if (value === 'null')
        return null;
    return value;
}
exports.toValueOrNull = toValueOrNull;
function toArray(value) {
    if (value && isArray(value) === false)
        return [value];
    return value;
}
exports.toArray = toArray;
function isFileValid(files, mimeTypeRegex, field, maxSize, optional = false) {
    if (!files)
        return optional;
    if (isArray(files))
        return optional;
    const fileArray = files[field];
    if (!fileArray || fileArray.length === 0) {
        return optional;
    }
    const file = fileArray[0];
    if (!file || !file.originalname)
        return false;
    if ((maxSize !== null) && file.size > maxSize)
        return false;
    return new RegExp(`^${mimeTypeRegex}$`, 'i').test(file.mimetype);
}
exports.isFileValid = isFileValid;
