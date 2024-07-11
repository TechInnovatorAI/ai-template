# Chatbots AI SaaS Template

This application is a Chatbot SaaS App Demo bootstrapped with the Makerkit Next.js Supabase kit.

This application **is a demo app** and **may have bugs and issues**.
If you plan on using it in a production environment, please **ensure you test it thoroughly and fix any issues you may find**.

The scope of this app is to show patterns and best practices for building a SaaS with Makerkit - and not to be a production-ready application.

This application is split in 1 app and 1 package:

1. **Chatbot SaaS App** - A Next.js application that allows users to create chatbots and embed them on their websites. This is at `apps/chatbots`.
2. **Chatbot Widget** - A React component that allows users to embed the chatbot on their website. This is at `packages/chatbot-widget`.

NB: all the core kit requirements apply when deploying to production and setting up the application!

## Details

This application is a demo application that allows you to create a Chatbot SaaS application.

Users can:

1. Create chatbots in an Organization (based on plan details)
2. Update the chatbot settings (e.g. name, description, etc.) and branding (e.g. colors, etc.)
3. Crawl websites and train the chatbot using OpenAI
4. Embed the chatbot on their website using a widget imported with a simple script tag

NB: this demo application is considered feature-complete, so it's unlikely more features will be added. However, I will fix bugs and issues as they are reported.

## Requirements (Chatbot SaaS)

To make the Chatbot SaaS template application work, you will need to:

1. Open an Upstash (QStash) account or replace the Task Queue with any other task queue service (e.g. AWS SQS, Google Cloud Tasks, Inngest, Trigger, etc.)
2. Open an Open AI account and create an API key
3. Open a Supabase account and create a project
4. Open a Stripe account and create a product

Additionally, you will setup the rest of the environment variables of the Core kit as described in the documentation.

#### Adding the required environment variables

To run the application, you will need to add the following environment variables:

```bash
## In the Next.js App

OPENAI_API_KEY=
NEXT_PUBLIC_CHATBOT_API_URL=/api/chat
NEXT_PUBLIC_WIDGET_HOSTING_URL=makerkit-chatbot.js

## In the Chatbot Widget

NEXT_PUBLIC_CHATBOT_API_URL=http://localhost:3000/api/chat
WIDGET_CSS_URL=./makerkit-chatbot.css
CHATBOT_SDK_NAME=makerkit-chatbot.js
WIDGET_SETTINGS_ENDPOINT=http://localhost:3000/api/chatbot
```

These values work for development. For production, you will need to change them to point to absolute URLs based on where you're hosting the application.

For example, if you're hosting the application on `https://myapp.com`, you will need to change the values to:

```bash
## In the Next.js App
OPENAI_API_KEY=
NEXT_PUBLIC_CHATBOT_API_URL=https://myapp.com/api/chat
NEXT_PUBLIC_WIDGET_HOSTING_URL=https://myapp.com/makerkit-chatbot.js

## In the Chatbot Widget
NEXT_PUBLIC_CHATBOT_API_URL=https://myapp.com/api/chat
WIDGET_CSS_URL=https://myapp.com/makerkit-chatbot.css
CHATBOT_SDK_NAME=https://myapp.com/makerkit-chatbot.js
WIDGET_SETTINGS_ENDPOINT=https://myapp.com/api/chatbot
```

Please make sure not to use the .env files for production keys (OPENAI and QSTASH). Instead, use the environment variables provided by your hosting provider.
Locally, you can use the .env.local file - which is ignored by git and will not be pushed to the repository.

#### Additional Configuration

You can also change the following environment variables:

```bash
# The maximum number of documents returned by the retriever. Less results in faster response times.
# The default is 2.
CHATBOT_MAX_DOCUMENTS=2

# The similarity threshold for the retriever.
# The default is 0.8.
CHATBOT_SIMILARITY_THRESHOLD=0.8

# The OpenAI model to use for the Chatbot.
# The default is gpt-3.5-turbo.
OPENAI_MODEL=gpt-3.5-turbo
```

#### Indexing Chunk Size

By default, we index embeddings using chunks with length 1500. This is to make sure we don't hit the maximum context length.

If you use models that allow indexing a larger chunk size, you can tweak the settings using the following environment variable:

```bash
DOCUMENT_CHUNK_SIZE=4000
```

### Building the Chatbot Widget

To build the Chatbot Widget during development, run the following command:

```bash
pnpm --filter chatbot-widget build
```

