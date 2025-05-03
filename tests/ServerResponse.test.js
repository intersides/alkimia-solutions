import http from "node:http";
import {describe, test, expect, it} from "vitest";
import {HttpErrorNotFound, HttpResponse, MQTTResponse, ServerResponse, WebSocketResponse} from "@workspace/node/ServerResponse.js";
import {HttpErrorStatus, MimeType} from "@workspace/common/enums.js";
import {EventEmitter} from "node:events";

function createMockResponse() {
    // Create a mock response that inherits from http.ServerResponse
    const mockResponse = Object.create(http.ServerResponse.prototype);

    // Initialize with a mock socket
    const socket = new EventEmitter();
    http.ServerResponse.call(mockResponse, { method: "GET", socket: socket });

    // Add your mock methods while preserving the prototype chain
    mockResponse.headers = new Map();
    mockResponse.statusCode = 200;
    mockResponse.writtenData = [];

    // Override the necessary methods
    mockResponse.setHeader = function(name, value) {
        this.headers.set(name, value);
    };

    mockResponse.getHeader = function(name) {
        return this.headers.get(name);
    };

    mockResponse.writeHead = function(status, headers = {}) {
        this.statusCode = status;
        Object.entries(headers).forEach(([key, value]) => this.setHeader(key, value));
    };

    mockResponse.write = function(chunk) {
        this.writtenData.push(chunk);
        return true;
    };

    mockResponse.end = function(data) {
        if (data){
            this.writtenData.push(data);
        }
        this.emit("finish");
        return this;
    };

    return mockResponse;
}



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

    describe("initialisation", function(){
        test("HttpResponse has a constructor matching HttpResponse", function(){
            expect(HttpResponse().constructor).toBe(HttpResponse);
        });

        test("HttpResponse is a HttpResponse and also a ServerResponse", function(){
            expect(HttpResponse().is(HttpResponse)).toBe(true);
            expect(HttpResponse().is(ServerResponse)).toBe(true);
        });

        test("HttpResponse is initialised with a default null data property", function(){
            expect(HttpResponse().data).toBe(null);
        });

        test("HttpResponse is initialised with a default text mimetype property", function(){
            expect(HttpResponse().mimeType).toBe(MimeType.TEXT);
        });

    });

    describe("HttpError", function(){
        test("init a simple 404 error with data hello", function(){

            let mockResponse = createMockResponse();

            // Create a promise that resolves when a 'finish' event is emitted
            const responsePromise = new Promise(resolve => {
                mockResponse.on("finish", resolve);
            });

            const httpResponse = HttpErrorNotFound({
                data: "hello"
            });
            httpResponse.send(mockResponse);
            expect(mockResponse.headers.get("content-type")).toContain("text/plain");
            expect(mockResponse.statusCode).toBe(HttpErrorStatus.Http404_Not_Found.status);
            expect(mockResponse.statusText).toBe(HttpErrorStatus.Http404_Not_Found.statusText);

            return responsePromise.then(() => {
                // Now the writtenData array should be populated
                const responsetext = Buffer.concat(mockResponse.writtenData).toString();
                expect(responsetext).toEqual("hello");
            });

        });
    });

    describe("HttpResponse sending ", function(){

        test("HttpResponse requires a node response transporter to be sent", function(){
            let exception = null;
            let response = HttpResponse();
            try{
                response.send();
            }
            catch(e){
                exception = e;
            }
            expect(exception).not.toBeFalsy();
        });

        test("Default HttpResponse", function(){
            let mockResponse = createMockResponse();

            const responsePromise = new Promise(resolve => {
                mockResponse.on("finish", resolve);
            });

            let response = HttpResponse();
            response.send(mockResponse);

            return responsePromise.then(() => {
                console.debug("DEBUG: mockResponse", mockResponse);
                expect(mockResponse.statusCode).toBe(200);
                expect(mockResponse.statusText).toBe("OK");
                expect(mockResponse.headers.get("content-type")).toContain("text/plain");
                const responseString = Buffer.concat(mockResponse.writtenData).toString();
                expect(typeof responseString).toBe("string");
                expect(responseString).toBe("");
            });
        });

        it("should expect a response to be a valid json", function(){
            let mockResponse = createMockResponse();

            // Create a promise that resolves when a 'finish' event is emitted
            const responsePromise = new Promise(resolve => {
                mockResponse.on("finish", resolve);
            });

            const httpResponse = HttpResponse({
                data: { message: "test" },
                mimeType: MimeType.JSON
            });
            httpResponse.send(mockResponse);
            expect(mockResponse.headers.get("content-type")).toBe("application/json");

            return responsePromise.then(() => {
                // Now the writtenData array should be populated
                const responseString = Buffer.concat(mockResponse.writtenData).toString();
                const parsedJson = JSON.parse(responseString);
                expect(parsedJson).toEqual({ message: "test" });
            });

        });

        it("should expect a response to be text", function(){
            let mockResponse = createMockResponse();

            // Create a promise that resolves when a 'finish' event is emitted
            const responsePromise = new Promise(resolve => {
                mockResponse.on("finish", resolve);
            });

            const httpResponse = HttpResponse({
                data: "hello"
            });
            httpResponse.send(mockResponse);
            expect(mockResponse.headers.get("content-type")).toContain("text/plain");

            return responsePromise.then(() => {
                // Now the writtenData array should be populated
                const responsetext = Buffer.concat(mockResponse.writtenData).toString();
                expect(responsetext).toEqual("hello");
            });

        });

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
