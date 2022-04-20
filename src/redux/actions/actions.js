import methods from '../methods/methods'
import fetchWithTimeout from '../../utils/fetchWithTimeout';
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
                    autoClose: 2000,
                    theme: 'colored'
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

            toast.error("Identity Api failed for " + uid + " - " + error.title, {
                position: "top-right",
                autoClose: 2000,
                theme: 'colored'
            });

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_FETCHING
            })

        })
}

export const identityFetchAllData = (request) => dispatch => {
    dispatch({
        type: methods.IDENTITY_FETCH_ALL_DATA
    })
    fetchWithTimeout('/api/db/users', {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
            'Authorization': reciterConfig.backendApiKey
          },
        body: JSON.stringify(request),

    }, 300000)
        .then(response => {
            if(response.status === 200) {
                toast.success("Identity All Api successfully fetched", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
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
                theme: 'colored'
                });
            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })

        })
}

export const identityClearAllData = () => dispatch => {
  dispatch({
    type: methods.IDENTITY_CLEAR_ALL_DATA
  })
}

export const identityFetchPaginatedData = (page, limit) => dispatch => {
  const offset = (page - 1) * limit;
  const request = { limit, offset };
  dispatch({
      type: methods.IDENTITY_FETCH_PAGINATED_DATA
  })
  fetchWithTimeout(`/api/db/users`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
       },
      body: JSON.stringify(request),
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
          toast.error("Identity Fetch PaginatedData Api failed - " + error.title, {
            position: "top-right",
            autoClose: 2000,
            theme: 'colored'
            });
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
                    autoClose: 2000,
                    theme: 'colored'
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
                theme: 'colored'
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
                    autoClose: 2000,
                    theme: 'colored'
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
                theme: 'colored'
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

    if(request.userAssertion === 'ACCEPTED' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "knownPmids": request.publications,
            "uid": uid
        };
    } else if(request.userAssertion === 'REJECTED' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "rejectedPmids": request.publications,
            "uid": uid
        };
    } else if(request.userAssertion === 'NULL' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "knownPmids": request.publications,
            "rejectedPmids": request.publications,
            "uid": uid
        };
    } else if(request.userAssertion === 'ACCEPTED' && request.manuallyAddedFlag) {
        var goldStandard = {
            "knownPmids": [request.publications[0].pmid],
            "uid": uid
        };
    } else if(request.userAssertion === 'REJECTED' && request.manuallyAddedFlag) {
        var goldStandard = {
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
                autoClose: 2000,
                theme: 'colored'
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
            theme: 'colored'
            });

        dispatch(
            addError(error)
        )

        dispatch({
            type: methods.RECITER_CANCEL_FETCHING
        })

    })

    //update adminFeedbackLog table
    const adminFeedbackLogUrl = '/api/db/admin/feedbacklog/create'
    if(request.userID && 
        request.personIdentifier && 
        request.publications &&
        request.userAssertion
        ) {
            let adminFeedbackRequestBody = {
                "userID": request.userID,
                "personIdentifier": uid,
                "articleIdentifier": request.publications,
                "feedback": request.userAssertion
            }
            fetchWithTimeout(adminFeedbackLogUrl, {
                credentials: "same-origin",
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': reciterConfig.backendApiKey
                },
                body: JSON.stringify(adminFeedbackRequestBody)
            }, 300000)
            .then(response => {
                if(response.status === 200 || response.status === 201) {
                    toast.success("Feedback log updated in database for " + uid, {
                        position: "top-right",
                        autoClose: 2000,
                        theme: 'colored'
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
                toast.error("Db feedback log Api Error" + error.title + " for " + uid, {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                    });
        
                dispatch(
                    addError(error)
                )
        
                dispatch({
                    type: methods.RECITER_CANCEL_FETCHING
                })
        
            })
    }
    

}

export const reciterUpdatePublicationGroup = (uid, request) => dispatch => {


  // Update publications' user assertions state
  request.publications.forEach(function(id){
      switch(request.userAssertion) {
          case "ACCEPTED":
              dispatch({
                  type: methods.ACCEPT_PUBLICATION_GROUP,
                  payload: {pmid: id, personIdentifier: uid},
                  manuallyAddedFlag: request.manuallyAddedFlag
              })
              break
          case "REJECTED":
              dispatch({
                  type: methods.REJECT_PUBLICATION_GROUP,
                  payload: {pmid: id, personIdentifier: uid},
                  manuallyAddedFlag: request.manuallyAddedFlag
              })
              break
      }
  })

  // Send request to the API to update publications

  if(request.userAssertion === 'ACCEPTED' && !request.manuallyAddedFlag) {
      var goldStandard = {
          "knownPmids": request.publications,
          "uid": uid
      };
  } else if(request.userAssertion === 'REJECTED' && !request.manuallyAddedFlag) {
      var goldStandard = {
          "rejectedPmids": request.publications,
          "uid": uid
      };
  } else if(request.userAssertion === 'NULL' && !request.manuallyAddedFlag) {
      var goldStandard = {
          "knownPmids": request.publications,
          "rejectedPmids": request.publications,
          "uid": uid
      };
  } else if(request.userAssertion === 'ACCEPTED' && request.manuallyAddedFlag) {
      var goldStandard = {
          "knownPmids": [request.publications[0].pmid],
          "uid": uid
      };
  } else if(request.userAssertion === 'REJECTED' && request.manuallyAddedFlag) {
      var goldStandard = {
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
                autoClose: 2000,
                theme: 'colored'
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
            theme: 'colored'
          });

      dispatch(
          addError(error)
      )

  })

  //update adminFeedbackLog table
  const adminFeedbackLogUrl = '/api/db/admin/feedbacklog/create'
  if(request.userID && 
      request.personIdentifier && 
      request.publications &&
      request.userAssertion
      ) {
          let adminFeedbackRequestBody = {
              "userID": request.userID,
              "personIdentifier": uid,
              "articleIdentifier": request.publications,
              "feedback": request.userAssertion
          }
          fetchWithTimeout(adminFeedbackLogUrl, {
              credentials: "same-origin",
              method: 'POST',
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Authorization': reciterConfig.backendApiKey
              },
              body: JSON.stringify(adminFeedbackRequestBody)
          }, 300000)
          .then(response => {
              if(response.status === 200 || response.status === 201) {
                  toast.success("Feedback log updated in database for " + uid, {
                        position: "top-right",
                        autoClose: 2000,
                        theme: 'colored'
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
              toast.error("Db feedback log Api Error" + error.title + " for " + uid, {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                  });
      
              dispatch(
                  addError(error)
              )
      
          })
  }
  

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
          'Authorization': reciterConfig.backendApiKey
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
                theme: 'colored'
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
          'Authorization': reciterConfig.backendApiKey
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
                theme: 'colored'
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
          'Authorization': reciterConfig.backendApiKey
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
                theme: 'colored'
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

export const clearFilters = () => dispatch => {
  dispatch({
    type: methods.FILTERS_CLEAR
  })
}

export const updateFilteredIds = (ids) => dispatch => {
  dispatch({
    type: methods.FILTERED_IDS_CHANGE,
    payload: ids
  })
}

export const updateFilteredIdentities = (identities) => dispatch => {
  dispatch({
    type: methods.FILTERED_IDENTITIES_CHANGE,
    payload: identities
  })
}

export const publicationsFetchGroupData = ( ids, updateData ) => dispatch => {
  const fetchGroupDataLoading = {
    'refresh': () => dispatch({type: methods.PUBLICATIONS_FETCH_GROUP_DATA}),
    'more': () => dispatch({type: methods.PUBLICATIONS_FETCH_MORE_DATA}),
    'previous': () => dispatch({type: methods.PUBLICATIONS_FETCH_PREVIOUS_DATA})
  };
  fetchGroupDataLoading[updateData]();

  fetchWithTimeout('/api/reciter/feature-generator/group', {
      credentials: "same-origin",
      method: 'POST',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(ids)
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
      switch (updateData) {
        case 'refresh':
          dispatch({
            type: methods.PUBLICATIONS_CHANGE_GROUP_DATA,
            payload: data
          })
          dispatch({
            type:methods.PUBLICATIONS_UPDATE_GROUP_DATA_IDS,
            payload: data
          })
          break;
        case 'more':
          dispatch({
            type: methods.PUBLICATIONS_UPDATE_GROUP_DATA,
            payload: data
          })
          dispatch({
            type:methods.PUBLICATIONS_UPDATE_GROUP_DATA_IDS,
            payload: data
          })
          break;
        case 'previous':
          dispatch({
            type: methods.PUBLICATIONS_PREVIOUS_GROUP_DATA,
            payload: data
          })
          break;
        default:
          dispatch({
            type: methods.PUBLICATIONS_CHANGE_GROUP_DATA,
            payload: data
          })
          break;
      }

        dispatch({
            type: methods.PUBLICATIONS_CANCEL_GROUP_DATA
        })
    })
    .catch(error => {
        console.log(error)
        toast.error("Feature generator by group Api failed - " + error.title, {
            position: "top-right",
            autoClose: 2000,
            theme: 'colored'
          });
        dispatch(
            addError(error)
        )

        dispatch({
            type: methods.PUBLICATIONS_CANCEL_GROUP_DATA
        })

    })
}

export const fetchFeedbacklog = ( id ) => dispatch => {
  dispatch({
    type: methods.FEEDBACKLOG_FETCH_DATA
  })

  fetch(`/api/db/admin/feedbacklog/${id}`, {
    credentials: "same-origin",
    method: 'GET',
    headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
    }
  }).then(response => {
        if(response.status === 200) {
            return response.json()
        } else {
            throw {
                type: response.type,
                title: response.statusText,
                status: response.status,
                detail: "Error occurred with api " + response.url + ". Please, try again later "
            }
        }
  }).then(data => {
    let articleIds = data.map((feedback) => {return feedback.articleIdentifier})
    articleIds = articleIds.filter((feedback, i) => {return articleIds.indexOf(feedback) === i});
    let feedbacklogData = {};
    articleIds.forEach((articleId) => {
      let articleFeedbacks = data.filter((feedbackLog) => { if (feedbackLog.articleIdentifier === articleId) return feedbackLog});
      feedbacklogData[articleId] = articleFeedbacks;
    })

    dispatch({
      type: methods.FEEDBACKLOG_CHANGE_DATA,
      payload: feedbacklogData
    })

    dispatch({
        type: methods.FEEDBACKLOG_CANCEL_FETCHING
    })
  
    }).catch(error => {
      console.log(error)
      toast.error("Feedback log Api failed for " + id +" - " + error.title, {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      dispatch(
          addError(error)
      )

      dispatch({
        type: methods.FEEDBACKLOG_CANCEL_FETCHING
      })
  })       
}

export const fetchGroupFeedbacklog = ( ids ) => dispatch => {
  dispatch({
    type: methods.FEEDBACKLOG_FETCH_DATA_GROUP
  })

  let feedbackLogs = [];
  for (let id of ids) {
     fetch(`/api/db/admin/feedbacklog/${id}`, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      }
    }).then(response => {
      return response.json()
    }).then(data => {
      if (data?.length) {
        let articleIds = data.map((feedback) => {return feedback.articleIdentifier})
        articleIds = articleIds.filter((feedback, i) => {return articleIds.indexOf(feedback) === i});
        let feedbacklogData = {};
        articleIds.forEach((articleId) => {
          let articleFeedbacks = data.filter((feedbackLog) => { if (feedbackLog.articleIdentifier === articleId) return feedbackLog});
          feedbacklogData[articleId] = articleFeedbacks;
        })
        feedbackLogs.push({ [id] : feedbacklogData});
      }
    }).catch(error => {
      console.log(error);

      dispatch({
        type: methods.FEEDBACKLOG_CANCEL_FETCHING_GROUP
      })
    })
  }

  dispatch({
    type: methods.FEEDBACKLOG_CHANGE_DATA_GROUP,
    payload: feedbackLogs
  })

  dispatch({
    type: methods.FEEDBACKLOG_CANCEL_FETCHING_GROUP
})
}

/* Reporting Filters */

// Authors Filter
const getAuthorsFilter = ( authorInput ) => async(dispatch) => {
    return fetch('/api/db/reports/filter/author?authorFilter=', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      },
    }).then(response => {
      return response.json()
    }).then(data => {
      dispatch({
        type: methods.AUTHOR_FILTER_CHANGE_ALL_DATA,
        payload: data
      })
    }).catch(error => {
      console.log(error);
      toast.error("Author Filter Api failed - " + error.title, {
        position: "top-right",
        autoClose: 2000,
        theme: 'colored'
      });
      dispatch(
          addError(error)
      )
    })
}

