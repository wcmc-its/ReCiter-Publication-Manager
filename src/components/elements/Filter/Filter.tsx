import React, { useState, FunctionComponent } from "react"
import styles from './Filter.module.css'
import Dropdown  from '../Dropdown/Dropdown'

interface FuncProps {
    onChange(state: any): void,
    showSort: boolean
}

const Filter: FunctionComponent<FuncProps> = (props) => {

    const [sort, setSort] = useState<string>("0")
    const [search, setSearch] = useState<string>("")

    const handleSearchUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
        onFilterUpdate()
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