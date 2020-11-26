# sendgrid-sync
An experiment with SendGrid's API for syncing templates

![Node.js CI (npm)](https://github.com/stripethree/sendgrid-sync/workflows/Node.js%20CI%20(npm)/badge.svg) ![Fetch Templates](https://github.com/stripethree/sendgrid-sync/workflows/Fetch%20Templates/badge.svg)

```
nvm use
yarn
cp env.sample .env

// Edit `.env` to add the `SENDGRID_API_KEY`

export $(cat .env | xargs)
yarn run fetch
```
