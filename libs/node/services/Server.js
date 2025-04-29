import {utilities as Utilities} from "@alkimia/lib";
import http from "node:http";
import {distillRequest} from "../httpLib.js";
import {Readable} from "stream";
import Console from "@intersides/console";

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

    function _requestHandler(_rawRequest, _response){

        distillRequest(_rawRequest).then(function(_request){
            // Console.debug("a received request has been distilled as:", _request);

            router.handleRequest(_request).then(function(_httpResponse){
                // Console.log("_Response", _httpResponse);

                if(Utilities.isNotNullObject(_httpResponse)){

                    _response.writeHead(_httpResponse.status, Object.fromEntries(_httpResponse.headers.entries()));

                    // Pipe the Node.js Readable stream to the HTTP response
                    if(_httpResponse.body){
                        const nodeStream = Readable.from(_httpResponse.body);
                        nodeStream.pipe(_response);
                    }

                }
                else{
                    _response.writeHead(404, {
                        "content-type": "text/plain"
                    });
                    _response.end("Not found!");
                }

            }).catch(async function(httpError){
                const body = await httpError.text();
                _response.writeHead(httpError.status, {
                    "Content-Length": Buffer.byteLength(body),
                    ...Object.fromEntries(httpError.headers.entries())
                });
                _response.end(body);
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
