import React, { useState, FunctionComponent } from "react"
import styles from './Dropdown.module.css'

interface FuncProps {
    onChange(sortValue: string): void,
    sort: string
}

const Dropdown: FunctionComponent<FuncProps> = (props) => {

    const [sort, setSort] = useState<string>("0")
    const [isOpen, setOpen] = useState<boolean>(false)


    const toggleOpen = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setOpen(!isOpen)
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>, sortBy: string) => {
        event.stopPropagation();
        var sortValue = "0";
        switch(sort) {
            case "0":
                if(sortBy === "Score") {
                    sortValue = "1";
                }else {
                    sortValue = "2";
                }
                break;
            case "1":
                if(sortBy === "Score") {
                    sortValue = "0";
                }else {
                    sortValue = "2";
                }
                break;
            case "2":
                if(sortBy === "Score") {
                    sortValue = "0";
                }else {
                    sortValue = "3";
                }
                break;
            case "3":
                if(sortBy === "Score") {
                    sortValue = "0";
                }else {
                    sortValue = "2";
                }
                break;
            default:
                sortValue = "0";
        }
        setOpen(false)
        setSort(sortValue)

        props.onChange(sortValue);
    }

    var sortClass = ""
    var sortBy = ""
    switch(sort) {
        case "0":
            sortClass = styles.dropdownSortDesc
            sortBy = "Score"
            break;
        case "1":
            sortClass = styles.dropdownSortAsc;
            sortBy = "Score"
            break;
        case "2":
            sortClass = styles.dropdownSortDesc
            sortBy = "Date"
            break;
        case "3":
            sortClass = styles.dropdownSortAsc
            sortBy = "Date"
            break;
        default:
            sortClass = styles.dropdownSortDesc
            sortBy = "Score"
            break;
    }

    return (
        <div className="dropdown" onClick={toggleOpen}>
            <button
                className="btn btn-primary dropdown-toggle"
                type="button"
                id="dropdownMenuButton"
                data-toggle="dropdown"
                aria-haspopup="true"
            >
                Sort by <span className={sortClass}>{sortBy}</span>
            </button>
            <div className={`${styles.dropdownMenu} dropdown-menu-right ${isOpen ? " show" : ""}`} aria-labelledby="dropdownMenuButton">
                <span
                    className={(sortBy === "Score")?sortClass:""}
                    onClick={(event) => handleClick(event, "Score")}
                >Score</span>
                <span
                    className={(sortBy === "Date")?sortClass:""}
                    onClick={(event) => handleClick(event, "Date")}
                >Date</span>
            </div>
        </div>
    );
}

export default Dropdown