// Date Filter
const getDateFilter = () => async(dispatch) => {
  return fetch('/api/db/reports/filter/date', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      }
    }).then(response => {
      return response.json()
    }).then(data => {
      dispatch({
        type: methods.DATE_FILTER_CHANGE_ALL_DATA,
        payload: data
      })
    }).catch(error => {
      console.log(error);
      toast.error("Date Filter Api failed - " + error.title, {
        position: "top-right",
        autoClose: 2000,
        theme: 'colored'
      });
      dispatch(
          addError(error)
      )
    })
}

// Article Type Filter
const getArticleTypeFilter = () => async(dispatch) => {
  return fetch('/api/db/reports/filter/articletype', {
    credentials: "same-origin",
    method: 'GET',
    headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
    }
  })
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
            type: methods.ARTICLE_FILTER_CHANGE_ALL_DATA,
            payload: data
        })
    })
    .catch(error => {
        console.log(error)
        toast.error("Article Type Filter Api failed - " + error.title, {
              position: "top-right",
              autoClose: 2000,
              theme: 'colored'
            });
        dispatch(
            addError(error)
        )
    })
}

  // Journal Filter
  const getJournalFilter = ( journalInput ) => async(dispatch) => {
    return fetch('/api/db/reports/filter/journal?journalFilter?=', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      }
    })
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
              type: methods.JOURNAL_FILTER_CHANGE_ALL_DATA,
              payload: data
          })
      })
      .catch(error => {
          console.log(error)
          toast.error("Journal Filter Api failed - " + error.title, {
                position: "top-right",
                autoClose: 2000,
                theme: 'colored'
              });
          dispatch(
              addError(error)
          )
      })
  }

  // Journal Rank Filter 
  const getJournalRank = () => async(dispatch) => {
    return fetch('/api/db/reports/filter/journalrank', {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      }
    })
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
              type: methods.JOURNAL_RANK_CHANGE_ALL_DATA,
              payload: data
          })
      })
      .catch(error => {
          console.log(error)
          toast.error("Journal Rank Filter Api failed - " + error.title, {
                position: "top-right",
                autoClose: 2000,
                theme: 'colored'
              });
          dispatch(
              addError(error)
          )
  })}

  // Organization Filter
  export const getOrgUnits = () => async(dispatch) => {
    return fetch('/api/db/users/orgunits', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
            'Authorization': reciterConfig.backendApiKey
        }
    })
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
        })
        .catch(error => {
            console.log(error)
            toast.error("Organizational Units Api failed - " + error.title, {
                  position: "top-right",
                  autoClose: 2000,
                  theme: 'colored'
                });
            dispatch(
                addError(error)
            )
        })
  }
  
  // Institution Filter
  export const getInstitutions = () => async(dispatch) => {
    return fetch('/api/db/users/institutions', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
            'Authorization': reciterConfig.backendApiKey
        }
    })
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
        })
        .catch(error => {
            console.log(error)
            toast.error("Institutional Units Api failed - " + error.title, {
                  position: "top-right",
                  autoClose: 2000,
                  theme: 'colored'
                });
            dispatch(
                addError(error)
            )
        })
  }
  
  // Person Type Filter
  export const getPersonTypes = () => async(dispatch) => {
    return fetch('/api/db/users/persontypes', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
            'Authorization': reciterConfig.backendApiKey
        }
    })
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
        })
        .catch(error => {
            console.log(error)
            toast.error("Person Types Api failed - " + error.title, {
                  position: "top-right",
                  autoClose: 2000,
                  theme: 'colored'
                });
            dispatch(
                addError(error)
            )
        })
  }

  // Update Author Filter
  export const updateAuthorFilter  = ( authorInput ) => (dispatch) => {
      fetch(`/api/db/reports/filter/author?authorFilter=${authorInput}`, {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
            'Authorization': reciterConfig.backendApiKey
        },
      }).then(response => {
        return response.json()
      }).then(data => {
        dispatch({
          type: methods.AUTHOR_FILTER_CHANGE_ALL_DATA,
          payload: data
        })
      }).catch(error => {
        console.log(error);
        toast.error("Author Filter Api failed - " + error.title, {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
        dispatch(
            addError(error)
        )
      })
  }

  // Update Journal Filter
  export const updateJournalFilter = ( journalInput ) => (dispatch) => {
    fetch(`/api/db/reports/filter/journal?journalFilter=${journalInput}`, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
      }
    })
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
              type: methods.JOURNAL_FILTER_CHANGE_ALL_DATA,
              payload: data
          })
      })
      .catch(error => {
          console.log(error)
          toast.error("Journal Filter Api failed - " + error.title, {
                position: "top-right",
                autoClose: 2000,
                theme: 'colored'
              });
          dispatch(
              addError(error)
          )
      })
  }
  
  // Fetch All Filters
  export const reportsFilters = (authorFilter, journalFilter) => dispatch => {
    dispatch({
      type: methods.REPORTING_FILTERS_SET_LOADING
    })

    Promise.all([
      dispatch(getAuthorsFilter(authorFilter)),
      dispatch(getDateFilter()),
      dispatch(getArticleTypeFilter()),
      dispatch(getJournalFilter(journalFilter)),
      dispatch(getJournalRank()),
      dispatch(getOrgUnits()),
      dispatch(getInstitutions()),
      dispatch(getPersonTypes()),
    ]).then(() => {
      dispatch({
        type: methods.REPORTING_FILTERS_CANCEL_LOADING
      })
    });
  }

  export const updatePubSearchFilters = ( filter ) => dispatch => {
    dispatch({
      type: methods.PUB_FILTER_UPDATE,
      payload: filter
    })
  }
  
  export const clearPubSearchFilters = () => dispatch => {
    dispatch({
      type: methods.PUB_FILTER_CLEAR
    })
  }