import { AppLayout } from "../../components/layouts/AppLayout"
import LiteratureSearch from "../../components/elements/Literature/LiteratureSearch"

const LiteraturePage = () => <LiteratureSearch />

LiteraturePage.getLayout = (page: any) => (
    <AppLayout>{page}</AppLayout>
)

export default LiteraturePage
