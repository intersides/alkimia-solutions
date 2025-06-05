import { utilities, ElementState } from "@alkimia/lib";


//language=CSS
let style  = function(){

    return `
        .App {
            display: inline-block;
            border: 2px solid #0000ee;
            padding: 2rem;
        }
    `;
};


export default function App(_args){
    let instance = Object.create(App.prototype);

    let { wsService } = utilities.transfer(_args, {
        wsService:null
    });

    const _customElement = utilities.createAndRegisterWidgetElement("App");

    let [counter, setCounter, onSetCounterEffect] = [null, (_newValue) => {}, (_changedValue)=>{}];

    let $Parent = null,
        $stressRangeInput = null,
        $counter = null;

    function _onAppended() {
        console.log("_onAppended should be delegated");
    }

    function init(){
        _initView();
        _registerEvents();

        return instance;
    }

    onSetCounterEffect((_counter)=>{
        console.debug("DEBUG: _counter", _counter);
    });

    function _initView(){
        instance.element = new _customElement(style(), html());

        $counter = instance.element.view.querySelector("#counter_value");
        $stressRangeInput = instance.element.view.querySelector("#stressRange");

        [counter, setCounter, onSetCounterEffect] = new ElementState({
            element: $counter,
            attribute: ElementState.BindableAttribute.innertext.name,
            initialValue: 1
        });

    }

    function _registerEvents(){
        _onAppended = () => {};

        $stressRangeInput.addEventListener("change", function(evt){
            console.debug("DEBUG: evt", evt.target.value);
            wsService.sendMessage({
                stressValue:evt.target.value
            });
            setCounter(evt.target.value);
        });
    }

    /**
     * @param {HTMLElement} _parent
     */
    instance.appendTo = (_parent)=>{
        _parent.appendChild(instance.element);
        $Parent = _parent;
        // _onAppended();
    };

    instance.isAttached = function(){
        return instance.element.parentNode !== null;
    };

    function html(){

        return `<img alt="logo" width="150px" src="intersides_logo.svg">
                <h1>Alkimia Stress Agent</h1>
                
                <section>
                  <input id="stressRange" type="range" min="1" max="100" value="50" >
                </section>
                
                <section>
                    <span>stress level:</span>
                    <span id="counter_value">0</span>
                </section>
                `;
    }

    return init();

}
