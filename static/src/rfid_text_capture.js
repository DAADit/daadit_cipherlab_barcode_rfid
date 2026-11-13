import MainComponent from "@stock_barcode/components/main";
import { isMobileOS } from "@web/core/browser/feature_detection";
import { appTranslateFn } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";

const _t = (str, ...args) => appTranslateFn(str, "daadit_cipherlab_barcode_rfid", ...args);

// Some RFID reader apps (e.g. CipherLab Multi-Tag Output on the RS38) do not
// send key presses: they write the tags as text into the focused input field
// through Android accessibility, followed by the configured end character
// (";" or Enter). The Barcode app only listens
// to key presses, so that text was lost.
//
// Android accessibility only writes into a field it can see: not into an
// invisible, aria-hidden field behind the page. So the field is a small but
// visible bar at the bottom of the Barcode screen. It keeps the focus (unless
// the user is typing in another field), can be tapped to activate it, and
// shows what was last received, so a scanner test shows at once whether the
// reader app delivers anything.

const TERMINATOR = /[;,\r\n ]$/;
// Between tags the reader app may send ";", ",", Enter or Space; the Barcode
// model splits on ";" and ",", so line breaks and spaces are normalised to ";".
const INNER_SEPARATORS = /[\r\n\s]+/g;
const EDGE_SEPARATORS = /^[;,\s]+|[;,\s]+$/g;
// Text without a terminator (e.g. key presses from a normal scanner) is
// handled once no character arrived for this long.
const IDLE_MS = 250;
const REFOCUS_MS = 400;

/**
 * Turns the text a reader app types into the RFID field into one scan; pure,
 * so it can be tested. Multi-Tag Output types the tags as text without a
 * separator, and the browser delivers that text in arbitrary pieces, so the
 * pieces are concatenated as they are; the Barcode model cuts glued tags apart
 * on the configured tag pattern. A terminator (";", ",", Enter, Space) flushes
 * at once; otherwise the scan is handed over once no text arrived for IDLE_MS.
 */
export class RfidTextBuffer {
    constructor(onScan) {
        this.onScan = onScan;
        this.timer = null;
        this.chunks = [];
        this.lastValue = "";
    }

    /** Called with the full field value after every change; returns true when flushed. */
    update(value) {
        clearTimeout(this.timer);
        const delta = value.startsWith(this.lastValue) ? value.slice(this.lastValue.length) : value;
        this.lastValue = value;
        const chunk = delta.replace(EDGE_SEPARATORS, "").replace(INNER_SEPARATORS, ";");
        if (chunk) {
            this.chunks.push(chunk);
        }
        if (TERMINATOR.test(value)) {
            this.flush();
            return true;
        }
        this.timer = setTimeout(() => this.flush(), IDLE_MS);
        return false;
    }

    /** Hands over the collected text as one scan; real separators are kept. */
    flush(value) {
        clearTimeout(this.timer);
        this.timer = null;
        if (value !== undefined && !this.chunks.length) {
            const chunk = (value || "").replace(EDGE_SEPARATORS, "").replace(INNER_SEPARATORS, ";");
            if (chunk) {
                this.chunks.push(chunk);
            }
        }
        const code = this.chunks.join("");
        this.chunks = [];
        this.lastValue = "";
        if (code.length >= 3) {
            this.onScan(code);
        }
    }

    cancel() {
        clearTimeout(this.timer);
        this.chunks = [];
        this.lastValue = "";
    }
}

/** A field the user is working in: never take the focus away from it. */
function isUserField(element) {
    return (
        Boolean(element) &&
        element.matches('input,textarea,select,[contenteditable="true"]') &&
        // The hidden input of the standard barcode service on mobile is not a
        // user field; RFID text written there would be lost.
        !element.classList.contains("o-barcode-input")
    );
}

function buildBar() {
    const bar = document.createElement("div");
    bar.className =
        "o_cipherlab_rfid_bar d-flex align-items-center gap-2 px-2 py-1 border rounded bg-white small";
    bar.setAttribute(
        "style",
        "position:fixed;left:8px;right:8px;bottom:72px;z-index:1040;box-shadow:0 1px 4px rgba(0,0,0,.25);"
    );

    const label = document.createElement("label");
    label.className = "mb-0 fw-bold text-nowrap";
    label.textContent = _t("RFID");

    // A <textarea>, not an <input type="text">: a text input silently drops the
    // line breaks that a reader app sends as end character (Multi-Tag Output
    // "Enter"), so several tags would arrive glued together as one code.
    const input = document.createElement("textarea");
    input.rows = 1;
    input.className = "o_cipherlab_rfid_text_input form-control form-control-sm";
    input.setAttribute("style", "resize:none;overflow:hidden;white-space:pre;");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    // No inputmode="none": with it, Chromium gives the field no input connection
    // and the reader app cannot type into it (verified on the RS36, 13-11-2026).
    // Use the CipherLab Null Keyboard on the handheld to keep the screen keyboard away.
    input.setAttribute("placeholder", _t("Tap here, then press the scanner trigger"));
    input.setAttribute("aria-label", _t("RFID scanner input"));
    label.htmlFor = input.id = "o_cipherlab_rfid_text_input";

    const status = document.createElement("span");
    status.className = "o_cipherlab_rfid_status text-muted text-truncate";
    status.setAttribute("style", "max-width:40%;");
    status.setAttribute("role", "status");
    status.textContent = _t("Nothing received yet");

    bar.append(label, input, status);
    return { bar, input, status };
}

patch(MainComponent.prototype, {
    setup() {
        super.setup(...arguments);
        onMounted(() => this._clStartTextCapture());
        onWillUnmount(() => this._clStopTextCapture());
    },

    async _clStartTextCapture() {
        let enabled = isMobileOS();
        if (this.env.model._clRfidLoadConfig) {
            const config = await this.env.model._clRfidLoadConfig();
            enabled = enabled && config.captureTextInput !== false;
        }
        if (!enabled || this._clTextInput) {
            return;
        }
        const { bar, input, status } = buildBar();
        document.body.appendChild(bar);

        const buffer = new RfidTextBuffer((code) => {
            input.value = "";
            const time = new Date().toLocaleTimeString();
            status.textContent = _t("Received %(time)s: %(code)s", {
                time,
                code: code.length > 40 ? `${code.slice(0, 40)}…` : code,
            });
            if (this.state.view === "barcodeLines") {
                this.onBarcodeScanned(code);
            }
        });
        input.addEventListener("input", (ev) => {
            ev.stopPropagation();
            if (buffer.update(input.value)) {
                input.value = "";
            }
        });
        // The field is emptied when the buffer hands the scan over (see onScan).
        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === "Tab") {
                ev.preventDefault();
                buffer.flush(input.value);
                input.value = "";
            }
        });

        // Keep the field focused, but never take focus from a field the user is in.
        const refocus = () => {
            if (this.state.view !== "barcodeLines") {
                bar.classList.add("d-none");
                return;
            }
            bar.classList.remove("d-none");
            const active = document.activeElement;
            if (active !== input && !isUserField(active)) {
                input.focus({ preventScroll: true });
            }
        };
        refocus();
        this._clTextBar = bar;
        this._clTextInput = input;
        this._clTextBuffer = buffer;
        this._clRefocusInterval = setInterval(refocus, REFOCUS_MS);
    },

    _clStopTextCapture() {
        clearInterval(this._clRefocusInterval);
        this._clTextBuffer?.cancel();
        this._clTextBar?.remove();
        this._clTextBar = null;
        this._clTextInput = null;
    },
});
