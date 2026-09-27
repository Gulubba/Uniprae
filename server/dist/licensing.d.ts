export interface LicenseInfo {
    licenseKey: string;
    activated: boolean;
    activatedAt?: string;
}
export declare class LicenseManager {
    private licenseFilePath;
    constructor();
    /**
     * Validate a license key format or against local storage.
     * Format: AEMCP-XXXX-XXXX-XXXX (16 chars alphanumeric after prefix)
     * Or DEMO-PRO-2026 for testing.
     */
    validateKeyFormat(key: string): boolean;
    /**
     * Check if the product is currently activated on this machine.
     */
    isActivated(): boolean;
    /**
     * Activate a license key locally.
     */
    activate(key: string): {
        success: boolean;
        message: string;
    };
    /**
     * Get current stored license information.
     */
    getLicenseInfo(): LicenseInfo | null;
}
