import {makeApp} from './app.mjs';
const port=Number(process.env.PORT??4173);
const dbPath=process.env.IWAY_LEADS_FILE??'data/early-access.json';
makeApp({dbPath}).listen(port,()=>console.log('I-way listening on port '+port));
