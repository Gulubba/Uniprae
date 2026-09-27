const ENDPOINTS = {
    "after-effects": { base: "http://127.0.0.1:3006", executePath: "/execute" },
    "premiere-pro": { base: "http://127.0.0.1:3005", executePath: "/eval" },
};
async function requestJson(url, init, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const text = await response.text();
        if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${text}`);
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    finally {
        clearTimeout(timer);
    }
}
export async function getAdobeStatus() {
    const hosts = await Promise.all(Object.keys(ENDPOINTS).map(async (host) => {
        const endpoint = ENDPOINTS[host];
        try {
            const data = await requestJson(`${endpoint.base}/health`, undefined, 1500);
            return [host, { connected: true, endpoint: endpoint.base, data }];
        }
        catch (error) {
            return [host, { connected: false, endpoint: endpoint.base, error: error?.message || String(error) }];
        }
    }));
    const status = Object.fromEntries(hosts);
    const connectedHosts = hosts.filter(([, value]) => value.connected).map(([host]) => host);
    return { success: connectedHosts.length > 0, connectedHosts, hosts: status };
}
export async function runAdobeScript(host, code) {
    let selected;
    if (host === "auto") {
        const status = await getAdobeStatus();
        selected = status.connectedHosts?.[0];
        if (!selected)
            return { success: false, error: "Neither After Effects nor Premiere Pro bridge is connected." };
    }
    else {
        selected = host;
    }
    const endpoint = ENDPOINTS[selected];
    try {
        const data = await requestJson(`${endpoint.base}${endpoint.executePath}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(selected === "after-effects" ? { code } : { to_eval: code }),
        }, 120000);
        let result = data;
        if (typeof result === 'string') {
            try {
                result = JSON.parse(result);
            }
            catch { }
        }
        const failed = result === 'EvalScript error.' || (result && typeof result === 'object' && (result.success === false || result.error));
        return { success: !failed, host: selected, endpoint: endpoint.base, data: result, ...(failed ? { error: result.error || 'Adobe script failed' } : {}) };
    }
    catch (error) {
        return { success: false, host: selected, endpoint: endpoint.base, error: error?.message || String(error) };
    }
}
export async function runPremiereFunction(functionName, args = []) {
    const serialized = args.map((value) => JSON.stringify(value)).join(",");
    return runAdobeScript("premiere-pro", `PremiereMCP.${functionName}(${serialized})`);
}
export async function triggerAdobeFunction(host, functionName, args = []) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(functionName)) {
        return { success: false, error: "Invalid function name." };
    }
    let selected = host;
    if (selected === "auto") {
        const status = await getAdobeStatus();
        selected = status.connectedHosts?.[0];
        if (!selected)
            return { success: false, error: "Neither After Effects nor Premiere Pro bridge is connected." };
    }
    const namespace = selected === "premiere-pro" ? "PremiereMCP" : "AeMCP";
    const qualified = functionName.includes(".") ? functionName : `${namespace}.${functionName}`;
    const serialized = args.map((value) => JSON.stringify(value)).join(",");
    return runAdobeScript(selected, `${qualified}(${serialized})`);
}
