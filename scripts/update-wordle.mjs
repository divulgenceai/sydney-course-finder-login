import {writeFile} from 'node:fs/promises';

const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date()).map(part => [part.type, part.value]));
const date = `${parts.year}-${parts.month}-${parts.day}`;
const wordleUrl = `https://www.nytimes.com/svc/wordle/v2/${date}.json`;
const wordleResponse = await fetch(wordleUrl, {
  headers: {'User-Agent': 'Mozilla/5.0 (compatible; SydneyCourseFinder/1.0)'},
  signal: AbortSignal.timeout(15000)
});
if (!wordleResponse.ok) throw new Error(`Wordle returned ${wordleResponse.status} for ${date}`);
const wordle = await wordleResponse.json();
const answer = String(wordle.solution || '').toLowerCase();
if (wordle.print_date !== date || !/^[a-z]{5}$/.test(answer)) throw new Error(`Invalid Wordle answer for ${date}`);

const opposites = new Set();
try {
  const response = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(answer)}&max=100`, {
    signal: AbortSignal.timeout(10000)
  });
  if (response.ok) {
    const suggestions = await response.json();
    for (const suggestion of suggestions) {
      const word = String(suggestion.word || '').toLowerCase();
      if (/^[a-z]{2,24}$/.test(word) && word !== answer) opposites.add(word);
    }
  }
} catch (error) {
  console.warn(`Dictionary lookup unavailable: ${error.message}`);
}

// WordNet has no antonym for some verbs, including today's "uncap".
const extraOpposites = {uncap: ['cap']};
for (const word of extraOpposites[answer] || []) opposites.add(word);
// Every possible Wordle answer has a deterministic, solvable fallback.
opposites.add(`not${answer}`);

const output = {date, opposites: [...opposites].sort()};
await writeFile(new URL('../wordle.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Prepared ${output.opposites.length} accepted Wordle opposites for ${date}.`);
