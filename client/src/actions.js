import methods from './methods'
import fetchWithTimeout from './fetchWithTimeout';

export const addError = (message) =>
    ({
        type: methods.ADD_ERROR,
        payload: message
    })

export const clearError = index =>
    ({
        type: methods.CLEAR_ERROR,
        payload: index
    })

export const reciterLogin = login => dispatch => {

}

export const identityFetchData = uid => dispatch => {
    dispatch({
        type: methods.IDENTITY_FETCH_DATA
    })
    fetchWithTimeout('/api/reciter/getidentity/' + uid, {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    }, 300000)
        .then(response => {
            if(response.status === 200) {
                return response.json()
            }else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "Error occurred with api " + response.url + ". Please, try again later "
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.IDENTITY_CHANGE_DATA,
                payload: data.identity
            })

            dispatch({
                type: methods.IDENTITY_CANCEL_FETCHING
            })
        })
        .catch(error => {
            console.log(error)

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_FETCHING
            })

        })
}

export const identityFetchAllData = () => dispatch => {
    dispatch({
        type: methods.IDENTITY_FETCH_ALL_DATA
    })
    fetchWithTimeout('/api/reciter/getAllIdentity', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    }, 300000)
        .then(response => {
            if(response.status === 200) {
                return response.json()
            }else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "Error occurred with api " + response.url + ". Please, try again later "
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.IDENTITY_CHANGE_ALL_DATA,
                payload: data.identity
            })

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })
        })
        .catch(error => {
            console.log(error)
            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })

        })
}

export const reciterFetchData = (uid, refresh) => dispatch => {

    dispatch({
        type: methods.RECITER_FETCH_DATA
    })

    var url = '/api/reciter/feature-generator/' + uid
    if(refresh) {
        url += '?analysisRefreshFlag=true&retrievalRefreshFlag=ONLY_NEWLY_ADDED_PUBLICATIONS'
    }
    fetchWithTimeout(url, {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    }, 300000)
        .then(response => {
            if(response.status === 200) {
                return response.json()
            }else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "Error occurred with api " + response.url + ". Please, try again later "
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.RECITER_CHANGE_DATA,
                payload: data
            })

            dispatch({
                type: methods.RECITER_CANCEL_FETCHING
            })
        })
        .catch(error => {

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.RECITER_CANCEL_FETCHING
            })

        })

}

export const pubmedFetchData = query => dispatch => {
    dispatch({
        type: methods.PUBMED_FETCH_DATA
    })
    fetchWithTimeout('/api/reciter/search/pubmed', {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
    }, 300000)
        .then(response => {
            var errorMessage = ''
            if(response.status === 200) {
                return response.json()
            }else {
                response.json().then(parsedResponse => {
                    errorMessage = parsedResponse.error.message
                    console.log(errorMessage)
                })
                throw {
                    type: response.type,
                    title: errorMessage,
                    status: response.status,
                    detail: "Error occurred with api " + response.url + ". Please, try again later "
                } 
            }
        })
        .then(data => {
            dispatch({
                type: methods.PUBMED_CHANGE_DATA,
                payload: data.reciter
            })

            dispatch({
                type: methods.PUBMED_CANCEL_FETCHING
            })
        })
        .catch(error => {

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.PUBMED_CANCEL_FETCHING
            })

        })

}

export const reciterUpdatePublication = (uid, request) => dispatch => {

    // Update publications' user assertions state
    request.publications.forEach(function(id){
        switch(request.userAssertion) {
            case "ACCEPTED":
                dispatch({
                    type: methods.ACCEPT_PUBLICATION,
                    payload: id,
                    manuallyAddedFlag: request.manuallyAddedFlag
                })
                break
            case "REJECTED":
                dispatch({
                    type: methods.REJECT_PUBLICATION,
                    payload: id,
                    manuallyAddedFlag: request.manuallyAddedFlag
                })
                break
            case "NULL":
                dispatch({
                    type: methods.UNDO_PUBLICATION,
                    payload: id
                })
                break
        }
    })

    // Send request to the API to update publications
    var facultyUserName = "";
    /* if(request.faculty !== undefined) {
        if(request.faculty.firstName !== undefined) {
            facultyUserName += request.faculty.firstName + ' ';
        }
        if(request.faculty.middleName !== undefined) {
            facultyUserName += request.faculty.middleName + ' ';
        }
        if(request.faculty.lastName !== undefined) {
            facultyUserName += request.faculty.lastName + ' ';
        }
    } */

    facultyUserName = request.faculty.primaryName.firstName + ((request.faculty.primaryName.middleName !== undefined)? ' ' + request.faculty.primaryName.middleName + ' ':' ') + request.faculty.primaryName.lastName

    if(request.userAssertion === 'ACCEPTED' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": request.publications,
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "knownPmids": request.publications,
            "uid": uid
        };
    } else if(request.userAssertion === 'REJECTED' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": request.publications,
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "rejectedPmids": request.publications,
            "uid": uid
        };
    } else if(request.userAssertion === 'NULL' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": request.publications,
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "knownPmids": request.publications,
            "rejectedPmids": request.publications,
            "uid": uid
        };
    } else if(request.userAssertion === 'ACCEPTED' && request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": [request.publications[0].pmid],
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "knownPmids": [request.publications[0].pmid],
            "uid": uid
        };
    } else if(request.userAssertion === 'REJECTED' && request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": [request.publications[0].pmid],
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "rejectedPmids": [request.publications[0].pmid],
            "uid": uid
        };
    }


    var url = '/api/reciter/update/goldstandard?goldStandardUpdateFlag=UPDATE';
    if(request.userAssertion === 'NULL') {
        url = '/api/reciter/update/goldstandard?goldStandardUpdateFlag=DELETE'
    }

    fetchWithTimeout(url, {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(goldStandard)
    }, 300000)
    .then(response => {
        if(response.status === 200) {
            return response.json()
        }else {
            throw {
                type: response.type,
                title: response.statusText,
                status: response.status,
                detail: "Error occurred with api " + response.url + ". Please, try again later "
            }
        }
    })
    .catch(error => {

        dispatch(
            addError(error)
        )

        dispatch({
            type: methods.RECITER_CANCEL_FETCHING
        })

    })

}

export const authUser = auth => dispatch => {
    return fetchWithTimeout('/users/reciter/authentication', {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(auth)
    }, 300000)
    .then(r => r.json())
    .then(results => {
        if(!results.success)
        {
            return dispatch({
                type: methods.USER_LOGOUT,
            })
        }
        return dispatch({
            type: methods.USER_LOGIN,
            auth: {
                username: results.data.username || '',
                isLoggedIn: results.success || false,
                accessToken: results.data.accessToken
            }
        })
    })
    .catch(err => {
        return dispatch(
            addError(err)
        )
    })
}

export const storeUsername = username => ({
    type: methods.USER_LOGIN,
    auth: {
        username: username,
        isLoggedIn: true
    }
})

export const getSession = sid => dispatch => {
    dispatch({
        type: methods.GET_SESSION_ID,
        payload: 'test'
    })
    return fetch('/users/getSession')
    .then(r => {
        console.log(r)
    })
    // .then(r => r.json())
    // .then(response => {
    //     console.log(`got response`)
    //     console.log(response)
    //     dispatch({
    //         type: methods.GET_SESSION_ID,
    //         payload: 'test'
    //     })
    // })
    .catch(err => {
        console.log(err)
        return dispatch(
            addError(err)
        )
    })
}