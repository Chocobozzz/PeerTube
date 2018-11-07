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
const logger_1 = require("../../../helpers/logger");
const emailer_1 = require("../../emailer");
function processEmail(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = job.data;
        logger_1.logger.info('Processing email in job %d.', job.id);
        return emailer_1.Emailer.Instance.sendMail(payload.to, payload.subject, payload.text);
    });
}
exports.processEmail = processEmail;
