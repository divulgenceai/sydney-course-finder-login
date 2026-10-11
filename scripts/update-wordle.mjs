import {writeFile} from 'node:fs/promises';
import {dailyWordleChallenge} from '../lib/wordle.mjs';

const output = await dailyWordleChallenge();
await writeFile(new URL('../wordle.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Prepared ${output.opposites.length} accepted Wordle opposites for ${output.date}.`);
