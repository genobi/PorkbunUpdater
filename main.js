//Includes
const https = require('https');
const { readFileSync } = require('fs');

//Config
const dns_entries = JSON.parse(readFileSync('../config.json', { encoding: 'utf8', flag: 'rs' }));
const interval = 5 * 60 * 1000;
const porkbun_settings = {
    host: "porkbun.com",
    path: "/api/json/v3/dns/editByNameType/"
};
var ip_address = "0.0.0.0";

//update interval if defined in ENV
if(typeof process.env.CHECK_INTERVAL != "undefined"){
    const interval = process.env.CHECK_INTERVAL;
}
//Every Interval, check for an IP, if it unchanged from last time, dont do anything, else update Porkbun.
const timer = setInterval(() => {
    const ip = getPublicIP();
    ip.then((ip_addr) => {
        console.log(ip_addr)
        if (ip_address != ip_addr){
            console.log("At " + new Date() + " the IP address changed from " + ip_address + " to " + ip_addr)
            ip_address = ip_addr;
            for (const entry of dns_entries) {
                let update_result = updateDNS(porkbun_settings, entry, ip_addr);
                update_result.catch( err => {console.log(err)})
            }
        } else {
            console.log("IP Address has not change. " + ip_address);
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
                console.log(err);
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
        const entry_path = porkbun_settings.path + entry.domain + "/" + entry.dns_type + "/" + entry.subdomain;
        const payload = {
            "secretapikey":entry.secret_api_key,
            "apikey": entry.api_key,
            "content": ip_addr,
            "ttl": "600"
        };
        /*
        let http_request = https.request({ 'host': porkbun_settings.host, 'port': porkbun_settings.port, 'path': entry_path, 'method':'POST' }, function (resp) {
            const { statusCode } = resp;
            if (statusCode !== 200) {
                reject("Could not update the Domain, receieved Status Code " + statusCode);
            };
            resp.on('data', function (result_str) {
                let result = JSON.parse(result_str);
                if(result.status === "SUCCESS"){
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
        */
    });
}