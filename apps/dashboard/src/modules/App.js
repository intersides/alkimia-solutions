import { utilities, ElementState } from "@alkimia/lib";
import ServiceEntry from "../components/ServiceEntry.js";

//language=CSS
let style  = `
    :root {
      --g_font-family: Helvetica, Arial, sans-serif;
      --g_line-height: 1.5;
    }

    .App {
      display: inline-block;
      border: 2px solid blue;
      padding: .2rem;
      section{
          border: 2px solid green;
          margin: .5rem;           
          padding: .5rem;           
      }
    }
    
    .App #service_list{
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }
`;

//language=HTML
const htmlTemplate = `
    <section class="services">
		<h3>Services</h3>
        <div id="service_list"></div>
	</section>
`;

export default function App(args){

    let { websocketService, mqttService } = utilities.transfer(args, {
        websocketService:null,
        mqttService:null
    });


    const instance = Object.create(App.prototype);

    const _customElement = utilities.createAndRegisterWidgetElement("App");
    instance.element = new _customElement(style, htmlTemplate);

    function _onAppended() {
        console.log("_onAppended should be delegated");
    }

    let [counter, setCounter] = [null, (_event) => {}];
    let [list, setList] = [null, (_color) => {}];

    //children elements
    let $Parent = null,
        $input = null,
        $serviceListRoot = null;
    /**
     *
     * @return {App}
     * @private
     **/
    const _initialize = ()=>{
        _initView();
        _registerEvents();
        return instance;
    };

    function _fetchServices(){
        return new Promise((resolve, reject) => {
            fetch("proxy/getServices", {
                method:"POST",
                body: JSON.stringify({
                    status:"running"
                })
            })
                .then(res=>{
                    return res.json();
                })
                .then((data)=>{
                    resolve(data);
                })
                .catch(err=>{
                    console.error(err);
                    reject(err);
                });
        });

    }

    function _initView(){
        $serviceListRoot = instance.element.view.querySelector("#service_list");
    }


    let services = {};

    function _updateServiceEntry(service){

        if(!services[service.id]){
            let serviceEntry = ServiceEntry(service);
            services[service.id] = serviceEntry;
            serviceEntry.appendTo($serviceListRoot);
        }
        services[service.id].setData(service);

    }

    instance.isAttached = function(){
        return instance.element.parentNode !== null;
    };

    /**
     * @param {HTMLElement} _parent
     */
    instance.appendTo = (_parent)=>{
        _parent.appendChild(instance.element);
        $Parent = _parent;
        _onAppended();
    };

    function _registerEvents(){
        _onAppended = () => {};

        if(mqttService){
            mqttService.onTopicMessage(function(topic, message){
                console.debug("DEBUG: onTopicMessage", topic, message);
                _updateServiceEntry(message);
            });
        }


    }

    return _initialize();
}
