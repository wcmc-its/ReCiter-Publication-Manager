const fetchUrl = (url, options, retryLimit) => {
    let resPromise = fetch(url, options);
    resPromise.then(response => {
        if (response.status !== 200 && retryLimit > 0) {
            return fetchUrl(url, options, --retryLimit);
        }
    });
    return resPromise
}



export default function (url, options, timeout = 300000) {
        return fetchUrl(url, options, 2);
}