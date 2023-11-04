//Includes
const https = require('https');
const { readFileSync } = require('fs');
const internal = require('stream');

//Config
const interval = 1 * 60 * 1000;
const porkbun_settings = {
    host: "porkbun.com",
    update_by_type_path: "/api/json/v3/dns/editByNameType/",
    check_by_type_path: "/api/json/v3/dns/retrieveByNameType/"
};
const file_location = "../config.json";
const log_level = 1;
var ip_address = "0.0.0.0";

//update properties if defined in ENV
if (typeof process.env.CHECK_INTERVAL != "undefined") {
    const interval = process.env.CHECK_INTERVAL;
}
if (typeof process.env.CONFIG_FILE != "undefined") {
    const file_location = process.env.CONFIG_FILE;
}
if (typeof process.env.PORTBUN_HOST != "undefined") {
    porkbun_settings.host = process.env.PORTBUN_HOST;
}
if (typeof process.env.PORKBUN_UPDATE_BY_TYPE_PATH != "undefined") {
    porkbun_settings.update_by_type_path = process.env.PORKBUN_UPDATE_BY_TYPE_PATH;
}
if (typeof process.env.PORKBUN_CHECK_BY_TYPE_PATH != "undefined") {
    porkbun_settings.check_by_type_path = process.env.PORKBUN_UPDATE_BY_TYPE_PATH;
}
if (typeof process.env.LOG_LEVEL != "undefined") {
    log_level = process.env.LOG_LEVEL;
}

//Every Interval, check for an IP, if it unchanged from last time, dont do anything, If it changes check Porkbun first to see if it already matches, else update Porkbun.
const timer = setInterval(() => {
    const ip = getPublicIP();
    ip.then((ip_addr) => {
        if (ip_address != ip_addr) {
            log("At " + new Date() + " the IP address changed from " + ip_address + " to " + ip_addr, 2)
            ip_address = ip_addr;

            //Get the config right before needing it. Yes this means it will be sync reading multiple times, but this should run once in a long while, so this lets us update the config without reloading the container.
            const dns_entries = JSON.parse(readFileSync(file_location, { encoding: 'utf8', flag: 'rs' }));
            if(!validateEntities(dns_entries)){
                //If the file is not valid, console messages would have been thrown and we can just skip this update.
                return;
            }
            for (const entry of dns_entries) {
                if(checkDNS(porkbun_settings, entry, ip_addr)){
                    log("IP Address matches Porkbun already",1);
                } else {
                    log("IP Address does not match Porkbun",1);
                }
                //let update_result = updateDNS(porkbun_settings, entry, ip_addr);
                //update_result.catch( err => {log(err, 4)})
            }
        } else {
            log("IP Address has not change. " + ip_address, 1);
        }
    })
}, interval)

/**
 * Returns the public IP of the device running this code. Uses the ipify.org API.
 * @returns {string} The Public IP of the device running the code
 */
function getPublicIP() {
    return new Promise((resolve, reject) => {
        https.get({ 'host': 'api.ipify.org', 'port': 443, 'path': '/' }, function (resp) {
            const { statusCode } = resp;
            if (statusCode !== 200) {
                reject("Receieves Status Code " + statusCode);
            };
            resp.on('error', (err) => {
                log(err, 3);
                reject(err);
            })
            resp.on('data', (ip) => {
                resolve(ip.toString());
            });
        });
    });
}

/**
 * This method posts an update to Porkbun that updates a single DNS record with the current public IP
 * @param {*} porkbun_settings This should be a set of setting for access porkbun in general
 * @param {*} entry This is the configuration for the specific DNS record that is being updated. 
 * @param {*} ip_addr This is the public IP address to update the records to.
 * @returns {Promise} Returns a promise for updating the dns entry. 
 */
