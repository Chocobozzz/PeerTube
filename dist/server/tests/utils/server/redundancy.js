"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const requests_1 = require("../requests/requests");
function updateRedundancy(url, accessToken, host, redundancyAllowed, expectedStatus = 204) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = '/api/v1/server/redundancy/' + host;
        return requests_1.makePutBodyRequest({
            url,
            path,
            token: accessToken,
            fields: { redundancyAllowed },
            statusCodeExpected: expectedStatus
        });
    });
}
exports.updateRedundancy = updateRedundancy;
