import os from "os";

export function getSystemInfo() {
    return {
        platform: os.platform(),
        cpus: os.cpus().length,
    };
}
