. Problem Description
Observed Behavior: When the WanderingService runs its decision cycle, the logs for the target guild consistently show the message: ❌ Guild [Your Server Name]: No eligible channels found.
Expected Behavior: The service should identify at least one channel (e.g., #general) as eligible, proceed to score it, and then consider it as a potential target. Even if the score is too low, the log should read ❌ Best channel #general score too low..., not No eligible channels found.
Context:
The bot has been granted a role with full Administrator permissions in the server.
A test message has been recently sent in the primary text channel (#general) to ensure there is activity.
The channel name does not appear to contain any keywords from the service's blacklist.

4. Root Cause Investigation Plan
The failure is occurring within the channel-discovery.service.ts or the initial filtering logic within wandering.service.ts. To diagnose this, we need to add enhanced, step-by-step debug logging to the channel discovery process.

Action Items:
Add Granular Logging to ChannelDiscoveryService:
For each channel being evaluated, log the outcome of every single check.
Example Log Output:
Generated code
[Discovery] Checking channel #general (ID: 123)...
[Discovery] -> Is Text Channel? ✅ Yes.
[Discovery] -> Passes Blacklist Check? ✅ Yes.
[Discovery] -> Has View Channel Perm? ✅ Yes.
[Discovery] -> Has Send Messages Perm? ✅ Yes.
[Discovery] -> Has Read History Perm? ✅ Yes.
[Discovery] --> Channel #general is ELIGIBLE.

[Discovery] Checking channel #rules (ID: 456)...
[Discovery] -> Is Text Channel? ✅ Yes.
[Discovery] -> Passes Blacklist Check? ❌ No (keyword: 'rules').
[Discovery] --> Channel #rules is INELIGIBLE.

Temporarily Lower Log Level:
Ensure the application's log level is set to DEBUG to capture this new, detailed output.

