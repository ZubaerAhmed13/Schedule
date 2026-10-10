# Weekwise

A responsive personal weekly planner with a 24-hour calendar, daily and weekly views, activity templates, work-day planning, habits, and a time-use dashboard.

## Publish with GitHub Pages

1. Open **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then save.
4. Wait for GitHub Pages to publish the site.

The public site URL should be https://zubaerahmed13.github.io/Schedule/.

## Data and privacy

Weekwise saves planner data in local browser storage. It does not automatically sync schedules across devices. Export a backup in the app before clearing browser data or switching browsers. The repository contains app code, not your local schedule.

## Offline app

After the site is first opened online, the service worker can cache the application shell for later offline use.


## Planner starts empty

The weekly calendar starts empty by design. No starter routine is inserted automatically, and saving Work day or Class settings only updates the reusable template. Add events yourself with **Add an activity** and choose one of the templates. Existing user-created activities are preserved when older built-in routine entries are removed.
