import { utilities, ElementState } from "@alkimia/lib";


//language=CSS
let style  = function(){

    return `
        .ServiceEntry {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            border: 1px solid #0000ee;
            border-radius: .3rem;
            padding: .4rem;
        }

        .ServiceEntry[data-state="healthy"] {
            background-color: rgb(213, 243, 213);
        }

        .ServiceEntry[data-state="stressed"] {
            background-color: rgb(232, 152, 117);
        }

        .ServiceEntry[data-state="panic"] {
            background-color: rgb(216, 40, 63);
        }

        .ServiceEntry > section {
        }

        .ServiceEntry > section ul {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: .3rem;
        }

        .ServiceEntry > section label {
            display: flex;
            gap: .2rem;
        }

        .ServiceEntry > section label > span:last-child {
            font-weight: 800;
        }

        .ServiceEntry #cpu_percentage {
            padding: .1rem;
            line-height: 1rem;
        }

        .ServiceEntry #cpu_percentage::after,
        .ServiceEntry #memory_percentage::after {
            content: "%";
            display: inline-block;
            margin: 0 .2rem;
            opacity: .5;
        }

    `;
};

function html(){

    return `
                <section>
                    <label>
                        <span>service:</span>
                        <span id="service_name">not set</span>
                    </label>
                </section>
                
                <section>
                    <label>
                        <span>cpu usage:</span>
                        <span id="cpu_percentage">0</span>
                    </label>
                </section>

                <section>
                    <span>memory</span>
                    <ul>
                        <li>
                            <label>
                            <span>used</span>
                            <span id="memory_used">0</span>
                            </label>
                        </li>
                        <li>
                            <label>
                            <span>limit</span>
                            <span id="memory_limit">0</span>
                            </label>
                        </li>
                        <li>
                            <label>
                            <span>used bytes</span>
                            <span id="memory_used_bytes">0</span>
                            </label>
                        </li>
                        <li>
                            <label>
                            <span>limit bytes</span>
                            <span id="memory_limit_bytes">0</span>
                            </label>
                        </li>
                        <li>
                            <label>
                            <span>percentage</span>
                            <span id="memory_percentage">0</span>
                            </label>
                        </li>
                        
                    </ul>
                </section>
                `;
}


export default function ServiceEntry(_args){
    let instance = Object.create(ServiceEntry.prototype);

    let service = utilities.transfer(_args, {
        id: null,
        name: null,
        memory: {
            used: null,
            limit: null,
            usedBytes: null,
            limitBytes: null,
            percentage: null
        },
        cpu: null
    });

    const _customElement = utilities.createAndRegisterWidgetElement("ServiceEntry");
    instance.element = new _customElement(style(), html());
    instance.element.view.setAttribute("data-state", null);

    let [cpu, setCpu, onSetCpu] = new ElementState({
        element: instance.element.view.querySelector("#cpu_percentage"),
        attribute: ElementState.BindableAttribute.innertext.name,
        initialValue: service?.cpu
    });

    let [status, setStatus, onSetStatus] = new ElementState({
        element: instance.element.view,
        attribute: "data-state",
        initialValue: service?.state
        // transformer:function(){
        //
        // }
    });

    let [memoryUsed, setMemoryUsed, onSetMemeryUsed] = new ElementState({
        element: instance.element.view.querySelector("#memory_used"),
        attribute: ElementState.BindableAttribute.innertext.name,
        initialValue: service?.memory.used
    });

    let [memoryLimit, setMemoryLimit, onSetMemeryLimit] = new ElementState({
        element: instance.element.view.querySelector("#memory_limit"),
        attribute: ElementState.BindableAttribute.innertext.name,
        initialValue: service?.memory.limit
    });

    let [usedBytes, setUsedBytes, onSetUsedBytes] = new ElementState({
        element: instance.element.view.querySelector("#memory_used_bytes"),
        attribute: ElementState.BindableAttribute.innertext.name,
        initialValue: service?.memory.usedBytes
    });
    let [limitBytes, setLimitBytes, onSetLimitBytes] = new ElementState({
        element: instance.element.view.querySelector("#memory_limit_bytes"),
        attribute: ElementState.BindableAttribute.innertext.name,
        initialValue: service?.memory.limitBytes
    });
    let [memoryPercentage, setMemoryPercentage, onSetMemoryPercentage] = new ElementState({
        element: instance.element.view.querySelector("#memory_percentage"),
        attribute: ElementState.BindableAttribute.innertext.name,
        initialValue: service?.memory.percentage
    });

    let $Parent = null, $serviceName = null;

    function _onAppended() {
        console.log("_onAppended should be delegated");
    }

    function init(){
        console.debug("DEBUG: service", service);
        $serviceName = instance.element.view.querySelector("#service_name");
        instance.element.setAttribute("data-id", service?.id);
        $serviceName.innerText = service?.name;
        _registerEvents();
        setData(service);
        return instance;
    }

    onSetCpu((_value)=>{
        console.debug("DEBUG: _counter", _value);
    });

    function _registerEvents(){
        _onAppended = () => {};
    }

    /**
     * @param {HTMLElement} _parent
     */
    instance.appendTo = (_parent)=>{
        _parent.appendChild(instance.element);
        $Parent = _parent;
        _onAppended();
    };

    instance.isAttached = function(){
        return instance.element.parentNode !== null;
    };

    function setData(serviceData){
        instance.element.setAttribute("data-id", serviceData?.id);
        $serviceName.innerText = serviceData?.name;
        setStatus(serviceData?.status);
        setCpu( serviceData ? parseFloat((serviceData.cpu).toFixed(1)) : null);
        setMemoryUsed(serviceData?.memory.used);
        setLimitBytes(serviceData?.memory?.limitBytes);
        setMemoryPercentage(serviceData?.memory?.percentage?.toFixed(1));
        setUsedBytes(serviceData?.memory?.usedBytes);
        setMemoryLimit(serviceData?.memory?.limit);
    }

    instance.setData = setData;


    return init();

}
