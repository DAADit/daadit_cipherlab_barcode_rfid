import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSGTIN96, splitFrames } from "../static/src/epc.js";

test("known SGTIN-96 vector retains company prefix zero and serial", () => {
    const tag = decodeSGTIN96("3034257BF7194E4000001A85");
    assert.equal(tag.uri, "urn:epc:id:sgtin:0614141.812345.6789");
    assert.equal(tag.gtin, "80614141123458");
    assert.equal(tag.serial, "6789");
});

test("normalizes lower case and optional 0x", () => {
    assert.equal(decodeSGTIN96(" 0x3034257bf7194e4000001a85 ").hex, "3034257BF7194E4000001A85");
});

test("filter does not change identity", () => {
    assert.equal(decodeSGTIN96("3014257BF7194E4000001A85").uri, decodeSGTIN96("3034257BF7194E4000001A85").uri);
});

const partitions = [[40,12,4,1],[37,11,7,2],[34,10,10,3],[30,9,14,4],[27,8,17,5],[24,7,20,6],[20,6,24,7]];
for (let p = 0; p < partitions.length; p++) {
    test(`partition ${p}: maximum decimal fields and 38-bit serial`, () => {
        const [, companyDigits, itemBits, itemDigits] = partitions[p];
        const company = 10n ** BigInt(companyDigits) - 1n;
        const item = 10n ** BigInt(itemDigits) - 1n;
        const serial = (1n << 38n) - 1n;
        const value = (0x30n << 88n) | (BigInt(p) << 82n) | (company << BigInt(38 + itemBits)) | (item << 38n) | serial;
        const decoded = decodeSGTIN96(value.toString(16));
        assert.equal(decoded.uri, `urn:epc:id:sgtin:${company}.${item}.${serial}`);
        assert.equal(decoded.serial, "274877906943");
    });
}

test("rejects malformed, unsupported, partition 7 and decimal overflow", () => {
    for (const input of ["", "123", "Z".repeat(24), "31" + "0".repeat(22), "301C" + "0".repeat(20), "301BFFFFFFFFFFFFFFFFFFFF"]) {
        assert.throws(() => decodeSGTIN96(input), input);
    }
});

test("framing keeps an incomplete tail and accepts multiple terminators", () => {
    assert.deepEqual(splitFrames("a;b\r\n;c\td"), { frames: ["a", "b", "c"], remainder: "d" });
    assert.deepEqual(splitFrames("abc"), { frames: [], remainder: "abc" });
    assert.deepEqual(splitFrames("abc", true), { frames: ["abc"], remainder: "" });
});

test("an interrupted scan is not accepted until a terminator arrives", () => {
    const a = splitFrames("3034257BF719");
    const b = splitFrames(a.remainder + "4E4000001A85;");
    assert.equal(a.frames.length, 0);
    assert.equal(decodeSGTIN96(b.frames[0]).serial, "6789");
});
