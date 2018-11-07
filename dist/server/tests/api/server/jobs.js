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
const chai = require("chai");
require("mocha");
const index_1 = require("../../utils/index");
const follows_1 = require("../../utils/server/follows");
const jobs_1 = require("../../utils/server/jobs");
const servers_1 = require("../../utils/server/servers");
const videos_1 = require("../../utils/videos/videos");
const miscs_1 = require("../../utils/miscs/miscs");
const expect = chai.expect;
describe('Test jobs', function () {
    let servers;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            servers = yield servers_1.flushAndRunMultipleServers(2);
            yield index_1.setAccessTokensToServers(servers);
            yield follows_1.doubleFollow(servers[0], servers[1]);
        });
    });
    it('Should create some jobs', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield videos_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video1' });
            yield videos_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video2' });
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should list jobs', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield jobs_1.getJobsList(servers[1].url, servers[1].accessToken, 'completed');
            expect(res.body.total).to.be.above(2);
            expect(res.body.data).to.have.length.above(2);
        });
    });
    it('Should list jobs with sort and pagination', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield jobs_1.getJobsListPaginationAndSort(servers[1].url, servers[1].accessToken, 'completed', 1, 2, 'createdAt');
            expect(res.body.total).to.be.above(2);
            expect(res.body.data).to.have.lengthOf(2);
            let job = res.body.data[0];
            if (job.type === 'videos-views')
                job = res.body.data[1];
            expect(job.state).to.equal('completed');
            expect(job.type).to.equal('activitypub-follow');
            expect(miscs_1.dateIsValid(job.createdAt)).to.be.true;
            expect(miscs_1.dateIsValid(job.processedOn)).to.be.true;
            expect(miscs_1.dateIsValid(job.finishedOn)).to.be.true;
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=jobs.js.map