import {describe, test, expect} from "vitest";
import {HttpResponse, MQTTResponse, ServerResponse, WebSocketResponse} from "@workspace/node/ServerResponse.js";
import {MimeType} from "@workspace/common/enums.js";

describe(ServerResponse.constructor.name, function(){

    test("ServerResponse has a constructor reflecting the expected type", function(){
        expect(ServerResponse().constructor).toBe(ServerResponse);
    });

    test("ServerResponse is a ServerResponse", function(){
        expect(ServerResponse().is(ServerResponse)).toBe(true);
    });

    test("ServerResponse is initialised with a default null data property", function(){
        expect(ServerResponse().data).toBe(null);
    });

});

describe(HttpResponse.constructor.name, function(){
    test("HttpResponse has a constructor matching HttpResponse", function(){
        expect(HttpResponse().constructor).toBe(HttpResponse);
    });

    test("HttpResponse is a HttpResponse and also a ServerResponse", function(){
        expect(HttpResponse().is(HttpResponse)).toBe(true);
        expect(HttpResponse().is(ServerResponse)).toBe(true);
    });

    test("HttpResponse is initialised with a default null payload property", function(){
        expect(HttpResponse().payload).toBe(null);
    });

    test("HttpResponse is initialised with a default text mimetype property", function(){
        expect(HttpResponse().mimeType).toBe(MimeType.TEXT);
    });


});

describe(WebSocketResponse.constructor.name, function(){
    test("WebSocketResponse has a constructor matching WebSocketResponse", function(){
        expect(WebSocketResponse().constructor).toBe(WebSocketResponse);
    });

    test("WebSocketResponse is a WebSocketResponse and also a ServerResponse", function(){
        expect(WebSocketResponse().is(WebSocketResponse)).toBe(true);
        expect(HttpResponse().is(ServerResponse)).toBe(true);
    });

    test("WebSocketResponse is initialised with a default null message property", function(){
        expect(WebSocketResponse().message).toBe(null);
    });

});

describe(MQTTResponse.constructor.name, function(){
    test("MQTTResponse has a constructor matching MQTTResponse", function(){
        expect(MQTTResponse().constructor).toBe(MQTTResponse);
    });

    test("MQTTResponse is a MQTTResponse and also a ServerResponse", function(){
        expect(MQTTResponse().is(MQTTResponse)).toBe(true);
        expect(HttpResponse().is(ServerResponse)).toBe(true);
    });

    test("MQTTResponse is initialised with a default null message property", function(){
        expect(MQTTResponse().message).toBe(null);
    });

});
