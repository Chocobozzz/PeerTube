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
const initializers_1 = require("../../initializers");
const requests_1 = require("../../helpers/requests");
const logger_1 = require("../../helpers/logger");
function crawlCollectionPage(uri, handler) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Crawling ActivityPub data on %s.', uri);
        const options = {
            method: 'GET',
            uri,
            json: true,
            activityPub: true,
            timeout: initializers_1.JOB_REQUEST_TIMEOUT
        };
        const response = yield requests_1.doRequest(options);
        const firstBody = response.body;
        let limit = initializers_1.ACTIVITY_PUB.FETCH_PAGE_LIMIT;
        let i = 0;
        let nextLink = firstBody.first;
        while (nextLink && i < limit) {
            options.uri = nextLink;
            const { body } = yield requests_1.doRequest(options);
            nextLink = body.next;
            i++;
            if (Array.isArray(body.orderedItems)) {
                const items = body.orderedItems;
                logger_1.logger.info('Processing %i ActivityPub items for %s.', items.length, options.uri);
                yield handler(items);
            }
        }
    });
}
exports.crawlCollectionPage = crawlCollectionPage;