This will create a `makerkit-chatbot.js` file in the `dist` folder.

To create a production build, run:

```bash
pnpm --filter chatbot-widget build:production
```

You can make this command part of your CI/CD pipeline to deploy the Chatbot Widget to a CDN.

#### Environment Variables

You need to update the file `packages/chatbot-widget/.env` to update the environment variables for the Chatbot Widget. The production environment variables are instead in the file `.env.production`.

### Deploying the Chatbot Widget

You will need to deploy the Chatbot Widget to a CDN. You can use any CDN you prefer, such as Cloudflare Pages, Netlify, Vercel, etc.

Simply upload the `packages/chatbot-widget/dist` folder to the CDN and make sure to set the correct headers for the files.

Then, update the `NEXT_PUBLIC_WIDGET_HOSTING_URL` environment variable to point to the URL of the Chatbot Widget.

### Testing a Chatbot Widget

Create an `index.html` in the `packages/chatbot-widget/dist` folder and paste the Chatbot Widget code (you can find it in the `Publish` tab of the Chatbot). For example:

```html
<script data-chatbot="2" src="makerkit-chatbot.js"></script>
```

Make sure to change the `data-chatbot` attribute to the ID of the chatbot you want to test.

Then, open the file in your browser. You should see the chatbot widget.

To run a server locally, you can use:

```bash
pnpm filter --chatbot-widget serve
```

#### Adding a Plan to the Database

You are free to specify your own limitations in the DB.

To add a plan, you will insert a new row in the `public.plans` table.

The `public.plans` table has the following information:

```sql
create table if not exists public.plans (
  name text not null,
  variant_id varchar(255) not null,
  max_documents bigint not null,
  max_messages bigint not null,
  max_chatbots bigint not null,

  primary key (variant_id)
);
```

You can insert a new plan using the following SQL query:

```sql
insert into public.plans (name, variant_id, max_documents, max_messages, max_chatbots)
values ('Free', 'free', 100, 1000, 1);
```

1. `name` is the name of the plan.
2. `variant_id` is the ID of the plan. This is used to identify the plan in the application. Please make sure to add the correct variant ID in the `public.plans` table.
3. `max_documents` is the maximum number of documents the user can index.
4. `max_messages` is the maximum number of messages the user can send.
5. `max_chatbots` is the maximum number of chatbots the user can create.

When an invoice is paid, the `variant_id` is used to update the user's plan. This information will populate the `account_usage` table.

```sql
create table if not exists public.account_usage (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  documents_quota int not null default 5,
  messages_quota int not null default 100
);
```

We use the `account_usage` table to track the usage of the user. When the user exceeds the limits, we can show a message to the user to upgrade their plan.

## QStash Environment Variables

We use QStash to run the background tasks that are used to crawl websites and train the chatbot. We crawl 30 pages for each task. We automatically add delays between each task to be gentle with the websites we crawl.

To run the application, you will need to add the following environment variables:

```
QSTASH_TOKEN=
QSTASH_URL=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

You can grab these values from your Upstash QStash dashboard.

NB: You can change the Task Queue to any other service you prefer, such as AWS SQS, Google Cloud Tasks, Inngest, Trigger, etc.
You will need to adjust the code accordingly.

### QStash endpoint

To test your queues locally, you need to run the QStash endpoint locally. You have various options, such as creating a tunnel with Ngrok, Cloudflare Tunnel, LocalCan, or even VSCode Port Forwarding.

In such case, your `QSTASH_URL` will be the URL of the tunnel. Assuming your tunnel URL is `https://next-supabase-chatbot.ngrok.com`, you will set the following environment variable:

```
QSTASH_URL=https://next-supabase-chatbot.ngrok.com/api/tasks/execute
```

As you can see, you will need to add `/api/tasks/execute` at the end of the URL, which points to the `execute` endpoint of the `tasks` API.

---

# Your Application

Write here everything about your application.

## Setup

For working locally, please add a file named `.env.local` where we can place our environment variables. This file is not committed to Git, therefore it is safe to store sensitive information in it.

After starting Supabase, copy the service role key from the Supabase project settings and add it to the `.env.local` file.

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Stripe

For the Stripe integration, first we need to start the Stripe CLI:

```
pnpm run stripe:listen
```

Then, update the `.env.local` file with the following variables:

```
STRIPE_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Supabase

Please follow the instructions in the [Supabase README](../supabase/README.md) to setup your Supabase project.
