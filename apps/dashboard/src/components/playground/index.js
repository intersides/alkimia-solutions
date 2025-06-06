import ServiceEntry from "../ServiceEntry.js";

let service = {
    "id": "94ed86e1b2c621456a6fade22a9232b9c02856a562efa7c8521e179975fb0053",
    "name": "alkimia-backend-6842afc6bdbcc4c5c99bc852",
    "memory": {
        "used": "69.29MiB",
        "limit": "512MiB",
        "usedBytes": 72655831.04,
        "limitBytes": 536870912,
        "percentage": 13.533203125000002
    },
    "cpu": 0.78
};

let serviceEntry = ServiceEntry();
serviceEntry.setData(service);
serviceEntry.appendTo(document.body);

console.debug("DEBUG: serviceEntry", serviceEntry);
