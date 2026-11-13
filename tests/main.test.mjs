import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModule, epcURL, RFIDSession } from "./loader.mjs";

class Mutex {
    constructor() { this.tail = Promise.resolve(); }
    exec(fn) { const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result; }
}
class Main {
    setup() {
        this.state = { view: "barcodeLines", uiBlocked: false };
        this.resModel = "stock.quant";
        this.actionMutex = new Mutex();
        this.messages = [];
        this.notification = { add: (...args) => this.messages.push(args) };
    }
    onBarcodeScanned(value) { this.standardScan = value; }
    unblockUI() { this.state.uiBlocked = false; this.renderedCount = this.env.model.count; }
    exit() { this.exited = true; }
    validate() { this.validated = true; }
}

globalThis.__rs38Test = { Main, RFIDSession };
const moduleURL = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
await loadModule("../static/src/main.js", {
    "@odoo/owl": moduleURL("export const useState = x => x; export const useRef = () => ({el:null}); export const onWillUnmount = () => {};"),
    "@web/core/utils/patch": moduleURL(`export function patch(target, extension) {
        const parent = Object.create(Object.getPrototypeOf(target), Object.getOwnPropertyDescriptors(target));
        Object.setPrototypeOf(extension, parent);
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(extension));
    }`),
    "@web/core/l10n/translation": moduleURL("export const _t = x => x;"),
    "@stock_barcode/components/main": moduleURL("export default globalThis.__rs38Test.Main;"),
    "./epc": epcURL,
    "./session": moduleURL("export const RFIDSession = globalThis.__rs38Test.RFIDSession;"),
});

const a = "3034257BF7194E4000001A85";
const b = "3034257BF7194E4000001A86";
function makeComponent({ reject = false } = {}) {
    const component = new Main();
    component.setup();
    const cache = new Set();
    const model = {
        location: { id: 8 }, actionMutex: new Mutex(), count: 0,
        uriInCache: (uri) => cache.has(uri),
        async processBarcode(uri, options) {
            assert.equal(options.readingRFID, true);
            // Reproduce Odoo 19's scheduled (not awaited) mutation contract.
            this.actionMutex.exec(async () => {
                await new Promise((r) => setTimeout(r, 2));
                if (!reject) { this.count++; cache.add(uri); }
                component.unblockUI();
                assert.equal(component.state.uiBlocked, true);
            });
        },
    };
    component.env = { model };
    component.rs38Input.el = { value: "", focus() {} };
    component.rs38.enabled = true;
    return component;
}

test("bridge uses native URI processing, drains model mutex and deduplicates", async () => {
    const c = makeComponent();
    c.rs38Input.el.value = `${a};${a};${b};`;
    c.rs38OnInput();
    await c.rs38Process();
    assert.equal(c.env.model.count, 2);
    assert.equal(c.rs38.summary.accepted, 2);
    assert.equal(c.rs38.busy, false);
    assert.equal(c.state.uiBlocked, false);
    assert.equal(c.renderedCount, 2, "native unblocking refreshes the final child-line quantity");
    await c.rs38Process();
    assert.equal(c.env.model.count, 2);
});

test("a product rejected by Odoo is visibly retryable", async () => {
    const c = makeComponent({ reject: true }); c.rs38Add([a]);
    await c.rs38Process();
    assert.equal(c.rs38.summary.failed, 1);
    assert.equal(c.rs38.summary.accepted, 0);
    assert.match(c.rs38.errors[0], /did not accept/);
});

test("normal barcodes retain their original handler when mode is off", () => {
    const c = makeComponent(); c.rs38.enabled = false;
    c.onBarcodeScanned("123456789");
    assert.equal(c.standardScan, "123456789");
});

test("picking actions retain original handler even with flag set", () => {
    const c = makeComponent(); c.resModel = "stock.picking";
    c.onBarcodeScanned("123456789");
    assert.equal(c.standardScan, "123456789");
});

test("RS38 scanner event path collects a terminated batch", () => {
    const c = makeComponent(); c.onBarcodeScanned(`${a};${b};`);
    assert.equal(c.rs38.summary.unique, 2);
    assert.equal(c.standardScan, undefined);
});

test("pending tags prevent apply, exit and pause", async () => {
    const c = makeComponent(); c.rs38Add([a]);
    await c.validate(); await c.exit(); await c.rs38Toggle();
    assert.equal(c.validated, undefined); assert.equal(c.exited, undefined);
    assert.equal(c.rs38.enabled, true);
    c.rs38Discard();
    await c.validate(); await c.exit();
    assert.equal(c.validated, true); assert.equal(c.exited, true);
});

test("changed location cannot receive an earlier pending batch", async () => {
    const c = makeComponent(); c.rs38Add([a]);
    c.env.model.location.id = 9;
    await c.rs38Process();
    assert.equal(c.env.model.count, 0);
    assert.equal(c.rs38.summary.pending, 1);
});

test("missing location retains input and prevents processing", async () => {
    const c = makeComponent(); c.env.model.location = null;
    c.rs38Input.el.value = `${a};`;
    await c.rs38Process();
    assert.equal(c.rs38Input.el.value, `${a};`);
    assert.equal(c.env.model.count, 0);
});

test("input handler waits for complete frame; Enter stops propagation", () => {
    const c = makeComponent(); c.rs38Input.el.value = a.slice(0, 12);
    c.rs38OnInput(); assert.equal(c.rs38.summary.unique, 0);
    c.rs38Input.el.value += a.slice(12);
    let stopped = false; let prevented = false;
    c.rs38OnKeydown({ key: "Enter", stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } });
    assert.equal(c.rs38.summary.unique, 1);
    assert.equal(stopped && prevented, true);
});

test("discard pending tags never resets accepted identity cache", async () => {
    const c = makeComponent(); c.rs38Add([a]); await c.rs38Process();
    c.rs38Add([b]); c.rs38Discard(); c.rs38Add([a]);
    await c.rs38Process();
    assert.equal(c.env.model.count, 1);
});
