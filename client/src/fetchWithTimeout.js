const fetchUrl = (url, options, retryLimit) => {
    let resPromise = fetch(url, options);
    resPromise.then(response => {
        console.log("should retry? " + retryLimit);
        if (response.status !== 200 && retryLimit > 0) {
            return fetchUrl(url, options, --retryLimit);
        }
    });
    return resPromise
}



export default function (url, options, timeout = 300000) {
    return Promise.race([
        fetch(url, options),
        fetchUrl(url, options, 2),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        )
    ]);
}