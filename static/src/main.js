/** @odoo-module **/
import { onWillUnmount, useRef, useState } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import MainComponent from "@stock_barcode/components/main";
import { splitFrames } from "./epc";
import { RFIDSession } from "./session";

patch(MainComponent.prototype, {
    setup() {
        super.setup(...arguments);
        this.rs38Input = useRef("rs38Input");
        this.rs38Session = new RFIDSession();
        this.rs38 = useState({ enabled: false, busy: false, summary: {}, errors: [] });
        this.rs38Alive = true;
        onWillUnmount(() => { this.rs38Alive = false; });
        this.rs38Refresh();
    },

    rs38Refresh() {
        if (!this.rs38Alive) {
            return;
        }
        this.rs38.summary = this.rs38Session.summary();
        this.rs38.errors = [
            ...this.rs38Session.errors,
            ...[...this.rs38Session.tags.values()]
                .filter((tag) => tag.status === "failed")
                .slice(0, 10).map((tag) => `${tag.hex}: ${tag.error}`),
        ].slice(0, 10);
    },

    rs38Add(frames) {
        const locationId = this.env.model.location?.id;
        const { pending, failed } = this.rs38Session.summary();
        if (!(pending || failed)) {
            this.rs38LocationId = locationId;
        }
        if (!locationId || this.rs38LocationId !== locationId) {
            this.notification.add(_t("Select the original scan location, or discard pending scans first."), { type: "warning" });
            return false;
        }
        this.rs38Session.add(frames);
        this.rs38Refresh();
        return true;
    },

    async rs38Toggle() {
        if (this.rs38.busy) {
            return;
        }
        // Refuse to discard a partial scanner transmission when closing the panel.
        if (this.rs38.enabled && this.rs38Input.el?.value.trim()) {
            this.notification.add(_t("Finish or clear the RFID input first."), { type: "warning" });
            return;
        }
        const { pending, failed } = this.rs38Session.summary();
        if (this.rs38.enabled && (pending || failed)) {
            this.notification.add(_t("Process or discard the pending EPCs before pausing RFID."), { type: "warning" });
            return;
        }
        this.rs38.enabled = !this.rs38.enabled;
        if (this.rs38.enabled) {
            requestAnimationFrame(() => this.rs38Alive && this.rs38Focus());
        }
    },

    rs38Focus() {
        this.rs38Input.el?.focus();
    },

    rs38Discard() {
        if (this.rs38.busy) {
            return;
        }
        for (const [uri, tag] of this.rs38Session.tags) {
            if (tag.status !== "accepted") {
                this.rs38Session.tags.delete(uri);
            }
        }
        if (this.rs38Input.el) {
            this.rs38Input.el.value = "";
        }
        this.rs38Refresh();
    },

    rs38Capture(flush = false) {
        const input = this.rs38Input.el;
        if (!input || this.rs38.busy) {
            return;
        }
        const { frames, remainder } = splitFrames(input.value, flush);
        if (this.rs38Add(frames)) {
            input.value = remainder;
        }
    },

    rs38OnInput() {
        this.rs38Capture();
    },

    rs38OnKeydown(ev) {
        // Prevent the standard barcode service from also consuming this input.
        ev.stopPropagation();
        if (ev.key === "Enter" || ev.key === "Tab") {
            ev.preventDefault();
            this.rs38Capture(true);
        }
    },

    async rs38Process() {
        if (this.rs38.busy || this.resModel !== "stock.quant") {
            return;
        }
        this.rs38Capture(true);
        const model = this.env.model;
        if (!model.location?.id || this.rs38LocationId !== model.location.id) {
            this.notification.add(_t("Select the original scan location before processing RFID tags."), { type: "warning" });
            return;
        }
        if (typeof model.uriInCache !== "function" || !model.actionMutex?.exec) {
            this.notification.add(_t("This Barcode build is not compatible with the RS38 adapter."), { type: "danger" });
            return;
        }
        this.rs38.busy = true;
        // Block native line edits, location changes and validation while the batch
        // is processed. Count quantities remain subject to Odoo's Apply action.
        this.state.uiBlocked = true;
        try {
            await this.actionMutex.exec(async () => {
                await this.rs38Session.process(async (tag) => {
                    if (!this.rs38Alive) {
                        throw new Error("Barcode screen closed; remaining EPCs were not processed.");
                    }
                    if (model.uriInCache(tag.uri)) {
                        return true;
                    }
                    await model.processBarcode(tag.uri, { readingRFID: true });
                    // Odoo 19 processBarcode schedules its mutations on another
                    // mutex without awaiting them. Drain it before the next tag.
                    await model.actionMutex.exec(() => {});
                    return model.uriInCache(tag.uri);
                }, () => this.rs38Refresh());
            });
        } finally {
            if (this.rs38Alive) {
                this.rs38.busy = false;
                // Native unblockUI forces child line components to render too.
                // Updating reactive panel state alone leaves their quantities stale.
                this.unblockUI();
                this.rs38Refresh();
                this.rs38Focus();
            }
        }
    },

    unblockUI() {
        if (!this.rs38?.busy) {
            return super.unblockUI(...arguments);
        }
    },

    async exit() {
        if (this.rs38?.busy || this.rs38Session.summary().pending || this.rs38Session.summary().failed || this.rs38Input.el?.value.trim()) {
            this.notification.add(_t("Process or discard the pending EPCs before leaving."), { type: "warning" });
            return;
        }
        return super.exit(...arguments);
    },

    async validate() {
        if (this.rs38?.busy || this.rs38Session.summary().pending || this.rs38Session.summary().failed || this.rs38Input.el?.value.trim()) {
            this.notification.add(_t("Process or discard the pending EPCs before applying the count."), { type: "warning" });
            return;
        }
        return super.validate(...arguments);
    },

    onBarcodeScanned(barcode) {
        if (this.rs38.enabled && this.resModel === "stock.quant" && this.state.view === "barcodeLines") {
            if (!this.rs38.busy) {
                this.rs38Add(splitFrames(barcode || "", true).frames);
            } else {
                this.notification.add(_t("RFID batch is processing. Scan again when it finishes."), { type: "warning" });
            }
            return;
        }
        return super.onBarcodeScanned(...arguments);
    },
});
