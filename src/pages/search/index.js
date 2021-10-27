import Search from '../../components/elements/Search/Search'
import { AppLayout } from "../../components/layouts/AppLayout"

const SearchPage = () => {
    return (
        <>  
                <Search />
        </>
    )
}

SearchPage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default SearchPage;