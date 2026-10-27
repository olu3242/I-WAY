import {createHostedUatRuntime} from '../../../server/operations-uat-hosted-runtime.mjs';
import {createHostedUatHandler} from '../../../server/operations-uat-hosted-handler.mjs';
export const config={api:{bodyParser:false}};
export default createHostedUatHandler({createRuntime:createHostedUatRuntime});
