import { utilities } from "@alkimia/lib";

export default {


    /**
     * split an url in the format /api/abc/def into parts
     * @param slashesDelimitedString
     * @return {{routes: string[], apiRoot: string}}
     */
    extractUrlParts: function(slashesDelimitedString) {
        const cleanedString = slashesDelimitedString.substring(1);
        //assume the first character to be a forward slash
        const urlParts = cleanedString.split("/");
        return {
            apiRoot: urlParts.shift(),
            routes: urlParts
        };
    },

    fileNameFromUrl: function(url){
        const regex = /\/([^\/?#]+?\.[^\/?#.]+)(?=[?#]|$)/;
        const match = url.match(regex);
        if (match) {
            return match[1];
        }
        else {
            return null;
        }
    }

};
