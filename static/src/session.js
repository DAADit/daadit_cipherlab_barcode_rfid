/** @odoo-module **/
import { decodeSGTIN96 } from "./epc";

export class RFIDSession {
    constructor(limit = 5000) {
        this.limit = limit;
        this.tags = new Map();
        this.duplicates = 0;
        this.rejected = 0;
        this.errors = [];
        this.running = false;
    }

    add(frames) {
        for (const frame of frames) {
            try {
                const tag = decodeSGTIN96(frame);
                if (this.tags.has(tag.uri)) {
                    this.duplicates++;
                } else if (this.tags.size >= this.limit) {
                    throw new Error("Scan limit reached. Finish this count before starting another.");
                } else {
                    this.tags.set(tag.uri, { ...tag, status: "pending", error: "" });
                }
            } catch (error) {
                this.rejected++;
                // Bounded diagnostics; never silently turn invalid data into a product scan.
                this.errors.unshift(`${frame.slice(0, 60)}: ${error.message}`);
                this.errors.length = Math.min(this.errors.length, 10);
            }
        }
    }

    summary() {
        const tags = [...this.tags.values()];
        return {
            unique: tags.length,
            accepted: tags.filter((tag) => tag.status === "accepted").length,
            failed: tags.filter((tag) => tag.status === "failed").length,
            pending: tags.filter((tag) => tag.status === "pending").length,
            duplicates: this.duplicates,
            rejected: this.rejected,
        };
    }

    async process(consume, progress = () => {}) {
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            for (const tag of [...this.tags.values()]) {
                if (tag.status === "accepted") {
                    continue;
                }
                try {
                    const accepted = await consume(tag);
                    tag.status = accepted ? "accepted" : "failed";
                    tag.error = accepted ? "" : "Odoo did not accept this EPC; check product, location and tracking.";
                } catch (error) {
                    tag.status = "failed";
                    tag.error = error.message || "Odoo processing failed.";
                    // A transport/server failure may have an uncertain outcome.
                    // Stop; an explicit retry first checks Odoo's native URI cache.
                    progress();
                    break;
                }
                progress();
            }
        } finally {
            this.running = false;
        }
    }
}
