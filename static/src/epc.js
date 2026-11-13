/** @odoo-module **/

// SGTIN-96 only. Use BigInt: a 96-bit EPC cannot be represented by a JS Number.
const PARTITIONS = [
    [40, 12, 4, 1], [37, 11, 7, 2], [34, 10, 10, 3], [30, 9, 14, 4],
    [27, 8, 17, 5], [24, 7, 20, 6], [20, 6, 24, 7],
];

export function decodeSGTIN96(raw) {
    const hex = raw.trim().replace(/^0x/i, "").toUpperCase();
    if (!/^[0-9A-F]{24}$/.test(hex)) {
        throw new Error("Expected a 24-character hexadecimal SGTIN-96 EPC.");
    }
    const value = BigInt(`0x${hex}`);
    if (value >> 88n !== 0x30n) {
        throw new Error("Unsupported EPC scheme: only SGTIN-96 is supported.");
    }
    const partition = Number((value >> 82n) & 7n);
    if (partition > 6) {
        throw new Error("Invalid SGTIN-96 partition.");
    }
    const [companyBits, companyDigits, itemBits, itemDigits] = PARTITIONS[partition];
    const companyValue = (value >> BigInt(38 + itemBits)) & ((1n << BigInt(companyBits)) - 1n);
    const itemValue = (value >> 38n) & ((1n << BigInt(itemBits)) - 1n);
    if (companyValue >= 10n ** BigInt(companyDigits) || itemValue >= 10n ** BigInt(itemDigits)) {
        throw new Error("EPC fields exceed the decimal capacity of their partition.");
    }
    const company = companyValue.toString().padStart(companyDigits, "0");
    const item = itemValue.toString().padStart(itemDigits, "0");
    const serial = (value & ((1n << 38n) - 1n)).toString();
    // Pure identity URI deliberately excludes the filter bits, so changing the
    // filter does not cause the same physical identity to be counted twice.
    const uri = `urn:epc:id:sgtin:${company}.${item}.${serial}`;
    const gtinBody = item[0] + company + item.slice(1);
    const sum = [...gtinBody].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 1 : 3), 0);
    const gtin = gtinBody + ((10 - sum % 10) % 10);
    return { hex, uri, gtin, serial };
}

// Keep an unfinished suffix until a terminator arrives. Never use an idle timer
// to guess that a partially transmitted EPC is complete.
export function splitFrames(text, flush = false) {
    const parts = text.split(/[;\r\n\t]+/);
    const remainder = flush ? "" : parts.pop();
    return { frames: parts.map((part) => part.trim()).filter(Boolean), remainder };
}
