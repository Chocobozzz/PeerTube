"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function activityPubResponse(data, res) {
    return res.type('application/activity+json; charset=utf-8')
        .json(data)
        .end();
}
exports.activityPubResponse = activityPubResponse;
