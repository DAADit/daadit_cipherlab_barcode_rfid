import { test } from "node:test";
import assert from "node:assert/strict";
import { RFIDSession } from "./loader.mjs";
const a = "3034257BF7194E4000001A85";
const b = "3034257BF7194E4000001A86";

test("deduplicates identity within and across scanner bursts", async () => {
    const s = new RFIDSession();
    s.add([a, a.toLowerCase(), b, "3014257BF7194E4000001A85"]);
    const processed = [];
    await s.process(async (tag) => { processed.push(tag.uri); return true; });
    s.add([a, b]);
    await s.process(async () => assert.fail("already accepted tag processed twice"));
    assert.equal(processed.length, 2);
    assert.equal(s.summary().duplicates, 4);
    assert.equal(s.summary().accepted, 2);
});

test("unknown product remains retryable instead of being marked counted", async () => {
    const s = new RFIDSession(); s.add([a]);
    await s.process(async () => false);
    assert.equal(s.summary().failed, 1);
    await s.process(async () => true);
    assert.equal(s.summary().accepted, 1);
    assert.equal(s.summary().failed, 0);
});

test("server failure stops batch; accepted tags are not repeated on retry", async () => {
    const s = new RFIDSession(); s.add([a, b]);
    let n = 0;
    await s.process(async () => { if (++n === 2) throw Error("network"); return true; });
    assert.equal(s.summary().accepted, 1);
    assert.equal(s.summary().failed, 1);
    await s.process(async (tag) => { assert.equal(tag.hex, b); return true; });
    assert.equal(s.summary().accepted, 2);
});

test("concurrent process requests cannot double count", async () => {
    const s = new RFIDSession(); s.add([a, b]);
    let n = 0;
    const consume = async () => { n++; await new Promise((r) => setTimeout(r, 5)); return true; };
    await Promise.all([s.process(consume), s.process(consume)]);
    assert.equal(n, 2);
});

test("serial consumption prevents overtaking slow scans", async () => {
    const s = new RFIDSession(); s.add([a, b]);
    let running = false;
    await s.process(async () => { assert.equal(running, false); running = true; await Promise.resolve(); running = false; return true; });
});

test("bounded scans and diagnostics report overflow and invalid tags", () => {
    const s = new RFIDSession(1); s.add([a, b, ...Array(15).fill("invalid")]);
    assert.equal(s.summary().unique, 1);
    assert.equal(s.summary().rejected, 16);
    assert.equal(s.errors.length, 10);
});
