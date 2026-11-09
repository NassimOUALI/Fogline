import { main } from './cli';
import { processIO } from './io';

process.exitCode = await main(process.argv.slice(2), processIO);
