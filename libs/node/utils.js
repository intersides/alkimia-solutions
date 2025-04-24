import bcrypt from "bcryptjs";
import { utilities } from "@alkimia/lib";
import * as path from "node:path";
import fs from "fs";

export default {

    hashPassword: function(_password) {
        return new Promise((resolve, reject) => {
            bcrypt.genSalt(10, (saltError, salt) => {
                if(saltError) {
                    reject(saltError);
                }
                else {
                    bcrypt.hash(_password, salt, (hashError, hash) => {
                        if(hashError) {
                            reject(hashError);
                        }
                        resolve(hash);
                    });
                }
            });
        });
    },

    comparePassword: function(password1, password2) {
        return new Promise((resolve) => {
            try {
                bcrypt.compare(password1, password2, function(error, isMatch) {
                    if(error) {
                        console.error(error.message);
                        resolve(false);
                    }
                    else {
                        resolve(isMatch);
                    }
                });
            }
            catch(e) {
                console.error(e.message);
                resolve(false);
            }
        });
    },

    isFileInDirectory: function(fileName, directoryPath) {
        console.debug("directoryPath", directoryPath);
        const filePath = path.join(directoryPath, fileName);
        return fs.existsSync(filePath);
    }



};