function updateDNS(porkbun_settings, entry, ip_addr) {
    return new Promise((resolve, reject) => {
        const entry_path = porkbun_settings.update_by_type_path + entry.domain + "/" + entry.dns_type + "/" + entry.subdomain;
        const payload = {
            "secretapikey": entry.secret_api_key,
            "apikey": entry.api_key,
            "content": ip_addr,
        };
        let http_request = https.request({ 'host': porkbun_settings.host, 'port': porkbun_settings.port, 'path': entry_path, 'method': 'POST' }, function (resp) {
            const { statusCode } = resp;
            if (statusCode !== 200) {
                reject("Could not update the Domain, receieved Status Code " + statusCode);
            };
            resp.on('data', function (result_str) {
                let result = JSON.parse(result_str);
                if (result.status === "SUCCESS") {
                    resolve();
                } else {
                    reject("Could not update the domain, return was: \n" + result_str)
                }
            });
        });

        http_request.write(JSON.stringify(payload));
        http_request.end();

        http_request.on('error', (err) => {
            reject(err);
        })
    });
}

/**
 * This method checks if the dns record matches the passed in public IP
 * @param {*} porkbun_settings This should be a set of setting for access porkbun in general
 * @param {*} entry This is the configuration for the specific DNS record that is being checked. 
 * @param {*} ip_addr This is the public IP address to check if it matches.
 * @returns {Promise} Returns a promise for whther or not the IP has changed.  
 */
function checkDNS(porkbun_settings, entry, ip_addr) {
    return new Promise((resolve, reject) => {
        const entry_path = porkbun_settings.check_by_type_path + entry.domain + "/" + entry.dns_type + "/" + entry.subdomain;
        const payload = {
            "secretapikey": entry.secret_api_key,
            "apikey": entry.api_key,
        };

        let http_request = https.request({ 'host': porkbun_settings.host, 'port': porkbun_settings.port, 'path': entry_path, 'method': 'POST' }, function (resp) {
            const { statusCode } = resp;
            if (statusCode !== 200) {
                reject("Could not update the Domain, receieved Status Code " + statusCode);
            };
            resp.on('data', function (result_str) {
                let result = JSON.parse(result_str);
                if (result.status === "SUCCESS") {
                    if (result.records[0].content === ip_addr) {
                        resolve(true)
                    } else {
                        resolve(false);
                    }
                } else {
                    reject("Could not update the domain, return was: \n" + result_str)
                }
            });
        });

        http_request.write(JSON.stringify(payload));
        http_request.end();

        http_request.on('error', (err) => {
            reject(err);
        })
    });
}

/**
 * Takes in a dns_entries array and validates that it is properly set. 
 * @param {Array} dns_entries This is the array of DNS entries that are going to be maintained by this script
 * @returns {Boolean} Whether or not the array is formatted properly.
 */
function validateEntities(dns_entries) {
    if (!Array.isArray(dns_entries)){
        log("Invalid Config File. Must be an array of entries. See Example file.", 4);
        return false;
    }
    for (let i in dns_entries) {
        if(typeof dns_entries[i].domain !== "string"){
            log("Invalid Config File. Entry number " + i + " has the wrong datatype for domain or it is missing", 4);
            return false;
        }
        if(typeof dns_entries[i].subdomain !== "string"){
            log("Invalid Config File. Entry number " + i + " has the wrong datatype for subdomain or it is missing", 4);
            return false;
        }
        if(typeof dns_entries[i].api_key !== "string"){
            log("Invalid Config File. Entry number " + i + " has the wrong datatype for api_key or it is missing", 4);
            return false;
        }
        if(typeof dns_entries[i].secret_api_key !== "string"){
            log("Invalid Config File. Entry number " + i + " has the wrong datatype for secret_api_key or it is missing", 4);
            return false;
        }
        if(typeof dns_entries[i].dns_type !== "string"){
            log("Invalid Config File. Entry number " + i + " has the wrong datatype for dns_type or it is missing", 4);
            return false;
        }
    }
    return true;
}

/**
 * @param {string} msg Message to log
 * @param {number} level The log level for the message. 1: Debug; 2: Information; 3:Soft Error; 4:critical error
 */
function log(msg, level){
    if(level === 4 && log_level <= 4){
        console.log(msg);
    } else if(level === 3 && log_level <= 3){
        console.log(msg);
    } else if(level === 2 && log_level <= 2){
        console.log(msg);
    } else if(level === 1 && log_level <= 1){
        console.log(msg);
    } 
}