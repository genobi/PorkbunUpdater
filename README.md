# Dynamic DNS Updater for Porkbun
This is a updater for Porkbun that will update dns entries to the public IP address of the machine running the script

## Setup
This should come ready to do. It only uses the built in node libraries, so there is nothing to update other than node.

## Config File
This uses a config file to determin what to update. It is a JSON file that stores an array of targets. It is stored one folder up from the executable to keep the secrets out of git, etc. 

### Config Example
```
[
    {
        "_comment": "This would update testsubdomain.example.com, setting the A record to the current public IP",
        "domain": "example.com",
        "subdomain": "testsubdomain",
        "api_key": "key",
        "secret_api_key": "secret_key",
        "dns_type": "A"
    }
]
```

## Docker
This was built to go into docker, but it can run outside of it.
