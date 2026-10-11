// Explicitly blocked until the complete synchronous load:create contract is
// ported (dispatcher, stops, customer, charges and authorization parity).
import {AsyncCommandError} from './operations-async-command.mjs';
export async function createAsyncLoad(){
 throw new AsyncCommandError('LOAD_COMMAND_PARITY_NOT_CERTIFIED');
}
