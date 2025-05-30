export const MimeType = {
    UNDEFINED:"undefined",
    IMAGE:"image/*,*",
    AVIF:"image/avif",
    JPG:"image/jpeg",
    BMP:"image/bmp",
    PNG:"image/png",
    GIF:"image/gif",
    TIFF:"image/tiff",
    SVG:"image/svg+xml",
    WEBP:"image/webp",
    FAVICON:"image/x-icon",
    CSS:"text/css",
    HTML:"text/html",
    TEXT:"text/plain",
    MULTIPART_FORM_DATA:"multipart/form-data",
    JSON:"application/json",
    JS:"application/javascript",
    ANY:"application/json"
};

export const HttpResponseStatus = {
    Http200_OK:{
        status:200,
        statusText:"OK",
        meaning:"Standard response for successful HTTP requests. The actual response will depend on the request method used. In a GET request, the response will contain an entity corresponding to the requested resource. In a POST request, the response will contain an entity describing or containing the result of the action."
    },
    Http201_Created:{
        status:201,
        statusText:"Created",
        meaning:"The request has been fulfilled, resulting in the creation of a new resource."
    },
    Http202_Accepted:{
        status:202,
        statusText:"Accepted",
        meaning:"The request has been accepted for processing, but the processing has not been completed. The request might or might not be eventually acted upon, and may be disallowed when processing occurs."
    },
    Http204_No_Content:{
        status:204,
        statusText:"No Content",
        meaning:"The server successfully processed the request, and is not returning any content."
    }
};

export const HttpErrorStatus = {
    Http400_Bad_Request:{
        status:400,
        statusText:"Bad Request",
        meaning:"The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing)."
    },
    Http401_Unauthorized:{
        status:401,
        statusText:"Unauthorized",
        meaning:"Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided. The response must include a WWW-Authenticate header field containing a challenge applicable to the requested resource. See Basic access authentication and Digest access authentication. 401 semantically means 'unauthorised', the user does not have valid authentication credentials for the target resource."
    },
    Http403_Forbidden:{
        status:403,
        statusText:"Forbidden",
        meaning:"The request contained valid data and was understood by the server, but the server is refusing action. This may be due to the user not having the necessary permissions for a resource or needing an account of some sort, or attempting a prohibited action (e.g. creating a duplicate record where only one is allowed). This status is also typically used if the request provided authentication by answering the WWW-Authenticate header field challenge, but the server did not accept that authentication. The request should not be repeated."
    },
    Http404_Not_Found:{
        status:404,
        statusText:"Not Found",
        meaning:"The requested resource could not be found but may be available in the future. Subsequent requests by the client are permissible."
    },
    Http500_Internal_Server_Error:{
        status:500,
        statusText:"Internal Server Error",
        meaning:"The server has encountered a situation it does not know how to handle."
    },
    Http501_Not_Implemented:{
        status:501,
        statusText:"Not Implemented",
        meaning:"The server either does not recognize the request method, or it lacks the ability to fulfil the request. Usually this implies future availability (e.g., a new feature of a web-service API)."
    },
    Http502_Bad_Gateway:{
        status:502,
        statusText:"Bad Gateway",
        meaning:"The server, while acting as a gateway or proxy, received an invalid response from an upstream server it accessed to fulfill the request."
    }
};
