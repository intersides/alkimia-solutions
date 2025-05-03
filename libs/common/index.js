
export function sayHello(name) {
    return `Hey! is this, ${name}!`;
}

export function printServerInfo(protocol, address, port, env) {
    console.log(`✅ Backend server running at ${protocol}://${address} in ${env} mode.`);
}

/**
 * given a valid and properly formatted .env file return the json dictionary
 * @param _envFileConvent
 */
export function parseEnvFile(_envFileConvent){
    const envVars = {};
    _envFileConvent.split("\n").forEach(line => {
        if(line && !line.startsWith("#")){
            const [key, value] = line.split("=");
            if(key && value){
                envVars[key.trim()] = value.trim();
            }
        }
    });
    return envVars;
}
