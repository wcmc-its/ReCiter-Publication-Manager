

static function requestWithRetry (uid, cb) {
    const MAX_RETRIES = 5
    let dataRetrieved = false
    let retryCount = 0
    console.log('retry')
    const retryInterval = setInterval(() => {
        if(retryCount < MAX_RETRIES && !dataRetrieved) {
            return getIdentity(uid, (err, results) => {
                if(err) return dataRetrieved = false
                dataRetrieved = true
                cb(null, results)
                return clearInterval(retryInterval)
            })
        }
        if(retryCount >= MAX_RETRIES && !dataRetrieved) {
            cb({
                message: 'failure'
            }, null)
            return clearInterval(retryInterval)
        }
        if(dataRetrieved)
        {
            clearInterval(retryInterval)
        }
    },500)
}

module.exports.requestWithRetry = requestWithRetry