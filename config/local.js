exports.config = {
    reciter: {
        adminApiKey: '9edd88cf-4806-49d8-bc14-5a7e4cc4ccf8',
        reciterIdentityEndpoints: {
            identityByUid: 'https://reciter.weill.cornell.edu/reciter/find/identity/by/uid',
            getAllIdentity: 'http://140.251.8.133:5001/reciter/find/all/identity',
            identityImageEndpoint: 'https://directory.weill.cornell.edu/api/v1/person/profile/${uid}.png?returnGenericOn404=true'
        },
        featureGenerator: {
            featureGeneratorEndpoint: 'https://reciter.weill.cornell.edu/reciter/feature-generator/by/uid',
            featutreGeneratorApiParams: {
                totalStandardizedArticleScore: 4,
                useGoldStandard: 'AS_EVIDENCE',
                analysisRefreshFlag: false,
                retrievalRefreshFlag: 'FALSE',
                filterByFeedback: 'ALL'
            }
        },
        reciterPubManagerAuthenticationEndpoint: 'http://140.251.8.133:5001/reciter/publication/manager/authenticate',
        reciterUpdateGoldStandardEndpoint: 'https://reciter.weill.cornell.edu/reciter/goldstandard/',
        reciterUserFeedbackEndpoints: {
            saveUserFeedback: 'http://140.251.8.133:5001/reciter/publication/manager/userfeedback/save',
            deleteUserFeedback: 'http://140.251.8.133:5001/reciter/publication/manager/userfeedback/delete',
            findUserFeedback: 'http://140.251.8.133:5001/reciter/publication/manager/userfeedback/find'
        }
    },
    reciterPubmed: {
        searchPubmedEndpoint: 'https://reciter-pubmed.weill.cornell.edu/pubmed/query-complex/',
        searchPubmedCountEndpoint: 'https://reciter-pubmed.weill.cornell.edu/pubmed/query-number-pubmed-articles/'
    },
    tokenSecret: 'mysecretsshhhhhh'
}