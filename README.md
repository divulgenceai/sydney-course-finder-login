# Mildly Infuriating

Source: [GitHub](https://github.com/divulgenceai/sydney-course-finder-login). Live site: [Vercel](https://sydney-course-finder-login.vercel.app/). The Vercel project is connected to the repository's `master` branch for automatic deployments. The repository and deployment URLs retain their earlier names; the website uses the Mildly Infuriating identity.

The password challenge requests `/api/wordle` on Vercel for the current Australia/Sydney date. It falls back to `wordle.json`, which is refreshed by `.github/workflows/update-wordle.yml` for GitHub Pages. Both use the New York Times Wordle daily answer and request antonyms from the [Datamuse API](https://www.datamuse.com/api/). They also accept `not` followed by the daily answer so every day's challenge remains solvable when a word has no dictionary antonym.

The Daily Deen password rule follows the verse rotation on [Daily Deen](https://dailydeen.zubibair.com/) using the Australia/Sydney date. The page checks Daily Deen's current verse list on load and refreshes itself when a new Sydney day begins, including when an old tab becomes visible again.

The maths checks accept either the displayed arithmetic answer or an HSC English Standard exam-time answer. The times come from [NESA's English Standard exam specifications](https://www.nsw.gov.au/education-and-training/nesa/curriculum/english/english-standard-stage-6-2017/assessment-and-reporting): Paper 1 is 100 minutes including reading time, Paper 2 is 125 minutes, and the combined time is 225 minutes.

The signup is a local preview. It does not create an account or send the entered email and password to a server.
