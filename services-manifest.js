export default {

    "app.alkimia.localhost":{
        type:"docker",
        subdomain:"app",
        domain:"alkimia.localhost",
        port:7070,
        config:{
            tag:"",
            name:"alkimia-frontend",
            internal_port:3000
        }
    }

};
