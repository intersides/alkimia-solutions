import {utilities as Utilities} from "@alkimia/lib";
import http from "node:http";
import {distillRequest} from "../httpLib.js";
import Console from "@intersides/console";
import {HttpResponse} from "../ServerResponse.js";

/**
 * @param {object} _args
 * @return {Server}
 * @constructor
 */
export default function Server(_args){
    const instance = Object.create(Server.prototype);

    const {
        publicAddress,
        port,
        router
    } = Utilities.transfer(_args, {
        port: 8080,
        publicAddress:"http://localhost",
        router: function(){
        }
    });

    function _requestHandler(_rawRequest, _nodeResponseStream){

        // Set timeout handler
        _nodeResponseStream.on("timeout", () => {
            Console.warn("The Node Response has timed out!");
            if (!_nodeResponseStream.headersSent) {
                _nodeResponseStream.writeHead(504);
                _nodeResponseStream.end("Gateway Timeout");
            }
        });

        distillRequest(_rawRequest).then( async function(_request){
            // Console.debug("a received request has been distilled as:", _request);

            await router.catchAll(_request);

            router.handleRequest(_request).then(function(_httpServerResponse){
                // Console.log("_httpServerResponse:", _httpServerResponse);
                if(_httpServerResponse){
                    _httpServerResponse.send(_nodeResponseStream);
                }
                else{
                    _nodeResponseStream.writeHead(404, {
                        "content-type": "text/plain"
                    });
                    _nodeResponseStream.end("Not found!");
                }

            }).catch(async function(httpError){
                console.error("ERROR: httpError", httpError);
                if(httpError.constructor ===  HttpResponse){
                    httpError.send(_nodeResponseStream);
                }
                else{
                    const errorBody = httpError.message || "Undefined Server error";
                    _nodeResponseStream.writeHead(500, {
                        "Content-Length": Buffer.byteLength(errorBody),
                        ...Object.fromEntries(httpError.headers.entries())
                    });
                    _nodeResponseStream.end(errorBody);
                }

            });

        });

    }

    function _init(){
        instance.httpServer = http.createServer({}, _requestHandler);
        instance.httpServer.listen(port, null, null, async function(err){
            if(err){
                Console.error("error starting server");
            }
            else{
                Console.info(`http server running ${publicAddress}`);
            }
        });
        return instance;
    }

    return _init();
}

/**
 *
 * @type {Server|null}
 * @private
 */
let _instance = null;

/**
 *
 * @param _args
 * @return {Server}
 */
Server.createSingleton = function(_args = null){
    if(!_instance){
        _instance = Server.getInstance(_args);
    }
    return _instance;
};

/**
 *
 * @param _args
 * @return {Server}
 */
Server.getInstance = function(_args = null){
    return Server(_args);
};
