import { utilities, ElementState } from "@alkimia/lib";
import { sayHello } from "@workspace/common";

//language=CSS
let style  = `
    :root {
      --g_font-family: Helvetica, Arial, sans-serif;
      --g_line-height: 1.5;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-family: var(--g_font-family), sans-serif;
      line-height: var(--g_line-height);
      color: #aa17b5;
    }
    
    .App {
      display: inline-block;
      border: 2px solid blue;
      padding: 2rem;
    }
`;

//language=HTML
const htmlTemplate = `
    <section>
        <h2></h2>
        <label>
            <span>my input</span>
            <input type="number" id="counter_input" min="0" max="100" step="1" />
        </label>
    </section>
    
    <section>
        <p>counter <span id="counter_value">abc</span></p>
        
        <div>
            <label>
                <span>counter list</span>
            </label>
            <ul>
                <li class="list_item_template">0</li>
            </ul>
        </div>
        
        <label>
            <span>list</span>
        </label>
    
    </section>`;

export default function App(args){

    let { websocketService } = utilities.transfer(args, {
        websocketService:null
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
    let $input = null,
        $h2 = null,
        $counter = null,
        $list = null,
        $listItemTemplate = null;

    let _vParent = null;

    /**
  *
  * @return {App}
  * @private
  */
    const _initialize = ()=>{
        _initView();
        _registerEvents();
        return instance;
    };

    function _initView(){

        $h2 = instance.element.view.querySelector("h2");
        $input = instance.element.view.querySelector("input");
        $counter = instance.element.view.querySelector("#counter_value");
        $list = instance.element.view.querySelector("ul");
        $listItemTemplate = instance.element.view.querySelector(".list_item_template");

        $h2.textContent = sayHello("My ES6 App!");

        [counter, setCounter] = new ElementState({
            element: $counter,
            attribute: ElementState.BindableAttribute.innertext.name,
            initialValue: 0
        });

        [list, setList] = new ElementState({
            element: $list,
            attribute: ElementState.BindableAttribute.children,
            initialValue: [],
            transformer: (list) => {
                if (list) {
                    return list.map((_listItem) => {
                        const listItemTemplate = $listItemTemplate.cloneNode(true);
                        listItemTemplate.innerText = _listItem;
                        return listItemTemplate;
                    });
                }
                else {
                    return [];
                }
            }
        });

    }

    instance.isAttached = function(){
        return instance.element.parentNode !== null;
    };

    /**
   * @param {HTMLElement} _parent
   */
    instance.appendTo = (_parent)=>{
        _parent.appendChild(instance.element);
        _vParent = _parent;
        _onAppended();
    };

    function _registerEvents(){
        _onAppended = () => {
            $input.value = counter.value; //from initialValue
        };

        if($input){
            $input.addEventListener("change", (evt) => {

                fetch("api/setCounter", {
                    method:"POST",
                    body: JSON.stringify({ counter })
                })
                    .then(res=>{
                        return res.json();
                    })
                    .then((data)=>{
                        console.log(data);
                    })
                    .catch(err=>{
                        console.error(err);
                    });

                setCounter(evt.target.value);
                setList([...list.value, evt.target.value]);
            });
        }

    }

    return _initialize();
}

/**
 *
 * @type {App}
 * @private
 */
let _instance = null;

App.getSingleton = function(_args=null) {
    if(!_instance){
        _instance = App(_args);
    }
    return _instance;
};

App.getInstance = function(_args) {
    return App(_args);
};
