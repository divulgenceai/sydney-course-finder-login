export function sydneyDateKey() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function dailyWordleChallenge(date = sydneyDateKey()) {
  const response = await fetch(`https://www.nytimes.com/svc/wordle/v2/${date}.json`, {
    headers: {'User-Agent': 'Mozilla/5.0 (compatible; SydneyCourseFinder/1.0)'},
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Wordle returned ${response.status} for ${date}`);
  const data = await response.json();
  const answer = String(data.solution || '').toLowerCase();
  if (data.print_date !== date || !/^[a-z]{5}$/.test(answer)) throw new Error(`Invalid Wordle answer for ${date}`);

  const opposites = new Set();
  try {
    const antonyms = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(answer)}&max=100`, {
      signal: AbortSignal.timeout(10000)
    });
    if (antonyms.ok) {
      for (const suggestion of await antonyms.json()) {
        const word = String(suggestion.word || '').toLowerCase();
        if (/^[a-z]{2,24}$/.test(word) && word !== answer) opposites.add(word);
      }
    }
  } catch (error) {
    console.warn(`Dictionary lookup unavailable: ${error.message}`);
  }

  // WordNet has no antonym for some verbs, including "uncap".
  const extraOpposites = {uncap: ['cap']};
  for (const word of extraOpposites[answer] || []) opposites.add(word);
  // Every possible Wordle answer has a deterministic, solvable fallback.
  opposites.add(`not${answer}`);
  return {date, opposites: [...opposites].sort()};
}
