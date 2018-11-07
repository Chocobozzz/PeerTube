"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("express-validator");
require("multer");
const validator = require("validator");
const initializers_1 = require("../../initializers");
const VIDEO_COMMENTS_CONSTRAINTS_FIELDS = initializers_1.CONSTRAINTS_FIELDS.VIDEO_COMMENTS;
function isValidVideoCommentText(value) {
    return value === null || validator.isLength(value, VIDEO_COMMENTS_CONSTRAINTS_FIELDS.TEXT);
}
exports.isValidVideoCommentText = isValidVideoCommentText;
