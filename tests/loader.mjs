import { readFile } from "node:fs/promises";

export async function loadModule(path, replacements = {}) {
    let source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const [specifier, replacement] of Object.entries(replacements)) {
        source = source.replaceAll(`"${specifier}"`, `"${replacement}"`);
    }
    return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

export const epcURL = new URL("../static/src/epc.js", import.meta.url).href;
export const { RFIDSession } = await loadModule("../static/src/session.js", { "./epc": epcURL });
