import {utilities} from "@alkimia/lib";
import {MimeType} from "@workspace/common/enums.js";
import Console from "@intersides/console";
import {extendHeaders} from "./httpLib.js";
import http from "node:http";
import {Readable} from "stream";

export function ServerResponse(_params={ data:null}){
    const instance = Object.create(ServerResponse.prototype);

    const {
        data
    } = utilities.transfer(_params, {
        data:null
    }) ;

    instance.is = function(_constructor){
        return instance.constructor === _constructor;
    };

    instance.data = data;

    return instance;
}


export function HttpResponse(_params={payload:null, mimeType:MimeType.TEXT}) {
    let _parent = ServerResponse({ data: _params.payload});
    let instance = Object.create(HttpResponse.prototype);

    let _webApiResponse = null;

    instance.payload = null;

    const {
        data,
        mimeType
    } = utilities.transfer(_params, {
        ..._parent,
        mimeType:MimeType.TEXT
    }) ;

    function _init(){

        instance.mimeType = mimeType;
        instance.payload = data;

        switch(mimeType){
            case MimeType.JSON:{
                try{
                    instance.payload  = JSON.stringify(data, null, 4);
                }
                catch(err){
                    Console.error(`${err.message} - failed to stringify data as:`, data);
                }
            }break;

            default:{
                Console.warn("mimeType default case triggered");
            }

        }

        _webApiResponse = new Response(instance.payload, {header: null});
        extendHeaders(_webApiResponse.headers, mimeType);

        return instance;

    }

    instance.is = function(_constructor){
        return instance.constructor === _constructor || _parent.is(_constructor);
    };

    /**
     *
     * @param {http.ServerResponse} nodeResponseStream
     */
    instance.send = function(nodeResponseStream=null){
        if(!nodeResponseStream || !(nodeResponseStream instanceof http.ServerResponse)){
            throw new Error("HttpResponse requires a node response stream");
        }
        else if (nodeResponseStream.timedOut) {
            Console.warn("The Node Response has timed out!");
        }

        // Log the final converted object
        const headers = Object.fromEntries(_webApiResponse.headers.entries());

        // Set each header individually before writeHead
        Object.entries(headers).forEach(([key, value]) => {
            nodeResponseStream.setHeader(key, value);
        });
        nodeResponseStream.writeHead(_webApiResponse.status);

        let readableStream = Readable.from(_webApiResponse.body);

        readableStream.pipe(nodeResponseStream, {end:false});

        readableStream.on("end", () => {
            nodeResponseStream.end();
        });

    };

    return _init();
}

// https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
export function HttpErrorNotFound(){

}

export function WebSocketResponse(_params={message:null}) {
    const _parent = ServerResponse({ data: _params.message});
    const _this = Object.create(WebSocketResponse.prototype);

    const {
        data:message
    } = utilities.transfer(_params, {
        ..._parent
    }) ;

    _this.message = message;

    _this.is = function(_constructor){
        return _this.constructor === _constructor || _parent.is(_constructor);
    };

    return _this;
}

export function MQTTResponse(_params={message:null}) {
    const _parent = ServerResponse({ data: _params.message});
    const _this = Object.create(MQTTResponse.prototype);

    const {
        data:message
    } = utilities.transfer(_params, {
        ..._parent
    }) ;

    _this.message = message;

    _this.is = function(_constructor){
        return _this.constructor === _constructor || _parent.is(_constructor);
    };

    return _this;
}
