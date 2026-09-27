import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
export class LicenseManager {
    licenseFilePath;
    constructor() {
        const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
        const dir = path.join(appData, "AfterEffectsMCP");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.licenseFilePath = path.join(dir, "license.json");
    }
    /**
     * Validate a license key format or against local storage.
     * Format: AEMCP-XXXX-XXXX-XXXX (16 chars alphanumeric after prefix)
     * Or DEMO-PRO-2026 for testing.
     */
    validateKeyFormat(key) {
        if (!key)
            return false;
        const cleanKey = key.trim().toUpperCase();
        if (cleanKey === "DEMO-PRO-2026" || cleanKey === "AEMCP-PRO-2026")
            return true;
        const pattern = /^AEMCP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        return pattern.test(cleanKey);
    }
    /**
     * Check if the product is currently activated on this machine.
     */
    isActivated() {
        try {
            if (!fs.existsSync(this.licenseFilePath))
                return false;
            const raw = fs.readFileSync(this.licenseFilePath, "utf-8");
            const info = JSON.parse(raw);
            return info.activated && this.validateKeyFormat(info.licenseKey);
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Activate a license key locally.
     */
    activate(key) {
        if (!this.validateKeyFormat(key)) {
            return {
                success: false,
                message: "Invalid License Key format. Key format should be AEMCP-XXXX-XXXX-XXXX",
            };
        }
        const info = {
            licenseKey: key.trim().toUpperCase(),
            activated: true,
            activatedAt: new Date().toISOString(),
        };
        try {
            fs.writeFileSync(this.licenseFilePath, JSON.stringify(info, null, 2), "utf-8");
            return { success: true, message: "License successfully activated!" };
        }
        catch (e) {
            return { success: false, message: `Failed to save license: ${e.message}` };
        }
    }
    /**
     * Get current stored license information.
     */
    getLicenseInfo() {
        try {
            if (!fs.existsSync(this.licenseFilePath))
                return null;
            return JSON.parse(fs.readFileSync(this.licenseFilePath, "utf-8"));
        }
        catch (e) {
            return null;
        }
    }
}
