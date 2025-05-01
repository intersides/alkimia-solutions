import {utilities} from "@alkimia/lib";
import {MimeType} from "@workspace/common/enums.js";
import Console from "@intersides/console";
import {extendHeaders} from "./httpLib.js";
import http from "node:http";
import {Readable} from "stream";

export function ServerResponse(_params={ data:null}){
    const _this = Object.create(ServerResponse.prototype);

    const {
        data
    } = utilities.transfer(_params, {
        data:null
    }) ;

    _this.is = function(_constructor){
        return _this.constructor === _constructor;
    };

    _this.data = data;

    return _this;
}


export function HttpResponse(_params={payload:null, mimeType:MimeType.TEXT}) {
    let _parent = ServerResponse({ data: _params.payload});
    let _this = Object.create(HttpResponse.prototype);

    let _webApiResponse = null;

    _this.payload = null;

    const {
        data,
        mimeType
    } = utilities.transfer(_params, {
        ..._parent,
        mimeType:null
    }) ;

    function _init(){

        _this.mimeType = mimeType;
        _this.payload = data;

        switch(mimeType){
            case MimeType.JSON:{
                try{
                    _this.payload  = JSON.stringify(data, null, 4);
                }
                catch(err){
                    Console.error(`${err.message} - failed to stringify data as:`, data);
                }
            }break;

            default:{
                Console.warn("mimeType default case triggered");
            }

        }

        _webApiResponse = new Response(data, {header: null});
        extendHeaders(_webApiResponse.headers, mimeType);

        return _this;

    }

    _this.is = function(_constructor){
        return _this.constructor === _constructor || _parent.is(_constructor);
    };

    /**
     *
     * @param {http.ServerResponse} nodeResponseStream
     */
    _this.send = function(nodeResponseStream=null){
        if(!nodeResponseStream || !(nodeResponseStream instanceof http.ServerResponse)){
            throw new Error("HttpResponse requires a node response stream");
        }
        else if (nodeResponseStream.timedOut) {
            Console.warn("The Node Response has timed out!");
        }


        //set status code and transfer headers
        nodeResponseStream.writeHead(_webApiResponse.status, Object.fromEntries(_webApiResponse.headers.entries()));

        let readableStream = Readable.from(_webApiResponse.body);

        readableStream.pipe(nodeResponseStream, {end:false});
        readableStream.on("end", function(){
            //NOTE, explore the benefit of trailers such as:
            // res.addTrailers({
            //  'X-Content-Length': contentLength.toString()
            // });
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
