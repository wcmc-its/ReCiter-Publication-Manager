import methods from '../methods/methods'
import fetchWithTimeout from '../../pages/fetchWithTimeout';
import { toast } from "react-toastify"
import { reciterConfig } from '../../../config/local';
import { useSession} from 'next-auth/client';
import { ErrorTwoTone } from '@mui/icons-material';

export const addError = (message) =>
    ({
        type: methods.ADD_ERROR,
        payload: message
    })

export const clearError = () =>
    ({
        type: methods.CLEAR_ERROR
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
            Accept: 'application/json',
            'Authorization': reciterConfig.backendApiKey
        }
    }, 300000)
        .then(response => {
            if(response.status === 200) {
                toast.success("Identity Api successfully fetched for " + uid, {
                    position: "top-right",
                    autoClose: 1000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: 'dark'
                });
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

            toast.success("Identity Api failed for " + uid + " - " + error.title, {
                position: "top-right",
                autoClose: 1000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark'
            });

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
    fetchWithTimeout('/api/db/users', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
        }
    }, 300000)
        .then(response => {
            if(response.status === 200) {
                toast.success("Identity All Api successfully fetched", {
                    position: "top-right",
                    autoClose: 1000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: 'dark'
                });
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
                payload: data
            })

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })
        })
        .catch(error => {
            console.log(error)
            toast.error("Identity All Api failed - " + error.title, {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark'
                });
            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })

        })
}

export const identityFetchPaginatedData = (page, limit) => dispatch => {
  const offset = (page - 1) * limit;
  dispatch({
      type: methods.IDENTITY_FETCH_PAGINATED_DATA
  })
  fetchWithTimeout(`/api/db/users?offset=${offset}&limit=${limit}`, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
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
              type: methods.IDENTITY_CHANGE_PAGINATED_DATA,
              payload: data
          })

          dispatch({
              type: methods.IDENTITY_CANCEL_PAGINATED_FETCHING
          })
      })
      .catch(error => {
          console.log(error)
          dispatch(
              addError(error)
          )

          dispatch({
              type: methods.IDENTITY_CANCEL_PAGINATED_FETCHING
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
            Accept: 'application/json',
            'Authorization': reciterConfig.backendApiKey
        }
    }, 300000)
        .then(response => {
            if(response.status === 200) {
                toast.success("Feature generator Api successfully fetched for " + uid, {
                    position: "top-right",
                    autoClose: 1000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: 'dark'
                    });
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
            console.log(data)
            dispatch({
                type: methods.RECITER_CHANGE_DATA,
                payload: data
            })

            dispatch({
                type: methods.RECITER_CANCEL_FETCHING
            })
        })
        .catch(error => {

            toast.error("Feature generator api for " + uid + " failed - " + error.title  , {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark'
                });

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
            'Authorization': reciterConfig.backendApiKey
        },
        body: JSON.stringify(query)
    }, 300000)
        .then(response => {
            return response.json()
        })
        .then(data => {
            console.log(data)
            if(data.statusCode != 200) {
                throw {
                    title: data.reciter.message,
                    status: data.reciter.status,
                    limit: data.reciter.limit
                } 
            } else {
                dispatch(
                    clearError()
                )
                toast.success("Pubmed query successfully fetched", {
                    position: "top-right",
                    autoClose: 1000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: 'dark'
                    });
                dispatch({
                    type: methods.PUBMED_CHANGE_DATA,
                    payload: data.reciter
                })

                dispatch({
                    type: methods.PUBMED_CANCEL_FETCHING
                })
            }
            
        })
        .catch(error => {
            toast.error("Pubmed query " + query["strategy-query"] + " failed", {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark'
                });

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.PUBMED_CANCEL_FETCHING
            })

            dispatch({
                type: methods.PUBMED_CLEAR_DATA
            })

        })

}

