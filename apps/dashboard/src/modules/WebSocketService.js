import { utilities } from "@alkimia/lib";

export default function WebSocketService(args){

    let { url }  = utilities.transfer(args, {
        url:null
    });
    
    const instance = Object.create(WebSocketService.prototype);
    let ws = null;
    /**
  *
  * @return {WebSocketService}
  * @private
  */
    const _initialize = ()=>{
        ws = new WebSocket(url);
        _registerEventHandlers();
        return instance;
    };

    function _registerEventHandlers(){

        ws.onopen = () => {
            console.debug("DEBUG: websocket is now open");
        // sendMessage({
        //     msg: "message from dashboard app!"
        // });
        };

        // ws.onmessage = (msg) => {
        //     console.info("WS MSG:", JSON.parse(msg.data));
        //     sendMessage({
        //         msg:"ABC - Dash"
        //     });
        // };
        //
        ws.onerror = (err) => {
            console.error("ERROR: websocket error", err);
        };

        ws.onclose = ()=>{
            console.log("closed ?");
        };

    }

    function sendMessage(data){
        ws.send(JSON.stringify(data));
    }
    
    return _initialize();
}

/**
 *
 * @type {WebSocketService}
 * @private
 */
let _instance = null;

WebSocketService.getSingleton = function(_args=null) {
    if(!_instance){
        _instance = WebSocketService(_args);
    }
    return _instance;
};

WebSocketService.getInstance = function(_args) {
    return WebSocketService(_args);
};
