import {SignJWT, decodeJwt} from "jose";
import { utilities as Utilities } from "@alkimia/lib";
import * as jose from "jose";

let crypto;

// Detect Node.js vs Browser environment
if (typeof window === "undefined") {
    // Node.js environment
    crypto = (await import("crypto")).default; // Dynamically import crypto for Node.js
} else {
    // Browser environment
    crypto = window.crypto;
}


export default function CryptoService(_args = null) {

    const instance = Object.create(CryptoService.prototype);

    const _params = Utilities.transfer(_args, {
        secret: new TextEncoder().encode(
            "Swe4g7c?UBm5Nrd96vhsVDtkyJFbqKMTm!TMw5BDRLtaCFAXNvbq?s4rGKQSZnUP"
        )
    });

    async function _jwtToken(_payload){
        return await new SignJWT(_payload).setProtectedHeader({alg: "HS256"}).sign(instance.secret);
    }

    function _generateSecret() {
    // Create an array to store random bytes
        const secretArray = new Uint8Array(16);

        // Fill the array with random values
        crypto.getRandomValues(secretArray);

        // return the converted random bytes to hex string
        return Array.from(secretArray).map(function(byte) {
            return ("0" + byte.toString(16)).slice(-2);
        }).join("");

    }

    // Generate Random Bytes
    function _generateRandomBytes(size = 8, encoding = "hex") {
        if (typeof window !== "undefined" && crypto.getRandomValues) {
            // Browser environment equivalent
            const randomArray = new Uint8Array(size);
            crypto.getRandomValues(randomArray);
            return Array.from(randomArray)
                .map((byte) => ("0" + byte.toString(16)).slice(-2))
                .join("");
        } else {
            // Node.js environment
            return crypto.randomBytes(size).toString(encoding);
        }
    }

    async function _signJWT(subject, payload){

        return new jose.SignJWT(payload)
            .setProtectedHeader({alg: "HS256"})
            .setSubject(subject)
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(_params.secret);

    }

    async function _verifyJWT(jwt){
        return await jose.jwtVerify(jwt, _params.secret, {
            algorithms: ["HS256"]
        });
    }

    instance.signJWT = _signJWT;
    instance.verifyJWT = _verifyJWT;

    instance.generateRandomBytes = _generateRandomBytes;


    return instance;

}


let _instance = null;

/**
 *
 * @return {CryptoService}
 */
CryptoService.getSingleton = function(_args = null) {
    if(!_instance) {
        _instance = CryptoService(_args);
    }
    return _instance;
};

/**
 *
 * @return {CryptoService}
 */
CryptoService.getInstance = function(_args = null) {
    return CryptoService(_args);
};
