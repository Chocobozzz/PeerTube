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
const core_utils_1 = require("../../helpers/core-utils");
const expect = chai.expect;
describe('Parse Bytes', function () {
    it('Should pass when given valid value', function () {
        return __awaiter(this, void 0, void 0, function* () {
            expect(core_utils_1.parseBytes(1024)).to.be.eq(1024);
            expect(core_utils_1.parseBytes(1048576)).to.be.eq(1048576);
            expect(core_utils_1.parseBytes('1024')).to.be.eq(1024);
            expect(core_utils_1.parseBytes('1048576')).to.be.eq(1048576);
            expect(core_utils_1.parseBytes('1B')).to.be.eq(1024);
            expect(core_utils_1.parseBytes('1MB')).to.be.eq(1048576);
            expect(core_utils_1.parseBytes('1GB')).to.be.eq(1073741824);
            expect(core_utils_1.parseBytes('1TB')).to.be.eq(1099511627776);
            expect(core_utils_1.parseBytes('5GB')).to.be.eq(5368709120);
            expect(core_utils_1.parseBytes('5TB')).to.be.eq(5497558138880);
            expect(core_utils_1.parseBytes('1024B')).to.be.eq(1048576);
            expect(core_utils_1.parseBytes('1024MB')).to.be.eq(1073741824);
            expect(core_utils_1.parseBytes('1024GB')).to.be.eq(1099511627776);
            expect(core_utils_1.parseBytes('1024TB')).to.be.eq(1125899906842624);
            expect(core_utils_1.parseBytes('1 GB')).to.be.eq(1073741824);
            expect(core_utils_1.parseBytes('1\tGB')).to.be.eq(1073741824);
            expect(core_utils_1.parseBytes('1TB 1024MB')).to.be.eq(1100585369600);
            expect(core_utils_1.parseBytes('4GB 1024MB')).to.be.eq(5368709120);
            expect(core_utils_1.parseBytes('4TB 1024GB')).to.be.eq(5497558138880);
            expect(core_utils_1.parseBytes('4TB 1024GB 0MB')).to.be.eq(5497558138880);
            expect(core_utils_1.parseBytes('1024TB 1024GB 1024MB')).to.be.eq(1127000492212224);
        });
    });
    it('Should be invalid when given invalid value', function () {
        return __awaiter(this, void 0, void 0, function* () {
            expect(core_utils_1.parseBytes('6GB 1GB')).to.be.eq(6);
        });
    });
});
