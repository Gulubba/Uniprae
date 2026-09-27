import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export const DEFAULT_SETTINGS = {
    groqApiKey: "",
    captionStyle: "word",
    captionCasing: "uppercase",
    captionLanguage: "en",
    captionPunctuation: "strip",
    captionDestination: "caption",
    timelineScope: "entire",
    silenceMargin: 0.2,
    silenceThreshold: "",
    silenceOutput: "premiere",
    silenceSource: "timeline",
};
export function getConfigDir() {
    if (process.env.UNIPRAE_CONFIG_DIR)
        return process.env.UNIPRAE_CONFIG_DIR;
    const localApp = process.env.LOCALAPPDATA || (process.platform === "win32" ? path.join(os.homedir(), "AppData", "Local") : path.join(os.homedir(), ".config"));
    return path.join(localApp, "Uniprae");
}
export function getConfigPath() {
    if (process.env.UNIPRAE_CONFIG_PATH)
        return process.env.UNIPRAE_CONFIG_PATH;
    return path.join(getConfigDir(), "settings.json");
}
export function getFallbackConfigPath() {
    return path.join(os.tmpdir(), "uniprae-settings.json");
}
export function maskApiKey(key) {
    if (!key || typeof key !== "string")
        return "[not configured]";
    const trimmed = key.trim();
    if (!trimmed)
        return "[not configured]";
    if (trimmed.length <= 8)
        return trimmed.slice(0, 3) + "***";
    const prefix = trimmed.slice(0, 4);
    const suffix = trimmed.slice(-4);
    return `${prefix}...${suffix} (${trimmed.length} chars)`;
}
export function sanitizeConfig(raw) {
    const result = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== "object")
        return result;
    const key = raw.groqApiKey || raw.groq_api_key || raw.groqKey || raw.apiKey;
    if (typeof key === "string")
        result.groqApiKey = key.trim();
    if (typeof raw.captionStyle === "string")
        result.captionStyle = raw.captionStyle;
    else if (typeof raw.style === "string")
        result.captionStyle = raw.style;
    if (typeof raw.captionCasing === "string")
        result.captionCasing = raw.captionCasing;
    else if (typeof raw.casing === "string")
        result.captionCasing = raw.casing;
    if (typeof raw.captionLanguage === "string")
        result.captionLanguage = raw.captionLanguage;
    else if (typeof raw.language === "string")
        result.captionLanguage = raw.language;
    if (typeof raw.captionPunctuation === "string") {
        result.captionPunctuation = raw.captionPunctuation === "keep" ? "keep" : "strip";
    }
    else if (typeof raw.stripPunctuation === "boolean") {
        result.captionPunctuation = raw.stripPunctuation ? "strip" : "keep";
    }
    if (typeof raw.captionDestination === "string")
        result.captionDestination = raw.captionDestination;
    else if (typeof raw.destination === "string")
        result.captionDestination = raw.destination;
    if (typeof raw.timelineScope === "string")
        result.timelineScope = raw.timelineScope;
    else if (typeof raw.scope === "string")
        result.timelineScope = raw.scope;
    if (raw.silenceMargin !== undefined && raw.silenceMargin !== null) {
        const m = parseFloat(String(raw.silenceMargin));
        if (!isNaN(m) && m >= 0)
            result.silenceMargin = m;
    }
    else if (raw.margin !== undefined && raw.margin !== null) {
        const m2 = parseFloat(String(raw.margin));
        if (!isNaN(m2) && m2 >= 0)
            result.silenceMargin = m2;
    }
    if (typeof raw.silenceThreshold === "string")
        result.silenceThreshold = raw.silenceThreshold.trim();
    else if (typeof raw.threshold === "string")
        result.silenceThreshold = raw.threshold.trim();
    if (typeof raw.silenceOutput === "string")
        result.silenceOutput = raw.silenceOutput;
    else if (typeof raw.mode === "string")
        result.silenceOutput = raw.mode;
    if (typeof raw.silenceSource === "string")
        result.silenceSource = raw.silenceSource;
    else if (typeof raw.sourceMode === "string")
        result.silenceSource = raw.sourceMode;
    return result;
}
export function readConfig() {
    const primaryPath = getConfigPath();
    const fallbackPath = getFallbackConfigPath();
    let content = null;
    try {
        if (fs.existsSync(primaryPath)) {
            content = fs.readFileSync(primaryPath, "utf8");
        }
        else if (fs.existsSync(fallbackPath)) {
            content = fs.readFileSync(fallbackPath, "utf8");
        }
    }
    catch {
        // Ignore read errors and fallback to defaults
    }
    if (!content)
        return sanitizeConfig({});
    try {
        const parsed = JSON.parse(content);
        return sanitizeConfig(parsed);
    }
    catch {
        return sanitizeConfig({});
    }
}
export function writeConfig(updates) {
    const current = readConfig();
    const merged = { ...current, ...updates };
    const sanitized = sanitizeConfig(merged);
    const primaryPath = getConfigPath();
    const primaryDir = path.dirname(primaryPath);
    const fallbackPath = getFallbackConfigPath();
    const jsonString = JSON.stringify(sanitized, null, 2);
    try {
        if (!fs.existsSync(primaryDir)) {
            fs.mkdirSync(primaryDir, { recursive: true });
        }
        fs.writeFileSync(primaryPath, jsonString, "utf8");
    }
    catch (primaryErr) {
        try {
            fs.writeFileSync(fallbackPath, jsonString, "utf8");
        }
        catch (fallbackErr) {
            throw new Error(`Failed to write Uniprae settings to ${primaryPath} (${primaryErr?.message}) and ${fallbackPath} (${fallbackErr?.message})`);
        }
    }
    try {
        if (primaryPath !== fallbackPath) {
            fs.writeFileSync(fallbackPath, jsonString, "utf8");
        }
    }
    catch { }
    return sanitized;
}
