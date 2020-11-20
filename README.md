# sendgrid-sync
An experiment with SendGrid's API for syncing templates

```
nvm use
yarn
cp env.sample .env

// Edit `.env` to add the `SENDGRID_API_KEY`

export $(cat .env | xargs)
yarn run sync
```
