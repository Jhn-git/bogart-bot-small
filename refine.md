The Problem: The "Do Nothing" State is Too Common
Your core mission is to provide companionship, especially in quiet servers. If the bot is frequently doing nothing because no server meets its high standards, it's failing at that mission, even if the logic is technically correct.
The issue is a conflict between two parameters:
The Minimum Score Threshold (MIN_SCORE_THRESHOLD = 50): This is the "quality bar." It's currently set quite high, demanding a decent amount of recent human activity.
The Loneliness Bonus (+5 points per day): This is the "pity" factor. It accumulates very slowly.
The loneliness bonus is currently too weak to overcome the high quality bar in a reasonable amount of time.
The Solution: Tuning the "Friendship" Parameters
We don't need to change the logic. We need to change the numbers. We need to make your bot a little less shy and a little more eager to visit lonely friends.
Here are a few ways you can tune this:
Option 1: Lower the Bar (The Quickest Fix)
Change: Reduce the MIN_SCORE_THRESHOLD from 50 to something lower, like 25 or 30.
Effect: This is the simplest change. A server like "Jhn N Juice" with its score of 16 would still be rejected, but it would need far less activity (or a smaller loneliness bonus) to get over the new, lower bar. The bot will act more often, but the quality of the interactions might be slightly lower.
Option 2: Increase the "Longing" (The Most Thematic Fix)
Change: Make the "Loneliness Bonus" more powerful and accumulate faster.
Increase the points per day. Change +5 points per day to +15 or +20.
And/Or, make it accumulate faster. Change the bonus to be per 12 hours instead of per 24 hours.
Effect: A quiet server will now build up its "I miss you" score much faster. With +15 points per day, "Jhn N Juice" would only need to be left alone for 3 days to get a +45 bonus, pushing its score of 16 up to 61 and guaranteeing a visit. This directly reinforces your goal of not forgetting servers for too long.
Option 3: The "I'm Bored" Override (A New Mechanic)
Change: Introduce a new condition to the logic. If the bot has gone through a certain number of decision cycles (e.g., 5 cycles, or about 50 minutes) without finding any target, it can enter an "I'm bored" state.
In this state: It can temporarily lower its standards. For this one cycle, it could either:
Lower the MIN_SCORE_THRESHOLD to 10.
Or, choose the highest-scoring server, even if it's below the threshold.
Effect: This ensures the bot never stays silent for too long. If everywhere is quiet, it will eventually shrug and say, "Alright, fine, I'll go say hi to someone anyway."
Recommendation
Combine Option 1 and Option 2.
Lower the MIN_SCORE_THRESHOLD from 50 to 30. This acknowledges that a "perfect" conversation isn't always necessary.
Increase the LONELINESS_BONUS_POINTS_PER_DAY from 5 to 15. This makes the bot's desire to revisit quiet servers a much more significant factor in its decision-making.
This two-pronged approach makes the bot more active overall while specifically strengthening the logic that serves your core mission. It will still prefer active servers, but it will no longer wait a full week to say hello to a lonely friend. It will feel more present and caring, which is exactly what you want.