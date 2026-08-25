import { AppLayout } from "../../components/layouts/AppLayout"
import LiteratureAnalyzer from "../../components/elements/Literature/LiteratureAnalyzer"

const LiteratureAnalyzerPage = () => <LiteratureAnalyzer />

LiteratureAnalyzerPage.getLayout = (page: any) => (
    <AppLayout>{page}</AppLayout>
)

export default LiteratureAnalyzerPage
