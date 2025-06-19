Does the Current System Forget Small Servers?
Not entirely, but it does have a strong bias towards activity.
What we have: The current system is a fair, self-balancing "priority queue." It finds the most active servers, visits them, and then puts them on a long cooldown. This gives less active servers a chance to be chosen once the big ones are temporarily out of the running.
The "Flaw": A very small or inactive server might never reach the minimum score threshold (e.g., score of 50). If there's no conversation for days, its score will always be near zero. In this scenario, the bot would indeed forget about it, which goes against your core mission.
You've correctly identified a conflict between the purely mathematical "best choice" logic and the empathetic "be a friend to the lonely" goal.
The Solution: Introducing "Pity Points" or a "Loneliness Detector"
We don't need to replace the current system. It's excellent at what it does. Instead, we can augment the scoring with a new factor that specifically rewards quiet servers. Think of it as adding a little bit of heart to the mathematical brain.
Here are a few ways to implement this, from simple to complex:
Approach 1: The "Long Time No See" Bonus
This is the simplest and most effective approach. The longer it has been since the bot visited a server, the more it "wants" to go back.
How it works: During channel scoring, add a new scoring factor.
Check the last time the bot successfully sent a message to that guild (you already store this for cooldowns).
Calculate the number of days since the last visit.
Add a bonus to the channel's score based on this duration. For example, add 5 points for every 24 hours that have passed since the last visit.
The Effect:
A channel in a super active server visited 6 hours ago gets no bonus.
A channel in a quiet server visited 3 days ago gets a +15 point bonus.
A channel in a lonely server visited 10 days ago gets a +50 point bonus. This +50 could be enough to push its otherwise low score over the minimum threshold, guaranteeing a visit.
Why it's great: It's self-regulating and directly addresses the goal. It ensures that no server is ever truly forgotten.
Approach 2: The "Low Score Floor"
This approach puts a safety net under the quietest servers.
How it works: After calculating a channel's score, if the score is very low (e.g., less than 10) but not zero, you can add a small, flat "pity point" bonus.
The Effect: It gives a slight boost to channels that are just barely alive, increasing their chances of eventually making it into the candidate pool. This is less targeted than the "Long Time No See" bonus but is simpler to implement.
Approach 3: The "Guaranteed Visit" Lottery
This is a more forceful, less organic approach, but it guarantees results.
How it works: Once a day, the bot runs a special, separate logic cycle. It finds all the guilds it hasn't visited in over a week (or some other long duration). From that list, it randomly picks one and sends a message to its most appropriate channel (e.g., a "general" channel), regardless of its activity score.
The Effect: It acts as a system override to ensure no server is ever left behind. This is less about "intelligent wandering" and more about "scheduled friendship maintenance."
Recommendation
Start with Approach 1: The "Long Time No See" Bonus.
It is the most elegant solution because it integrates perfectly with your existing scoring system. It doesn't feel like a separate, tacked-on feature. It refines the definition of a "good" channel to include not just current activity, but also the history of the bot's relationship with that server.
By adding this "loneliness" factor to your scoring, you directly serve your core mission. The bot will still love joining a lively party, but it will also remember to knock on the door of a quiet friend it hasn't seen in a while.