import BarcodePickingModel from "@stock_barcode/models/barcode_picking_model";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

// Separators an RFID reader may send around or between tags.
const SEPARATORS = /[;,]+/;
// Shape of an RFID EPC (any hexadecimal run of 20 characters or more, e.g.
// 96, 128 or 160 bit) with at least one letter, so that numeric product
// barcodes are never mistaken for a tag.
const RFID_SHAPE = /^[0-9A-F]{20,}$/;
const HAS_HEX_LETTER = /[A-F]/;

// The tag pattern comes from the company settings (prefix and length);
// without a prefix the RFID handling stays off.
function compilePattern(pattern) {
    if (!pattern) {
        return null;
    }
    try {
        return new RegExp(pattern);
    } catch {
        return null;
    }
}

patch(BarcodePickingModel.prototype, {
    /** Settings of the operation's company, read once per operation. */
    async _clRfidLoadConfig() {
        if (!this._clRfidConfigPromise) {
            this._clRfidConfigPromise = this.orm
                .call("stock.lot", "cipherlab_rfid_config", [this._getCompanyId() || false])
                .catch(() => ({}))
                .then((config) => {
                    this._clRfidConfig = {
                        oneTagPerProductScan: config.one_tag_per_product_scan !== false,
                        blockForeignTags: config.block_foreign_tags !== false,
                        captureTextInput: config.capture_text_input !== false,
                        prefix: config.prefix || "",
                        prefixes: (config.prefixes || [config.prefix]).filter(Boolean),
                        length: config.length || 0,
                        regex: compilePattern(config.tag_pattern),
                    };
                    return this._clRfidConfig;
                });
        }
        return this._clRfidConfigPromise;
    },

    _clIsRfidTag(code) {
        const regex = this._clRfidConfig?.regex;
        return Boolean(code && regex) && regex.test(code);
    },

    /** A code shaped like an RFID tag that is not one of ours (other prefix). */
    _clIsForeignTag(code) {
        if (!this._clRfidConfig?.blockForeignTags || !code) {
            return false;
        }
        const upper = code.toUpperCase();
        return (
            RFID_SHAPE.test(upper) && HAS_HEX_LETTER.test(upper) && !this._clIsRfidTag(upper)
        );
    },

    /**
     * Reader apps that type the tags as text (Multi-Tag Output) do not type a
     * separator between tags, and the browser delivers the text in arbitrary
     * pieces, so several tags can arrive glued together in one token. With a
     * fixed tag length (company setting) every occurrence of our pattern is cut
     * out; whatever remains between them is kept as its own token (other tags).
     */
    _clSplitGlued(token) {
        const prefixes = this._clRfidConfig?.prefixes || [];
        const length = this._clRfidConfig?.length || 0;
        const upper = token.toUpperCase();
        if (!prefixes.length || !/^[0-9A-F]{21,}$/.test(upper)) {
            return [token];
        }
        const parts = [];
        if (length > 0) {
            // Fixed length: cut out every occurrence of "prefix + rest".
            if (upper.length <= length) {
                return [token];
            }
            const alternatives = prefixes
                .filter((p) => length > p.length)
                .map((p) => p + "[0-9A-F]{" + (length - p.length) + "}");
            if (!alternatives.length) {
                return [token];
            }
            const re = new RegExp("(?:" + alternatives.join("|") + ")", "g");
            let last = 0;
            for (const m of upper.matchAll(re)) {
                if (m.index > last) {
                    parts.push(upper.slice(last, m.index));
                }
                parts.push(m[0]);
                last = m.index + m[0].length;
            }
            if (last < upper.length) {
                parts.push(upper.slice(last));
            }
            return parts.length ? parts : [token];
        }
        // Variable length: a new tag starts where a prefix appears, once the
        // current piece is long enough to be a tag itself (20 hex characters).
        // Mixed-length tags are best separated by the reader (End Character ";").
        let start = 0;
        for (let i = 20; i < upper.length; i++) {
            if (i - start >= 20 && prefixes.some((p) => upper.startsWith(p, i))) {
                parts.push(upper.slice(start, i));
                start = i;
            }
        }
        parts.push(upper.slice(start));
        return parts;
    },

    _clNormalize(token) {
        const trimmed = token.trim();
        const upper = trimmed.toUpperCase();
        return this._clIsRfidTag(upper) ? upper : trimmed;
    },

    /**
     * The line an RFID tag is linked to: the line the operator selected, or the
     * line of the product scanned just before. With "one tag per product scan"
     * the operator must scan or select the product again before each tag.
     */
    _clRfidTargetLine() {
        const isTracked = (line) => line && line.product_id.tracking !== "none";
        if (this._clRfidConfig?.oneTagPerProductScan !== false && !this._clRfidArmed) {
            return false;
        }
        if (isTracked(this.selectedLine)) {
            return this.selectedLine;
        }
        if (isTracked(this.lastScannedLine)) {
            return this.lastScannedLine;
        }
        return false;
    },

    selectLine(line) {
        super.selectLine(...arguments);
        if (this.selectedLine && this.selectedLine.product_id.tracking !== "none") {
            this._clRfidArmed = true;
        }
    },

    _clIsDelivery() {
        return this.record?.picking_type_code === "outgoing";
    },

    /**
     * Deliveries work with tags that are already serial numbers, so several tags
     * may be read at once. Receipts link new tags to items: one tag at a time,
     * unless "one tag per product scan" is switched off; then every tag read in
     * one trigger press becomes a serial number of the selected product line.
     */
    _clRfidAllowsMultipleTags() {
        return this._clIsDelivery() || this._clRfidConfig?.oneTagPerProductScan === false;
    },

    /** The tag is already scanned in this operation. */
    _clRfidTagIsDone(tag) {
        return this.currentState.lines.some((l) => this.getlotName(l) === tag && this.getQtyDone(l));
    },

    /**
     * Several of our tags read at once on a delivery: each tag is processed as
     * its own scan. Tags already scanned in this operation are skipped quietly,
     * because a reader keeps sending the tags in range.
     */
    async _clProcessMultipleTags(tags, foreign, options) {
        const newTags = tags.filter((tag) => !this._clRfidTagIsDone(tag));
        const stats = { unknown: 0, not_in_delivery: 0, complete: 0 };
        this._clMultiStats = stats;
        for (const tag of newTags) {
            await super.processBarcode(tag, options);
        }
        // The tags are processed in the action mutex, after this method (which
        // itself runs in that mutex) returns: queue the summary behind them.
        this.actionMutex.exec(() => {
            if (this._clMultiStats === stats) {
                this._clMultiStats = null;
            }
            const refused = stats.unknown + stats.not_in_delivery + stats.complete;
            const parts = [
                _t("%(count)s RFID tags read, %(added)s added.", {
                    count: tags.length,
                    added: newTags.length - refused,
                }),
            ];
            const skipped = tags.length - newTags.length;
            if (skipped) {
                parts.push(_t("%(count)s already scanned.", { count: skipped }));
            }
            if (stats.not_in_delivery) {
                parts.push(_t("%(count)s not on this delivery.", { count: stats.not_in_delivery }));
            }
            if (stats.complete) {
                parts.push(_t("%(count)s above the ordered quantity.", { count: stats.complete }));
            }
            if (stats.unknown) {
                parts.push(_t("%(count)s unknown.", { count: stats.unknown }));
            }
            if (foreign.length) {
                parts.push(_t("%(count)s other tags ignored.", { count: foreign.length }));
            }
            this.notification(parts.join(" "), { type: refused ? "warning" : "info" });
        });
    },

    /**
     * Why a known tag cannot be added to this delivery, or "" when it can:
     * its product is not on the delivery, or the ordered quantity is complete.
     * Keeps tags of neighbouring goods (another project) off the delivery.
     */
    _clDeliveryRefusal(productId) {
        const moves = (this.record.move_ids || [])
            .map((id) => this.cache.getRecord("stock.move", id))
            .filter((move) => move && move.product_id === productId);
        if (!moves.length) {
            return "not_in_delivery";
        }
        const demand = moves.reduce((sum, move) => sum + (move.product_uom_qty || 0), 0);
        const done = this.currentState.lines
            .filter((line) => line.product_id.id === productId)
            .reduce((sum, line) => sum + (this.getQtyDone(line) || 0), 0);
        return demand && done >= demand ? "complete" : "";
    },

    /** Refuse a tag on a delivery: counted during a multi-tag read, else notified. */
    _clRefuseDeliveryTag(tag, reason, productName) {
        if (this._clMultiStats) {
            this._clMultiStats[reason]++;
            return;
        }
        const messages = {
            unknown: _t("RFID tag %(tag)s is unknown: it was never received as a serial number.", {
                tag,
            }),
            not_in_delivery: _t(
                "RFID tag %(tag)s belongs to %(product)s, which is not on this delivery.",
                { tag, product: productName }
            ),
            complete: _t(
                "%(product)s is already complete on this delivery: tag %(tag)s was not added.",
                { tag, product: productName }
            ),
        };
        return this.notification(messages[reason], { type: "danger" });
    },

    async processBarcode(barcode, options = {}) {
        if (barcode && !options.readingRFID) {
            await this._clRfidLoadConfig();
        }
        if (barcode && !options.readingRFID && this._clRfidConfig?.regex) {
            const tokens = barcode
                .split(SEPARATORS)
                .flatMap((token) => this._clSplitGlued(token.trim()))
                .map((token) => this._clNormalize(token))
                .filter(Boolean);
            const foreign = tokens.filter((token) => this._clIsForeignTag(token));
            const tags = [...new Set(tokens.filter((token) => this._clIsRfidTag(token)))];
            if (foreign.length && !tags.length) {
                // Only someone else's tag was read (neighbouring goods, supplier tag).
                this.notification(
                    _t(
                        "%(code)s is not one of our RFID tags (they start with %(prefix)s). Hold the reader against the item's own tag and scan again.",
                        { code: foreign[0].toUpperCase(), prefix: this._clRfidConfig.prefix }
                    ),
                    { type: "danger" }
                );
                return;
            }
            if (tags.length > 1 && this._clRfidAllowsMultipleTags()) {
                return this._clProcessMultipleTags(tags, foreign, options);
            }
            if (tags.length > 1) {
                this.notification(
                    _t(
                        "%(count)s RFID tags were read at once. Hold the reader against one item and scan again.",
                        { count: tags.length }
                    ),
                    { type: "danger" }
                );
                return;
            }
            if (
                tags.length === 1 &&
                tokens.every((token) => token === tags[0] || this._clIsForeignTag(token))
            ) {
                // "TAG;", "TAG;TAG;" or our tag plus someone else's: process our tag once.
                barcode = tags[0];
            } else if (tokens.length === 1) {
                // Any single code with a trailing separator, e.g. "AV12775;".
                barcode = tokens[0];
            }
        }
        return super.processBarcode(barcode, options);
    },

    async _processBarcode(barcode) {
        if (!this._clIsRfidTag(barcode)) {
            const result = await super._processBarcode(...arguments);
            if (this.selectedLine && this.selectedLine.product_id.tracking !== "none") {
                this._clRfidArmed = true;
            }
            return result;
        }
        await this._clRfidLoadConfig();
        const usedLine = this.currentState.lines.find(
            (l) => this.getlotName(l) === barcode && this.getQtyDone(l)
        );
        if (usedLine) {
            return this.notification(
                _t("RFID tag %(tag)s is already used in this operation for %(product)s.", {
                    tag: barcode,
                    product: usedLine.product_id.display_name,
                }),
                { type: "danger" }
            );
        }
        const line = this._clRfidTargetLine();
        const lookup = await this.orm.call("stock.lot", "cipherlab_rfid_lookup", [
            barcode,
            line ? line.product_id.id : false,
            this._getCompanyId() || false,
        ]);
        if (lookup.conflict) {
            return this.notification(
                _t("RFID tag %(tag)s is already linked to %(product)s. Use a new tag.", {
                    tag: barcode,
                    product: lookup.product_name,
                }),
                { type: "danger" }
            );
        }
        if (this._clIsDelivery()) {
            // A delivery never creates tags, and only takes tags of its own products.
            if (!lookup.exists) {
                return this._clRefuseDeliveryTag(barcode, "unknown");
            }
            const refusal = this._clDeliveryRefusal(lookup.product_id);
            if (refusal) {
                return this._clRefuseDeliveryTag(barcode, refusal, lookup.product_name);
            }
        }
        if (lookup.exists && this.useExistingLots && !line) {
            // Known tag (delivery, return): the tag itself tells which product it is.
            const result = await super._processBarcode(...arguments);
            this._clRfidRelease();
            return result;
        }
        if (!line) {
            return this.notification(
                _t("Scan or select the item first, then scan the RFID tag."),
                { type: "danger" }
            );
        }
        // Make sure the standard flow links the tag to this line.
        if (!this.selectedLine || this.selectedLine.virtual_id !== line.virtual_id) {
            this._selectLine(line);
        }
        const result = await super._processBarcode(...arguments);
        this._clRfidRelease();
        return result;
    },

    /** With "one tag per product scan", the next tag needs a new product scan. */
    _clRfidRelease() {
        if (this._clRfidConfig?.oneTagPerProductScan !== false) {
            this._clRfidArmed = false;
            this.selectedLineVirtualId = false;
            this.lastScanned.product = false;
            this.trigger("update");
        }
    },
});
