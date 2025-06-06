import {utilities} from "@alkimia/lib";
import {MimeType} from "@workspace/common/enums.js";
import Console from "@intersides/console";

const MAX_PAYLOAD_SIZE = 1024 * 1024 * 3; //3MB

export function HttpError(errorMessage, errorCode){

    return new Response(JSON.stringify({error: errorMessage}), {
        status: errorCode,
        headers: {"Content-Type": "application/json"}
    });
}

export function extendHeaders(_headers, type = MimeType.JSON){

    switch(type){
        case MimeType.HTML:
        case MimeType.CSS:
        case MimeType.TEXT:{
            _headers.set("Content-Type", `${type}; charset=utf-8`);
        }
            break;

        default:{
            _headers.set("Content-Type", type);
        }
            break;
    }

    _headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    _headers.set("Pragma", "no-cache");
    _headers.set("Expires", "0");

    // Set CORS headers
    _headers.set("Access-Control-Allow-Origin", "same-origin"); // Specify strict requests from same origin domain and port
    _headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH"
    ); // Allow specified methods

    _headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    ); // Allow specified headers

    // Set security headers
    _headers.set("X-Content-Type-Options", "nosniff");
    _headers.set("X-Frame-Options", "DENY");
    _headers.set("X-XSS-Protection", "1; mode=block");

    //NOTE: uncommenting the next header setting will cause:
    // Refused to execute inline script because it violates the following
    // Content Security Policy directive:
    // "default-src 'self'".
    // Either the 'unsafe-inline' keyword, a hash ('sha256-e78gsts27AuYv6Ian1RkH7iXUgjlxV2SKVizETIx/Rc='),
    // or a nonce ('nonce-...') is required to enable inline execution.
    // To be noted also that 'script-src' was not explicitly set, so 'default-src' is used as a fallback.

    // _headers.set("Content-Security-Policy", "default-src 'self'");

    return _headers;

}

function _buildResponseHeader(_response){
    if(process.env.DOMAIN === "local.peri.vision"){
        _response.setHeader("Access-Control-Allow-Origin", "*");
        _response.setHeader("Access-Control-Allow-Methods", "*");
        _response.setHeader("Access-Control-Max-Age", 2592000); // 30 days

        // Set security headers
        _response.setHeader("X-Content-Type-Options", "nosniff");
        _response.setHeader("X-Frame-Options", "DENY");
        _response.setHeader("X-XSS-Protection", "1; mode=block");
        // _response.setHeader("Content-Security-Policy", "default-src 'self'");
        _response.setHeader(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload"
        );
        _response.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
        _response.setHeader(
            "Feature-Policy",
            "geolocation 'none'; microphone 'none'; camera 'none'"
        );
    }
}

export const successResponseHandler = (response, serverResponse) => {
    _buildResponseHeader(response);
    // Setting cache control headers to prevent caching
    response.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");

    // Set CORS headers
    response.setHeader("Access-Control-Allow-Origin", "same-origin"); // Specify strict requests from same origin domain and port
    response.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH"
    ); // Allow specified methods
    response.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    ); // Allow specified headers

    // Set security headers
    // response.setHeader("Content-Security-Policy", "default-src 'self'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("X-XSS-Protection", "1; mode=block");

    response.writeHead(serverResponse.status, {
        "Content-Type": "application/json"
    });
    const _responseJsonString = serverResponse.stringify();
    response.write(_responseJsonString);
    response.end();
};

function _retrieveRequestBody(_request){
    return new Promise((resolve, reject) => {
        let body = "";
        _request.on("data", function(chunk){
            if(body.length + chunk.length > MAX_PAYLOAD_SIZE){
                reject(Error("payload too large"));
            }
            else{
                // If the payload size is within the limit, continue accumulating data
                body += chunk.toString(); // convert Buffer to string
            }
        });
        _request.on("close", () => {
        });
        _request.on("end", () => {
            let payload = null;
            try{
                if(utilities.isNonemptyString(body)){
                    //This might be url encoded as it is sent from the VR headset
                    body = decodeURIComponent(body);

                    if(
                        _request.headers["content-type"] &&
                        _request.headers["content-type"].includes("multipart/form-data")
                    ){
                        // Console.debug("content type is multipart/form-data");

                        let jsonStarted = false;
                        let jsonEnded = false;
                        let json = "";
                        const lines = body.split("\n");

                        for(const line of lines){
                            if(line.trim() === "{"){
                                jsonStarted = true;
                            }

                            if(jsonStarted && !jsonEnded){
                                json += line.trim() + "\n";
                            }

                            if(line.trim() === "}"){
                                jsonEnded = true;
                            }
                        }
                        body = json;
                    }

                    payload = JSON.parse(body);
                }
            }
            catch(parsingException){
                Console.error(parsingException.message);
                Console.error("failed to parse json body", body);
            }
            resolve(payload);
        });
        /* c8 ignore next 4 */
        _request.on("error", (err) => {
            Console.error("error event:", err);
            reject(err);
        });
    });
}

export function isWebSocketRequest(request){
    const isUpgrade = request.headers["upgrade"] && request.headers["upgrade"].toLowerCase() === "websocket";
    const isConnectionUpgrade = request.headers["connection"] && request.headers["connection"].toLowerCase().includes("upgrade");
    const hasWebSocketKey = request.headers["sec-websocket-key"] !== undefined;

    return isUpgrade && isConnectionUpgrade && hasWebSocketKey;
}

export async function distillRequest(request, withBody = true){

    const url = {
        path: request.url,
        query: {}
    };

    let body = null;

    const urlParts = request.url.split("?");
    if(urlParts.length > 0){
        url.path = urlParts[0];
        if(urlParts.length === 2){
            const parameterSplit = urlParts[1].split("&");
            if(parameterSplit.length > 0){
                parameterSplit.forEach((_parameterPair) => {
                    const keyValue = _parameterPair.split("=");
                    url.query[keyValue[0]] = decodeURIComponent(keyValue[1]);
                });
            }
        }
    }

    let type = MimeType.UNDEFINED;

    if(utilities.isNotNullObject(request.headers)){

        const {accept = null} = request.headers;

        if(accept){
            if(accept.includes(MimeType.IMAGE)){
                type = MimeType.IMAGE;
            }
            else if(accept.includes(MimeType.CSS)){
                type = MimeType.CSS;
            }
            else if(accept.includes(MimeType.JSON)){
                type = MimeType.JSON;
            }
            else if(accept.includes(MimeType.HTML)){
                type = MimeType.HTML;
            }
            else{
                Console.warn(`@request url:"${request.url}" mime type not extracted from accept header ${accept}`);
            }

        }
        else{
            //try to deduce it from the url ?
        }

    }
    else{
        Console.warn("request has no headers");
    }

    if(withBody){
        body = await _retrieveRequestBody(request);
    }
    else{
        Console.warn("request has no body");
    }

    return {
        url: url,
        method: request.method,
        headers: request.headers,
        body: body,
        mimeType: type
    };
}
