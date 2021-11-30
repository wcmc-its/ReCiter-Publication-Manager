import methods from '../methods/methods'
import { combineReducers } from 'redux'
import auth, { sessionId } from '../store/auth'

export const reciterFetching = (state=true, action) => {

    switch(action.type) {

        case methods.RECITER_FETCH_DATA :
            return true

        case methods.RECITER_CANCEL_FETCHING :
            return false

        default:
            return state
    }

}

export const identityFetching = (state=false, action) => {

    switch(action.type) {

        case methods.IDENTITY_FETCH_DATA :
            return true

        case methods.IDENTITY_CANCEL_FETCHING :
            return false

        default:
            return state
    }

}

export const identityAllFetching = (state=false, action) => {

    switch(action.type) {

        case methods.IDENTITY_FETCH_ALL_DATA :
            return true

        case methods.IDENTITY_CANCEL_ALL_FETCHING :
            return false

        default:
            return state
    }

}

export const pubmedFetching = (state=false, action) => {

    switch(action.type) {

        case methods.PUBMED_FETCH_DATA :
            return true

        case methods.PUBMED_CANCEL_FETCHING :
            return false

        default:
            return state
    }

}

export const reciterData = (state=[], action) => {

    switch(action.type) {

        case methods.RECITER_CLEAR_DATA :
            return []

        case methods.RECITER_CHANGE_DATA :
            return action.payload

        case methods.ACCEPT_PUBLICATION :
            var publications = []
            var pendingPublications = state.reciterPending
            state.reciter.forEach(function(publication){
                if(publication.pmid === action.payload) {
                    publication.userAssertion = 'ACCEPTED'
                    pendingPublications.push(publication)
                }else {
                    publications.push(publication)
                }
            })

            if(action.manuallyAddedFlag) {
                pendingPublications.push(action.payload)
            }

            return {
                faculty: state.faculty,
                reciter: publications,
                reciterPending: pendingPublications
            }
        case methods.REJECT_PUBLICATION :
            var publications = []
            pendingPublications = state.reciterPending
            state.reciter.forEach(function(publication){
                if(publication.pmid === action.payload) {
                    publication.userAssertion = 'REJECTED'
                    pendingPublications.push(publication)
                }else {
                    publications.push(publication)
                }
            })

            if(action.manuallyAddedFlag) {
                pendingPublications.push(action.payload)
            }

            return {
                faculty: state.faculty,
                reciter: publications,
                reciterPending: pendingPublications
            }
        case methods.UNDO_PUBLICATION :
            var publications = []
            pendingPublications = state.reciterPending
            state.reciter.forEach(function(publication){
                if(publication.pmid === action.payload) {
                    publication.userAssertion = 'NULL'
                    pendingPublications.push(publication)
                }else {
                    publications.push(publication)
                }
            })
            return {
                faculty: state.faculty,
                reciter: publications,
                reciterPending: pendingPublications
            }
        default :
            return state
    }

}

export const pubmedData = (state=[], action) => {

    switch(action.type) {

        case methods.PUBMED_CLEAR_DATA :
            return []

        case methods.PUBMED_CHANGE_DATA :
            return action.payload

        default :
            return state
    }

}

export const identityData = (state=[], action) => {

    switch(action.type) {
        
        case methods.IDENTITY_CLEAR_DATA :
            return []

        case methods.IDENTITY_CHANGE_DATA :
            return action.payload

        default :
            return state
    }

}

export const identityAllData = (state=[], action) => {

    switch(action.type) {
        
        case methods.IDENTITY_CLEAR_ALL_DATA :
            return []

        case methods.IDENTITY_CHANGE_ALL_DATA :
            return action.payload

        default :
            return state
    }

}

export const orgUnitsFetching = (state=false, action) => {

  switch(action.type) {

      case methods.ORGUNITS_FETCH_ALL_DATA :
          return true

      case methods.ORGUNITS_CANCEL_ALL_FETCHING :
          return false

      default:
          return state
  }

}

export const orgUnitsData = (state=[], action) => {

  switch(action.type) {
      
      case methods.ORGUNITS_CLEAR_ALL_DATA :
          return []

      case methods.ORGUNITS_CHANGE_ALL_DATA :
          return action.payload

      default :
          return state
  }

}

export const institutionsFetching = (state=false, action) => {

  switch(action.type) {

      case methods.INSTITUTIONS_FETCH_ALL_DATA :
          return true

      case methods.INSTITUTIONS_CANCEL_ALL_FETCHING :
          return false

      default:
          return state
  }

}

export const institutionsData = (state=[], action) => {

  switch(action.type) {
      
      case methods.INSTITUTIONS_CLEAR_ALL_DATA :
          return []

      case methods.INSTITUTIONS_CHANGE_ALL_DATA :
          return action.payload

      default :
          return state
  }

}

export const errors = (state=[], action) => {
    switch(action.type) {
        case methods.ADD_ERROR :
            return [
                ...state,
                action.payload
            ]
        case methods.CLEAR_ERROR :
            return []
        default:
            return state
    }
}

const initialFilterState = {
  orgUnits: [],
  institutions: [],
  searchText: [],
  filterByPending: false,
}

export const filters = (state={}, action) => {
  switch(action.type) {
    case methods.CLEAR_FILTERS :
      return {}
    default:
      return state
  }
}

export default combineReducers({
    reciterFetching,
    pubmedFetching,
    identityFetching,
    identityAllFetching,
    reciterData,
    identityData,
    identityAllData,
    pubmedData,
    errors,
    auth,
    sessionId,
    orgUnitsData,
    orgUnitsFetching,
    institutionsData,
    institutionsFetching,
})
