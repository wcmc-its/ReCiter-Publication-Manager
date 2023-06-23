
import { toast } from "react-toastify";

export const allowedPermissions = Object.freeze({
	Superuser: "Superuser",
	Curator_All: "Curator_All",
	Reporter_All: "Reporter_All",
	Curator_Self: "Curator_Self"
})

export const toastMessage = (type, message) => {
	if (type === "error") {
		return toast.error(message, {
			position: "top-right",
			autoClose: 2000,
			theme: 'colored'
		})
	}
	else if (type === "success") {
		return toast.success(message, {
			position: "top-right",
			autoClose: 2000,
			theme: 'colored'
		})
	}
	else {

	}
}

export const numberFormation = (number)=> {
	let formatedNumber  = number.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
	return formatedNumber
}

export const setReportFilterLabels = (allFilters, filterLabel) => {
	let filteredLabel = allFilters?.length > 0 && allFilters?.find((allLabels) => allLabels.labelUserKey === filterLabel)
	return filteredLabel?.labelUserView || ""
}

export const setReportFilterDisplayRank = (allFilters, filterLabel) => {
	let filteredLabel = allFilters?.length > 0 && allFilters?.find((allLabels) => allLabels.labelUserKey === filterLabel)
	return filteredLabel?.displayRank || ""
}

export const setHelptextInfo = (allFilters, filterLabel) => {
	let filteredLabel = allFilters?.length > 0 && allFilters?.find((allLabels) => allLabels.labelUserKey === filterLabel)
	return filteredLabel?.helpTextUserView || ""
}

export const dropdownItemsSuper = [
	{ title: 'Create Reports', to: ''},
	// { title: 'Perform Analysis', to: '/perform-analysis' },
  ]
  export const dropdownItemsReport= [
	// { title: 'Perform Analysis', to: '/perform-analysis' },
  ]
  
export const reciterConstants = {

	nameCWIDSpaceCountThreshold : 3 	

}
