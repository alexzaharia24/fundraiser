# Împreună pentru Bobi Simion

A small Romanian-language fundraising tracker built with React and Vite.

```sh
npm install
npm run dev
```

The tracker starts at 1,532 RON and shows progress toward an initial goal of 3,000 RON. The default theme is white and magenta. Visit `/admin` to set the total, add a contribution, change the goal, edit the public title, description and encouragement message, or switch between the magenta and green themes. The optional encouragement appears until the goal is reached. All settings, including the total and goal, are stored on the server and shared with visitors. This app does not process payments.

Visitors can scan the donation QR code shown below the progress message.

Admins can add, edit and remove up to 12 named milestones with distinct positive RON amounts. The admin visibility switch is off by default; enabling it displays milestones on the public page, while disabling it preserves them for editing. Milestones and their visibility are shared server-side. When enabled, milestones appear on the progress bar relative to the shared goal; milestones above that goal remain visible in the list. This switch controls display, not confidentiality: milestone data remains available through the public settings API.

Open pages check for settings changes every 30 seconds while visible and when the tab becomes visible again. Updates do not require a page refresh, and unsaved admin edits are preserved. Each check reads the shared settings store.

With `npm run dev`, settings are saved to local `.local` files, independently of the deployed site. The local admin page is not password-protected and the local settings API only accepts requests from the same computer. Restart the Vite server after changing its configuration.

Run `npm run build`, `npm run lint`, and `npm test` to verify the app.

## Deploying a preview to Vercel

Run `npx vercel --prod` and follow the prompts to deploy without connecting GitHub. Connect a private Vercel Blob store and set the secret `ADMIN_PASSWORD` in the Vercel project for each deployment environment before deploying. Vercel protects `/admin` and settings updates with HTTP Basic authentication: use `admin` as the username and the configured password. To test Vercel's middleware locally, use `vercel dev` with a separate development Blob store and password.

Previously saved browser-local text, total and goal can be reviewed and saved from the admin page when their corresponding server settings have not yet been set. Values from different browsers are not automatically merged. Select the theme again to share it.
