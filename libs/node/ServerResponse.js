import {utilities} from "@alkimia/lib";
import {HttpErrorStatus, HttpResponseStatus, MimeType} from "@workspace/common/enums.js";
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

function HttpError(_params={
    data:null,
    mimeType:MimeType.TEXT
}){
    console.debug("DEBUG: 1 params->", _params);

    return HttpResponse(_params);
}

// https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
export function HttpErrorNotFound(_params){
    let params = utilities.transfer(_params, {
        data:null,
        mimeType:MimeType.TEXT
    });
    let instance = HttpError(params);

    function _init(){
        let response = new Response(instance?.data || "", {
            ...HttpErrorStatus.Http404_Not_Found,
            header: null
        });
        instance.setWebResponse(response, params.mimeType);
        return instance;
    }

    return _init();
}


export function HttpResponse(_params={ data:null, mimeType:MimeType.TEXT } ) {
    let _parent = ServerResponse({ data: _params.data});
    let instance = Object.create(HttpResponse.prototype);

    let _webApiResponse = null;

    instance.data = null;


    const {
        data,
        mimeType
    } = utilities.transfer(_params, {
        ..._parent,
        mimeType:MimeType.TEXT
    }) ;

    console.debug("DEBUG: 3 params->", {
        data,
        mimeType
    });

    function _init(){

        instance.mimeType = mimeType;
        instance.data = data;

        switch(mimeType){
            case MimeType.JSON:{
                try{
                    instance.data  = JSON.stringify(data, null, 4);
                }
                catch(err){
                    Console.error(`${err.message} - failed to stringify data as:`, data);
                }
            }break;

            default:{
                Console.warn("mimeType default case triggered");
            }

        }

        let response = new Response(instance?.data || "", {
            ...HttpResponseStatus.Http200_OK,
            header: null
        });

        _setResponse(response, mimeType);

        return instance;

    }

    function _setResponse(_Response, _mimeType){
        _webApiResponse = _Response;
        extendHeaders(_webApiResponse.headers, _mimeType);
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
        //Note: replace the original node http.ServerResponse.statusMessage with statusText
        delete nodeResponseStream.statusMessage;
        nodeResponseStream.statusText =  _webApiResponse.statusText;
        nodeResponseStream.writeHead(_webApiResponse.status);

        let readableStream = Readable.from(_webApiResponse.body);

        readableStream.pipe(nodeResponseStream, {end:false});

        readableStream.on("end", () => {
            nodeResponseStream.end();
        });

    };

    instance.setWebResponse = _setResponse;

    return _init();
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
