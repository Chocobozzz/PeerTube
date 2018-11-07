"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Bluebird = require("bluebird");
const fs_extra_1 = require("fs-extra");
const request = require("request");
const initializers_1 = require("../initializers");
function doRequest(requestOptions) {
    if (requestOptions.activityPub === true) {
        if (!Array.isArray(requestOptions.headers))
            requestOptions.headers = {};
        requestOptions.headers['accept'] = initializers_1.ACTIVITY_PUB.ACCEPT_HEADER;
    }
    return new Bluebird((res, rej) => {
        request(requestOptions, (err, response, body) => err ? rej(err) : res({ response, body }));
    });
}
exports.doRequest = doRequest;
function doRequestAndSaveToFile(requestOptions, destPath) {
    return new Bluebird((res, rej) => {
        const file = fs_extra_1.createWriteStream(destPath);
        file.on('finish', () => res());
        request(requestOptions)
            .on('error', err => rej(err))
            .pipe(file);
    });
}
exports.doRequestAndSaveToFile = doRequestAndSaveToFile;
//# sourceMappingURL=requests.js.map