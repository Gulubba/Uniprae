/* Uniprae Shared Configuration Layer
 * Central local configuration shared between Premiere Pro CEP panels,
 * After Effects CEP panels, the unified MCP server, and workflow scripts.
 *
 * Location: %LOCALAPPDATA%\Uniprae\settings.json (or UNIPRAE_CONFIG_PATH)
 * Disclosed: Groq API key is stored locally unencrypted in the user's profile.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("fs"), require("path"), require("os"));
  } else if (typeof define === "function" && define.amd) {
    define(["fs", "path", "os"], factory);
  } else {
    var req = typeof require !== "undefined" ? require : null;
    if (!req && typeof window !== "undefined") {
      try {
        if (window.parent && typeof window.parent.require !== "undefined") req = window.parent.require;
        else if (window.top && typeof window.top.require !== "undefined") req = window.top.require;
      } catch(e) {}
    }
    var fs = req ? req("fs") : null;
    var path = req ? req("path") : null;
    var os = req ? req("os") : null;
    var instance = factory(fs, path, os);
    root.UnipraeConfig = instance;
    if (typeof window !== "undefined" && window.parent && window.parent !== window && !window.parent.UnipraeConfig) {
      try { window.parent.UnipraeConfig = instance; } catch(e) {}
    }
  }
})(typeof self !== "undefined" ? self : this, function (fs, path, os) {
  "use strict";

  var DEFAULT_SETTINGS = {
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

  function getConfigDir() {
    if (process.env.UNIPRAE_CONFIG_DIR) return process.env.UNIPRAE_CONFIG_DIR;
    var localApp = process.env.LOCALAPPDATA;
    // CEP's embedded Chromium often lacks LOCALAPPDATA — resolve robustly
    if (!localApp || localApp.indexOf("AppData") === -1) {
      // Try USERPROFILE + AppData\Local
      var userProfile = process.env.USERPROFILE;
      if (userProfile && path) {
        var candidate = path.join(userProfile, "AppData", "Local");
        if (fs && fs.existsSync(candidate)) localApp = candidate;
      }
      // Try os.homedir() + AppData\Local
      if ((!localApp || localApp.indexOf("AppData") === -1) && os && os.homedir && path) {
        var homeCandidate = path.join(os.homedir(), "AppData", "Local");
        if (fs && fs.existsSync(homeCandidate)) localApp = homeCandidate;
      }
      // Last resort: construct from os.homedir without existence check
      if ((!localApp || localApp.indexOf("AppData") === -1) && os && os.homedir && path) {
        localApp = (typeof process !== "undefined" && process.platform === "win32")
          ? path.join(os.homedir(), "AppData", "Local")
          : path.join(os.homedir(), ".config");
      }
    }
    return localApp ? path.join(localApp, "Uniprae") : (os ? path.join(os.tmpdir(), "Uniprae") : "");
  }

  function getConfigPath() {
    if (process.env.UNIPRAE_CONFIG_PATH) return process.env.UNIPRAE_CONFIG_PATH;
    var dir = getConfigDir();
    return path.join(dir, "settings.json");
  }

  function getFallbackConfigPath() {
    return os ? path.join(os.tmpdir(), "uniprae-settings.json") : "uniprae-settings.json";
  }

  function maskApiKey(key) {
    if (!key || typeof key !== "string") return "[not configured]";
    var trimmed = key.trim();
    if (!trimmed) return "[not configured]";
    if (trimmed.length <= 8) return trimmed.slice(0, 3) + "***";
    var prefix = trimmed.slice(0, 4);
    var suffix = trimmed.slice(-4);
    return prefix + "..." + suffix + " (" + trimmed.length + " chars)";
  }

  function sanitizeConfig(raw) {
    var result = {};
    for (var k in DEFAULT_SETTINGS) {
      if (DEFAULT_SETTINGS.hasOwnProperty(k)) {
        result[k] = DEFAULT_SETTINGS[k];
      }
    }
    if (!raw || typeof raw !== "object") return result;

    // Handle Groq key
    var key = raw.groqApiKey || raw.groq_api_key || raw.groqKey || raw.apiKey;
    if (typeof key === "string") result.groqApiKey = key.trim();

    // Handle caption settings
    if (typeof raw.captionStyle === "string") result.captionStyle = raw.captionStyle;
    else if (typeof raw.style === "string") result.captionStyle = raw.style;

    if (typeof raw.captionCasing === "string") result.captionCasing = raw.captionCasing;
    else if (typeof raw.casing === "string") result.captionCasing = raw.casing;

    if (typeof raw.captionLanguage === "string") result.captionLanguage = raw.captionLanguage;
    else if (typeof raw.language === "string") result.captionLanguage = raw.language;

    if (typeof raw.captionPunctuation === "string") {
      result.captionPunctuation = raw.captionPunctuation;
    } else if (typeof raw.stripPunctuation === "boolean") {
      result.captionPunctuation = raw.stripPunctuation ? "strip" : "keep";
    }

    if (typeof raw.captionDestination === "string") result.captionDestination = raw.captionDestination;
    else if (typeof raw.destination === "string") result.captionDestination = raw.destination;

    if (typeof raw.timelineScope === "string") result.timelineScope = raw.timelineScope;
    else if (typeof raw.scope === "string") result.timelineScope = raw.scope;

    // Handle silence settings
    if (raw.silenceMargin !== undefined && raw.silenceMargin !== null) {
      var m = parseFloat(raw.silenceMargin);
      if (!isNaN(m) && m >= 0) result.silenceMargin = m;
    } else if (raw.margin !== undefined && raw.margin !== null) {
      var m2 = parseFloat(raw.margin);
      if (!isNaN(m2) && m2 >= 0) result.silenceMargin = m2;
    }

    if (typeof raw.silenceThreshold === "string") result.silenceThreshold = raw.silenceThreshold.trim();
    else if (typeof raw.threshold === "string") result.silenceThreshold = raw.threshold.trim();

    if (typeof raw.silenceOutput === "string") result.silenceOutput = raw.silenceOutput;
    else if (typeof raw.mode === "string") result.silenceOutput = raw.mode;

    if (typeof raw.silenceSource === "string") result.silenceSource = raw.silenceSource;
    else if (typeof raw.sourceMode === "string") result.silenceSource = raw.sourceMode;

    return result;
  }

  function readConfig() {
    if (!fs) return DEFAULT_SETTINGS;
    var primaryPath = getConfigPath();
    var fallbackPath = getFallbackConfigPath();

    var content = null;
    try {
      if (fs.existsSync(primaryPath)) {
        content = fs.readFileSync(primaryPath, "utf8");
      } else if (fs.existsSync(fallbackPath)) {
        content = fs.readFileSync(fallbackPath, "utf8");
      }
    } catch (e) {
      // Could not read file
    }

    if (!content) return sanitizeConfig({});
    try {
      var parsed = JSON.parse(content);
      return sanitizeConfig(parsed);
    } catch (e) {
      return sanitizeConfig({});
    }
  }

  function writeConfig(updates) {
    if (!fs) throw new Error("Filesystem not available in this runtime context.");
    var current = readConfig();
    var merged = {};
    for (var k in current) {
      if (current.hasOwnProperty(k)) merged[k] = current[k];
    }
    if (updates && typeof updates === "object") {
      for (var u in updates) {
        if (updates.hasOwnProperty(u)) merged[u] = updates[u];
      }
    }
    var sanitized = sanitizeConfig(merged);

    var primaryPath = getConfigPath();
    var primaryDir = path.dirname(primaryPath);
    var fallbackPath = getFallbackConfigPath();
    var jsonString = JSON.stringify(sanitized, null, 2);

    try {
      if (!fs.existsSync(primaryDir)) {
        fs.mkdirSync(primaryDir, { recursive: true });
      }
      fs.writeFileSync(primaryPath, jsonString, "utf8");
    } catch (primaryErr) {
      try {
        fs.writeFileSync(fallbackPath, jsonString, "utf8");
      } catch (fallbackErr) {
        throw new Error("Failed to write Uniprae settings to " + primaryPath + " (" + primaryErr.message + ") and " + fallbackPath + " (" + fallbackErr.message + ")");
      }
    }

    // Mirror to fallback path if primary succeeded so older CEP iframe references pick it up
    try {
      if (primaryPath !== fallbackPath) {
        fs.writeFileSync(fallbackPath, jsonString, "utf8");
      }
    } catch (e) {}

    return sanitized;
  }

  return {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getConfigDir: getConfigDir,
    getConfigPath: getConfigPath,
    getFallbackConfigPath: getFallbackConfigPath,
    maskApiKey: maskApiKey,
    sanitizeConfig: sanitizeConfig,
    readConfig: readConfig,
    writeConfig: writeConfig,
  };
});
