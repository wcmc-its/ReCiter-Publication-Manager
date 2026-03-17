import { useEffect } from "react"
import { AppLayout } from "../../components/layouts/AppLayout"
import ManageProfile from "../../components/elements/ManageProfile/ManageProfile"
import { useSession } from "next-auth/client"
import { useRouter } from "next/router"
import { toast } from "react-toastify"
import { getCapabilities } from "../../utils/constants"
import { isPersonInScope } from "../../utils/scopeResolver"
import { reciterConfig } from "../../../config/local"

const ManageProfilePage = () => {
    const [session] = useSession();
    const router = useRouter();

    useEffect(() => {
        if (!session) return;

        const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
        const caps = getCapabilities(userRoles);

        // Only check scope for Curator_Scoped (not Curator_All or Superuser)
        if (caps.canCurate.scoped && !caps.canCurate.all) {
            const scopeData = session?.data?.scopeData ? JSON.parse(session.data.scopeData) : null;
            if (scopeData) {
                const personId = router.query.userId as string;
                if (!personId) return;

                fetch(`/api/db/person/scopecheck?uid=${personId}`, {
                    headers: { 'Authorization': reciterConfig?.backendApiKey || '' },
                })
                    .then(r => r.json())
                    .then(personData => {
                        if (personData && !isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes || [])) {
                            console.log('[AUTH] DENY: Scoped curator tried to access /manageprofile/' + personId + ' -- not in scope');
                            toast.error("You don't have curation access for this person", {
                                position: "top-right",
                                autoClose: false,
                                theme: 'colored',
                            });
                            router.push('/search');
                        }
                    })
                    .catch(err => console.log('Scope check error:', err));
            }
        }
    }, [session, router.query.userId]);

    return (
        <>
            <ManageProfile />
        </>
    )
}

ManageProfilePage.getLayout = (page) => (
    <AppLayout>{page}</AppLayout>
);

export default ManageProfilePage;
