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

    const handleSearchUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
        if (props.isFrom === "pubMed") props.onSearch(event.target.value)
        else onFilterUpdate()
        
    }

    const handleSortUpdate = (sortValue: string) => {
        setSort(sortValue)
        onFilterUpdate()
    }

    const onFilterUpdate = () => {
        props.onChange({
            sort,
            search
        })
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
                onChange={handleSearchUpdate}
            />
        </div>
    );
}

export default Filter