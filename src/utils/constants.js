
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

export const dropdownItemsSuper = [
	{ title: 'Create Reports', to: '/create-reports'},
	// { title: 'Perform Analysis', to: '/perform-analysis' },
  ]
  export const dropdownItemsReport= [
	// { title: 'Perform Analysis', to: '/perform-analysis' },
  ]
  

