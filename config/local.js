export const reciterConfig = {
    /*
     *Configuration for using this application. For the api endpoints just update the protocol and host name and port(if required)
     */
    reciter: {
        /*
         * Admin api key to access all the reciter endpoint. If you did not setup security in your reciter APIs then leave it empty.
         */
        adminApiKey: process.env.RECITER_API_KEY,
        /**
         * Reciter API EndPoint Base Url. It reads values from environment variables.
         */
         reciterApiBaseUrl : process.env.RECITER_API_BASE_URL,
        /**
         * This is where you specify all the Identity endpoints in reciter. Please refer to the Identity controller in swagger-ui for all the related
         * Identity endpoints.
         */
        reciterIdentityEndpoints: {
            /**
             * This endpoint get Identity based on supplied unique id.
             */
            identityByUid: process.env.RECITER_API_BASE_URL + '/reciter/find/identity/by/uid',
            /**
             * This endpoint get all identity listed in your database. This API consumes significant resources when making a call.
             * So when in /search page refrain from refreshing the page since that entails a fresh api call.
             */
            getAllIdentity: process.env.RECITER_API_BASE_URL + '/reciter/find/all/identity',
            /**
             * This is the image that is shown in the search page and the Individual page. If you have an api that serves image for each of your identity
             * then specify it here. Otherwise if its blank it uses a stock image specified.
             */
            identityImageEndpoint:
                "https://directory.weill.cornell.edu/api/v1/person/profile/${uid}.png?returnGenericOn404=true",
        },
        /**
         * This is the api to fetch all the publication related to an individual with all the eivdence.
         */
        featureGenerator: {
            featureGeneratorEndpoint:
                    process.env.RECITER_API_BASE_URL + '/reciter/feature-generator/by/uid',
            featutreGeneratorApiParams: {
                /**
                 * This is the minimum score that the publication will be filtered on.
                 * Type: Number
                 */
                authorshipLikelihoodScore: 30,
                /**
                 * ReCiter runs on Training mode and As evidence mode. Select appropriately since AS_EVIDENCE mode stores the data the rerteival will be faster.
                 * Run on training mode to test some users.
                 * Type: Srting
                 */
                useGoldStandard: "AS_EVIDENCE",
                /**
                 * This flag specifies if reciter will re-compute suggestions. Use if you want to re-compute. This will take more time and resources.
                 * Type: Boolean
                 */
                analysisRefreshFlag: "FALSE",
                /**
                 * This flag specifies if reciter will re-retrieve all publication from upstream sources. Specify to refresh all retrieval.
                 * Type: String
                 */
                retrievalRefreshFlag: "FALSE",
                /**
                 * This flag filters on feedback.
                 * Type: String
                 */
                filterByFeedback: "ALL",
            },
        },
        /**
         * This is the api to fetch all the publication for a list of unique ids with all the eivdence.
         */
        featureGeneratorByGroup: {
            featureGeneratorByGroupEndpoint:
                    process.env.RECITER_API_BASE_URL + '/reciter/feature-generator/by/group',
            featureGeneratorByGroupApiParams: {
                /**
                 * This is the minimum score that the publication will be filtered on.
                 * Type: Number
                 */
                totalStandardizedArticleScore: 3,
                /**
                 * The maximum number of pending publications that will be return per person.
                 * Type: Number
                 */
                maxArticlesPerPerson: 4,
            },
            maxResultsOnGroupView: 60,
            incrementResultsBy: 20,
        },

        /**
         * This is the endpoint in ReCiter-Publication-Manager controller for authentication.
         */
        reciterPubManagerAuthenticationEndpoint:
                process.env.RECITER_API_BASE_URL + '/reciter/publication/manager/authenticate',
        /**
         * This endpoint is to update the feedback for users.
         */
        reciterUpdateGoldStandardEndpoint:
                process.env.RECITER_API_BASE_URL + '/reciter/goldstandard',
        /**
         * Read-only curation audit history (FeedbackLog + ArticleProvenance) by uid.
         */
        reciterFeedbackLogEndpoint:
                process.env.RECITER_API_BASE_URL + '/reciter/feedback-log/',
        /**
         * PM#771 — external-source (OpenAlex/Scopus/WoS) manual-add publications.
         * POST/GET/DELETE against the same Java ingress as the other /reciter/* calls,
         * so RECITER_API_BASE_URL + the admin api-key are sufficient (no new env var).
         */
        reciterExternalArticleEndpoint:
                process.env.RECITER_API_BASE_URL + '/reciter/external-article/by/uid',
        /**
         * External-article feedback (curator reject/dismiss/reopen, faculty dispute) —
         * appends durable FeedbackLog rows on the Java side. Same ingress + admin api-key.
         */
        reciterExternalArticleFeedbackEndpoint:
                process.env.RECITER_API_BASE_URL + '/reciter/external-article/feedback',
        /**
         * This endpoints serves to do CRUD on user feedback. This is used to track the publication feedback in the application. When refreshed
         * the feedback is erased from the database.
         */
        reciterUserFeedbackEndpoints: {
            saveUserFeedback:  process.env.RECITER_API_BASE_URL + '/reciter/publication/manager/userfeedback/save',
            deleteUserFeedback: process.env.RECITER_API_BASE_URL + '/reciter/publication/manager/userfeedback/delete',
            findUserFeedback: process.env.RECITER_API_BASE_URL + '/reciter/publication/manager/userfeedback/find',
        },
    },
    /**
     * This endpoint is used to search pubmed. You need to have ReCiter-Pubmed-Retrieval tool conifgured. See https://github.com/wcmc-its/ReCiter-PubMed-Retrieval-Tool.git
     * for details.
     *
     * The PubMed tool is a separate service in every environment
     * (reciter-pubmed-dev / reciter-pubmed-prod), so RECITER_PUBMED_API_URL is
     * REQUIRED — there is no fallback. It reads as one, so be explicit: unset,
     * these become the literal string "undefined/pubmed/query-complex/" and the
     * fetch fails at call time rather than at startup. An earlier version of
     * this comment promised a fallback to RECITER_API_BASE_URL that the code
     * below never implemented; the Scopus twin of that lie cost hours in prod.
     */
    reciterPubmed: {
        searchPubmedEndpoint: process.env.RECITER_PUBMED_API_URL + '/pubmed/query-complex/',
        searchPubmedCountEndpoint: process.env.RECITER_PUBMED_API_URL + '/pubmed/query-number-pubmed-articles/',
    },
    /**
     * Scopus search via the ReCiter Scopus Retrieval Tool. The tool holds the Elsevier
     * SCOPUS_API_KEY / SCOPUS_INST_TOKEN, so PM no longer needs them. Like PubMed, the tool
     * is a separate service per environment (reciter-scopus-dev / reciter-scopus-prod), so
     * RECITER_SCOPUS_API_URL is REQUIRED — there is no fallback to RECITER_API_BASE_URL,
     * which serves no /scopus/* route. Unset, these become the literal string
     * "undefined/scopus/search/documents"; scopusConfigured() gates on this exact variable
     * so that shows up as an honest 503 rather than an empty result set.
     * NOTE the scheme: these are in-cluster NodePort services listening on port 80 only —
     * an https:// value connects to :443 and hangs until timeout.
     * See https://github.com/wcmc-its/ReCiter-Scopus-Retrieval-Tool.git.
     */
    reciterScopus: {
        searchDocumentsEndpoint: process.env.RECITER_SCOPUS_API_URL + '/scopus/search/documents',
        searchAuthorsEndpoint: process.env.RECITER_SCOPUS_API_URL  + '/scopus/search/authors',
        // Literature Search's endpoint: the query reaches Elsevier VERBATIM, so a top-level limit
        // (AND PUBYEAR > 2020) is expressible and a search strategy can actually run.
        // searchDocumentsEndpoint cannot do this — it force-wraps every term in TITLE-ABS-KEY().
        // Needs ScopusTool PR #35; against an older jar this 404s. POST {query, count, start, view}.
        //
        // Built from RECITER_SCOPUS_API_URL ALONE, like its two siblings. This line carried a
        // `|| RECITER_API_BASE_URL` fallback until #843 established that the fallback was never
        // real: RECITER_API_BASE_URL serves no /scopus/* route, so falling back to it produced a
        // confident wrong answer instead of a failure. Do not reintroduce it here.
        searchQueryEndpoint: process.env.RECITER_SCOPUS_API_URL + '/scopus/search/query',
    },
    /**
     * PM#771 — OpenAlex is a free, keyless public API. It is queried ONLY server-side
     * (via the PM /api/reciter/search/openalex route), never from the browser.
     */
    openAlex: {
        searchHost: 'https://api.openalex.org',
    },
    /**
     * ReCiter-Publication-Manager uses Json web token for session management and validating a valid sesssion. This secret will be used to sign the web token.
     * Make sure its a good secret with good mix of alpha numeric characters.
     */
    tokenSecret:  process.env.RECITER_TOKEN_SECRET,
    backendApiKey: process.env.NEXT_PUBLIC_RECITER_BACKEND_API_KEY,

    asms: {
        asmsApiBaseUrl: process.env.ASMS_API_BASE_URL,
        userTrackingAPI: process.env.ASMS_API_BASE_URL + '/api/v2/track/module',
        userTrackingAPIAuthorization: process.env.ASMS_USER_TRACKING_API_AUTHORIZATON
    },
};
