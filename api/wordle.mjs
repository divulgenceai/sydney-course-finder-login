import {dailyWordleChallenge} from '../lib/wordle.mjs';

export async function GET() {
  try {
    const challenge = await dailyWordleChallenge();
    return Response.json(challenge, {headers: {'Cache-Control': 'public, max-age=0, s-maxage=300'}});
  } catch {
    return Response.json({error: 'Daily clue unavailable'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
