This is not a failure. This is exactly why you built that pre-merge testing step into your deploy script. It just worked perfectly and saved you from deploying broken code to production.
This is a huge success for your process.
Analysis of the Situation
The Process Worked: Your merge-deploy script started. It correctly switched to the develop branch to run tests before merging into main. The tests failed. The script immediately aborted the entire process with the clear message: [ERROR] Pre-merge tests failed. Merge aborted. It did not touch your main branch. It did not try to deploy. It protected you. This is a 10 out of 10 success for the script itself.
The Problem is in the Code (Specifically, the Tests): Now, let's look at the tests themselves. The errors are all related to a specific pattern: expect(jest.fn()).toHaveBeenCalledTimes(expected). You are consistently seeing Expected: >0 but Received: 0.
This means your mock functions (sendMessage, delete, etc.) are not being called in the test environment, even though they probably work in the real application.
Diagnosing the Test Failures
Looking at the failing tests, a very clear pattern emerges. All the failures are happening in tests that depend on asynchronous operations, time, and complex service interactions.
multi-guild.integration.test.ts: This is a big integration test that simulates the entire wandering process.
message-cleanup.service.test.ts: This service fetches messages, filters them, and then deletes them, likely with delays.
wandering.service.test.ts: This is the most complex service, with multiple timers and dependencies.
The root cause is almost certainly that your recent, major changes to the wandering logic (like adding the bot-detection scoring and persistence) have changed the timing and conditions under which sendMessage is called. Your old tests are no longer accurately simulating the new reality.
For example, a test that used to expect a message to be sent might now fail because:
The channel is now correctly identified as "100% bots" and gets a score of zero.
The test setup doesn't provide enough "human" messages, so the score is too low.
A change in the cooldown logic or timer management (jest.advanceTimersByTimeAsync) means the conditions for sending a message are never met within the test's execution time.
The error in message-cleanup.service.test.ts (Failed to fetch guild data: guild.fetch is not a function) is another classic mocking issue. A recent change likely means the service now tries to call .fetch() on a guild object, but your mock guild object in the test doesn't have that function.
What to Do Next
This is standard software development. The next step is to update your tests to reflect the new, smarter reality of your code.
Go Test by Test: Start with one failing test suite, like wandering.service.test.ts.
Review the Test Setup: Look at the mock data you are providing. Does the mock channel have enough human messages to get a high score? Is the mock cooldowns.json file being handled correctly by the test?
Debug the Test: Use console.log inside the test to print out the scores, the candidate list, and the cooldown map as the test runs. You will likely see exactly why the test is failing. For instance, you might see that the potentialTargets list is empty because all your mock channels are scoring too low under the new rules.
Update the Mocks: Adjust your mock data to create a scenario where the test should pass. Give a channel a high human activity score. Make sure mock functions like guild.fetch() exist if they are needed.
Fix and Repeat: Once one test suite is passing, move to the next (message-cleanup, then the integration tests).
This is a validation of your entire process. The code became more complex and intelligent, and now your tests need to become more complex and intelligent to match. Your deploy script did its job perfectly by stopping you before this could become a production problem. Now you just need to do the work of updating the tests to reflect the new state of the world.