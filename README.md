# Sydney Course Finder preview

The password challenge reads `wordle.json`, which is refreshed for the current Australia/Sydney date by `.github/workflows/update-wordle.yml`. The update script checks the New York Times Wordle daily answer and requests antonyms from the [Datamuse API](https://www.datamuse.com/api/). It also accepts `not` followed by the daily answer so every day's challenge remains solvable when a word has no dictionary antonym.

The signup is a local preview. It does not create an account or send the entered email and password to a server.
