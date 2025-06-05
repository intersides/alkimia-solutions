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
            sendMessage({
                msg: "message from stress agent!"
            });
        };

        ws.onmessage = (msg) => {
            console.info("WS MSG:", JSON.parse(msg.data));
            sendMessage({
                msg:"ABC - Stress Agent"
            });
        };

        ws.onerror = (err) => {
            console.error("ERROR: websocket error", err);
        };
    }

    function sendMessage(data){
        ws.send(JSON.stringify(data));
    }

    instance.sendMessage = sendMessage;

    return _initialize();
}
