import React, { useState, FunctionComponent } from "react"
import styles from './Filter.module.css'
import Dropdown  from '../Dropdown/Dropdown'

interface FuncProps {
    onChange?(state: any): void,
    onSearch?(state: any): void,
    showSort: boolean,
    isFrom?:string
}

const Filter: FunctionComponent<FuncProps> = (props) => {

    const [sort, setSort] = useState<string>("0")
    const [search, setSearch] = useState<string>("")

    // setState is async — pass the incoming value straight through instead of
    // reading the state variable, which still holds the previous keystroke/sort.
    const handleSearchUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
        if (props.isFrom === "pubMed") props.onSearch(event.target.value)
        else props.onChange({ sort, search: event.target.value })
    }

    const handleSortUpdate = (sortValue: string) => {
        setSort(sortValue)
        props.onChange({ sort: sortValue, search })
    }

    return (
        <div className={styles.filterContainer} key="filter-component">
            {(props.showSort)? <Dropdown sort={sort} onChange={handleSortUpdate}/> :
                <span></span>
            }
            <input
                type="text"
                className="form-control"
                placeholder="Filter..."
                onChange={(e)=>handleSearchUpdate(e)}
            />
        </div>
    );
}

export default Filter