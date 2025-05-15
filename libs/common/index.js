
export function sayHello(name) {
    return `Hey! is this, ${name}`;
}

export function printServerInfo(protocol, address, port, env) {
    console.log(`✅ Backend server running at ${protocol}://${address} in ${env} mode.`);
}

