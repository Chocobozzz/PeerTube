"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = require("./misc");
const jobStates = ['active', 'completed', 'failed', 'waiting', 'delayed'];
function isValidJobState(value) {
    return misc_1.exists(value) && jobStates.indexOf(value) !== -1;
}
exports.isValidJobState = isValidJobState;
