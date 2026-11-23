# Împreună pentru Bobi Simion

A small Romanian-language fundraising tracker built with React and Vite.

```sh
npm install
npm run dev
```

The tracker starts at 1,532 RON and shows progress toward an initial goal of 3,000 RON. Visit `/admin` to set the total, add a contribution, change the goal, edit the public title and description, or switch between the magenta and green themes. The total, goal, text, and theme are stored in the current browser's local storage, not synchronized across devices or users; changes appear on the main page in the same browser. Clearing browser data removes the saved values. This app does not process payments.

Run `npm run build`, `npm run lint`, and `npm test` to verify the app.

## Deploying a preview to Vercel

Run `npx vercel --prod` and follow the prompts to deploy without connecting GitHub. Set the secret `ADMIN_PASSWORD` in the Vercel project for each deployment environment before deploying. Vercel protects `/admin` with HTTP Basic authentication: use `admin` as the username and the configured password. The ordinary Vite development server does not run Vercel's middleware, so local `/admin` is unprotected.

This deployment remains a browser-local preview: different visitors will not share a campaign total. The admin code and browser storage are not private or tamper-proof; do not use this as a live shared fundraiser until shared storage and server-side authorization are added.