export const reciterUpdatePublication = (uid, request) => dispatch => {

    const [session, loading] = useSession()

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
                    "uid": session.data.username,
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
                    "uid": session.data.username,
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
                    "uid": session.data.username,
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
                    "uid": session.data.username,
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
                    "uid": session.data.username,
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
            'Content-Type': 'application/json',
            'Authorization': reciterConfig.backendApiKey
        },
        body: JSON.stringify(goldStandard)
    }, 300000)
    .then(response => {
        if(response.status === 200) {
            toast.success("GoldStandard updated successfully for user" + uid, {
                position: "top-right",
                autoClose: 1000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark'
                });
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

        console.log(error)
        toast.error("Update GoldStandard Api Error" + error.title + " for " + uid, {
            position: "top-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: 'dark'
            });

        dispatch(
            addError(error)
        )

        dispatch({
            type: methods.RECITER_CANCEL_FETCHING
        })

    })

}

export const authUser = auth => dispatch => {
    return fetchWithTimeout('/api/reciter/authentication', {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': reciterConfig.backendApiKey
        },
        body: JSON.stringify(auth)
    }, 300000)
    .then(r => r.json())
    .then(results => {
        console.log(results.statusCode)
        if(results.statusCode !== 200)
        {   
            toast.error("Invalid credentials", {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                });
            return dispatch({
                type: methods.USER_LOGOUT,
                auth: {
                    isLoggedIn: false,
                }
            })
            
        } else {
            return dispatch({
                type: methods.USER_LOGIN,
                auth: {
                    username: results.message.sid || '',
                    isLoggedIn: (results.message.accessToken !== undefined)? true:false,
                    accessToken: results.message.accessToken
                }
            })
        }
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

export const orgUnitsFetchAllData = () => dispatch => {
  dispatch({
      type: methods.ORGUNITS_FETCH_ALL_DATA
  })
  fetchWithTimeout('/api/db/users/orgunits', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
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
              type: methods.ORGUNITS_CHANGE_ALL_DATA,
              payload: data
          })

          dispatch({
              type: methods.ORGUNITS_CANCEL_ALL_FETCHING
          })
      })
      .catch(error => {
          console.log(error)
          toast.error("Organizational Units Api failed - " + error.title, {
              position: "top-right",
              autoClose: 2000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: 'dark'
              });
          dispatch(
              addError(error)
          )

          dispatch({
              type: methods.ORGUNITS_CANCEL_ALL_FETCHING
          })

      })
}

export const institutionsFetchAllData = () => dispatch => {
  dispatch({
      type: methods.INSTITUTIONS_FETCH_ALL_DATA
  })
  fetchWithTimeout('/api/db/users/institutions', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
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
              type: methods.INSTITUTIONS_CHANGE_ALL_DATA,
              payload: data
          })

          dispatch({
              type: methods.INSTITUTIONS_CANCEL_ALL_FETCHING
          })
      })
      .catch(error => {
          console.log(error)
          toast.error("Institutional Units Api failed - " + error.title, {
              position: "top-right",
              autoClose: 2000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: 'dark'
              });
          dispatch(
              addError(error)
          )

          dispatch({
              type: methods.INSTITUTIONS_CANCEL_ALL_FETCHING
          })

      })
}

export const personTypesFetchAllData = () => dispatch => {
  dispatch({
      type: methods.PERSON_TYPES_FETCH_ALL_DATA
  })
  fetchWithTimeout('/api/db/users/persontypes', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
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
              type: methods.PERSON_TYPES_CHANGE_ALL_DATA,
              payload: data
          })

          dispatch({
              type: methods.PERSON_TYPES_CANCEL_ALL_FETCHING
          })
      })
      .catch(error => {
          console.log(error)
          toast.error("Person Types Api failed - " + error.title, {
              position: "top-right",
              autoClose: 2000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: 'dark'
              });
          dispatch(
              addError(error)
          )

          dispatch({
              type: methods.PERSON_TYPES_CANCEL_ALL_FETCHING
          })

      })
}

export const updateFilters = ( filter ) => dispatch => {
  dispatch({
    type: methods.FILTERS_CHANGE,
    payload: filter
  })
}