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
        code:200,
        value:"OK",
        meaning:"Standard response for successful HTTP requests. The actual response will depend on the request method used. In a GET request, the response will contain an entity corresponding to the requested resource. In a POST request, the response will contain an entity describing or containing the result of the action."
    },
    Http201_Created:{
        code:201,
        value:"Created",
        meaning:"The request has been fulfilled, resulting in the creation of a new resource."
    },
    Http202_Accepted:{
        code:202,
        value:"Accepted",
        meaning:"The request has been accepted for processing, but the processing has not been completed. The request might or might not be eventually acted upon, and may be disallowed when processing occurs."
    },
    Http4040_No_Content:{
        code:404,
        value:"No Content",
        meaning:"The server successfully processed the request, and is not returning any content."
    }
};

export const HttpErrorStatus = {
    Http400_Bad_Request:{
        code:400,
        value:"Bad Request",
        meaning:"The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing)."
    },
    Http401_Unauthorized:{
        code:401,
        value:"Unauthorized",
        meaning:"Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided. The response must include a WWW-Authenticate header field containing a challenge applicable to the requested resource. See Basic access authentication and Digest access authentication. 401 semantically means 'unauthorised', the user does not have valid authentication credentials for the target resource."
    },
    Http403_Forbidden:{
        code:403,
        value:"Forbidden",
        meaning:"The request contained valid data and was understood by the server, but the server is refusing action. This may be due to the user not having the necessary permissions for a resource or needing an account of some sort, or attempting a prohibited action (e.g. creating a duplicate record where only one is allowed). This code is also typically used if the request provided authentication by answering the WWW-Authenticate header field challenge, but the server did not accept that authentication. The request should not be repeated."
    },
    Http404_Not_Found:{
        code:404,
        value:"Not Found",
        meaning:"The requested resource could not be found but may be available in the future. Subsequent requests by the client are permissible."
    },
    Http500_Internal_Server_Error:{
        code:500,
        value:"Internal Server Error",
        meaning:"The server has encountered a situation it does not know how to handle."
    },
    Http501_Not_Implemented:{
        code:501,
        value:"Not Implemented",
        meaning:"The server either does not recognize the request method, or it lacks the ability to fulfil the request. Usually this implies future availability (e.g., a new feature of a web-service API)."
    }
};
