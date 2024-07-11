# MakerPic - AI Avatars Generator

MakerPic is an AI Avatar Generator SaaS Template built with Next.js, Supabase and Tailwind CSS.

MakerPic uses [Replicate](https://replicate.com) to generate images using SDXL, a powerful AI generative model.

## How it Works

Generally speaking, the process of generating images involves two steps:

1. Training a model to generate images
2. Using the trained model to generate images based on user input

While not the most UX friendly (since this kit is more B2B than B2C), MakerPic implements two entities (models and avatars) to demonstrate the process of generating images, multiple entities management, and credits system billing.

### Entities

We have two pages/entities:

1. Models - where you can train a model based on a set of images
2. Avatars - where you can pick a previously trained model and generate an avatar based on a set of user inputs (for example, you want to generate your avatars based on a cartoon style)

In Storage, we also have the following folders:

1. `avatars_models` - where we store a zip file containing the images used to train the model. This needs to be publicly accessible so that Replicate can access the images.
2. `avatars_generations` - where we store the generated avatars.

### Technical Details

#### Training a Model

To create a model, we call the Replicate API to train a model based on a set of images. First, we prepare a zip file locally containing the images uploaded by the user. We assign a "referenceId"
to the model, which is used to identify the model when generating avatars (this zip must be publicly accessible so can Replicate can fetch it).

We use this Reference ID when storing the zip filename in Supabase Storage and when we pass the webhook to Replicate to identify the model when the training ends.

Once the model is trained, Replicate will call our webhook to notify us that the training is complete. We then store the model's details in our database.

This webhook gets called at `/api/replicate/training/webhook`. We update the status of the model in the database and store the model's details.

#### Generating an Avatar

Similarly, we kick off the generation of an avatar by calling the Replicate API. We pass the generation's ID to the webhook URL as a query parameter. Replicate will then call our webhook to notify us that the generation is complete. We then store the avatar's details in our database and fetch all the images and store them in Supabase.

This webhook gets called at `/api/replicate/generation/webhook`. We update the status of the avatar in the database and store the avatar's details.

### Billing

We implement a credits system to demonstrate how you can charge users for using your service. The credits will be necessary to train a model and generate an avatar.

Users can purchase credits using Stripe, and the credits will be added to their account.

Whenever users generate a new model, we will charge 10 credits. Whenever users generate a new avatar, we will charge 1 credit.

By default, new organizations are assigned 20 credits. You can change this in the `organization_credits` table in your Supabase database by changing the `credits` field default value.

#### Stripe Plans

Remember that you will need to setup the Stripe plans using one-time payments setups. Additionally - remember to set your Stripe IDs in the configuration.ts plans to reflect the plans you have in your Stripe account.

### Setting up Replicate.com

NB: **this is a paid service**. You will need to sign up for an account and get your API key.

First, you will need to sign up for an account at [Replicate](https://replicate.com). Then, you will need to create a new project and get your API key.

You can then create a new model based on SDXL. Now, you'll be using this model train your own models and generate avatars.

We will need to add the following environment variables to your `.env.local` file:

```
REPLICATE_API_TOKEN=
WEBHOOK_DOMAIN=
REPLICATE_USERNAME=
REPLICATE_PARENT_MODEL_VERSION=
REPLICATE_DESTINATION_MODEL_NAME=sdxl
STORAGE_PROXY_URL=
```

Let's break down each of these variables:

1. `REPLICATE_API_TOKEN` - your Replicate API token - keep it safe!
2. `WEBHOOK_DOMAIN` - the domain where your webhook is hosted. This is used to receive webhooks from Replicate. Useful for testing since you'll need to receive webhooks from Replicate. I use LocalCan, but you can use ngrok or any other service.
3. `REPLICATE_USERNAME` - your Replicate username
4. `REPLICATE_PARENT_MODEL_VERSION` - the version of the model you want to use to train your own models. You can find this in the Replicate dashboard.
5. `REPLICATE_DESTINATION_MODEL_NAME` - the name of the model you want to use to generate images. This is the name of the model you created in Replicate.
6. `STORAGE_PROXY_URL` - the URL of your Supabase storage proxy. This is used to upload images to your Supabase storage. For testing purposes, you can use the Supabase storage proxy URL.

The Supabase Proxy needs to point to your Supabase storage. You can find the URL in your Supabase dashboard.

For reference my Replicate settings are:

```
REPLICATE_USERNAME=gbuomprisco
REPLICATE_PARENT_MODEL_VERSION=39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c*******
REPLICATE_DESTINATION_MODEL_NAME=sdxl
```

#### What is the STORAGE_PROXY_URL?

You need to let Replicate access your local Supabase storage to upload the images. You can use LocalCan, ngrok, or any other service to proxy the requests from Replicate to your local server.

When you deploy to production, you will need to change the `WEBHOOK_DOMAIN` to your production domain. Instead, the `production` build will never use `STORAGE_PROXY_URL` so you can remove it from your production environment variables.

#### What is the WEBHOOK_DOMAIN?

This is the domain where your webhook is hosted. This is used to receive webhooks from Replicate. Useful for testing since you'll need to receive webhooks from Replicate. I use LocalCan, but you can use ngrok or any other service.

#### Proxies

When you develop locally - you want to proxy the requests from the Replicate webhook to your local server. You can use LocalCan, ngrok, or any other service to do this.

When you deploy to production, you will need to change the `WEBHOOK_DOMAIN` to your production domain. Instead, the `production` build will never use `STORAGE_PROXY_URL` so you can remove it from your production environment variables.

In development, start a proxy pointing to your local server and Supabase storage.

```
STORAGE_PROXY_URL=https://proxy-to-your-supabase-storage.com
WEBHOOK_DOMAIN=https://proxy-to-your-local-server.com
```

Of course, replace the values above with your actual URLs.

In production, point the webhook to your production server.

### Environment Variables for SDXL

We support more variables for tweaking the model, but these are all optional and you **don't need to set them** unless you want to improve the quality of the generated images.

```
CAPTION_PREFIX='headshot profile picture'
REPLICATE_IMAGE_WIDTH='1024'
REPLICATE_IMAGE_HEIGHT='1024'
REPLICATE_PROMPT_STRENGTH= '0.8'
REPLICATE_LORA_SCALE='0.6'
REPLICATE_GUIDANCE_SCALE='7.5'
REPLICATE_HIGH_NOISE_FRAC='0.8'
REPLICATE_NUM_INFERENCE_STEPS='60'
REPLICATE_APPLY_WATERMARK='true'
```

Feel free to experiment with these variables to improve the quality of the generated images.

You can also set the credits cost as environment variables:

```
CREDITS_PER_AVATAR=1
CREDITS_PER_MODEL=10
```

## Tweaking the Prompts

Prompts are fundamental to get a good quality image. You can experiment with the prompts to improve the quality of the generated images.

To update or add new prompts, open the file at `src/lib/replicate/sdxl-prompts.ts` and update the `sdxlPrompts` object:

```tsx
const sdxlPrompts = (captionPrefix: string) => ({
  instagram: {
    prompt: `${captionPrefix}, An Instagram influencer's profile avatar, vibrant colors, detailed skin, clear and bright background, medium shot, chest up, trendy clothing, highly detailed facial features, sharp focus, glossy eyes, radiant skin texture, high resolution, 8k quality, detailed hair, chic and stylish, ultra-detailed, vibrant and lively, Zeiss 150mm f/2.8, best quality`,
    negative: `worst quality, low quality, normal quality, low-res, skin spots, acne, skin blemishes, age spots, ugly, duplicate, morbid, mutilated, blur, motion-blur, blurry, bokeh`,
  },
  disney: {
    prompt: `${captionPrefix}, Disney character in modern cartoon style, 8k resolution, vibrant colors, minimalistic background, digitally illustrated, crisp lines, excellent shading, detailed, high-quality rendering, Pixar-style 3D animation, smooth textures, expressive eyes, high definition, detailed, sharp focus, unreal engine, CGI, pixar`,
    negative: `worst quality, low quality, normal quality, low-res, skin spots, acne, skin blemishes, age spots, ugly, duplicate, morbid, mutilated, blur, motion-blur, blurry, boke`,
  },
  anime: {
    prompt: `${captionPrefix}, anime character for a profile picture, studio ghibli, Japanese, head and shoulders view, vibrant color scheme, clean line art, digital painting, crisp detail, subtle shading, bright eyes, high quality, high resolution, sharp focus, artstation, digital art, ultra-detailed, 4K.`,
    negative: `worst quality, low quality, normal quality, low-res, skin spots, acne, skin blemishes, age spots, ugly, duplicate, morbid, mutilated, blur, motion-blur, blurry, bokeh`,
  },
  custom: {
    prompt: '',
    negative: '',
  },
});

export type SdxlPromptPreset = keyof typeof sdxlPrompts;

export function getSdxlPromptByPresetId(presetId: keyof typeof sdxlPrompts) {
  return sdxlPrompts[presetId];
}
```

You can add more styles and prompts to the `sdxlPrompts` object.

To populate the dropdown with the new prompts, add new options at `src/app/dashboard/[organization]/avatars/generate/generate-avatars-form.tsx`:

```tsx
<SelectContent>
  <SelectGroup>
    <SelectLabel>Presets</SelectLabel>

    <SelectItem value={'instagram'}>Instagram</SelectItem>
    <SelectItem value={'disney'}>Disney</SelectItem>
    <SelectItem value={'pixar'}>Pixar</SelectItem>

    {/* Add new prompts here */}
  </SelectGroup>

  <SelectGroup>
    <SelectLabel>Use your own prompt</SelectLabel>
    <SelectItem value={CUSTOM}>Custom</SelectItem>
  </SelectGroup>
</SelectContent>
```

## Known Limitations

1. **Improving Prompts**: Prompts require more work: I've tried my best, but to be on par with better services out there, you'll need to spend more time on the prompts. I've added a few prompts to the generation, but you can add more prompts to improve the quality of the generated images.
2. **Improving the UX**: The UX of this Makerkit kit is B2B-focused, but this is clearly a B2C product. You'll need to spend more time on the UX to make it more user-friendly should you wish to use it for a B2C product.

### I could use some help with the following

1. **Improving the prompts**: Tweaking the existing ones so that the generated images are of better quality.
2. **Adding new prompts**: Adding more styles, prompts, and presets to the dropdown.
3. **More AI Providers**: Adding more AI providers to generate images. This kit only supports Replicate, but you can add more providers to generate images.

### Support

1. Support regarding the usage of Replicate should be directed to Replicate. This is a paid service, and you should contact them for any issues regarding the usage of their service.
2. Support regarding the quality of your generated images is also not provided by Makerkit - it's best to experiment with the variables and prompts to improve the quality of the generated images.
3. I can help with any issues regarding the usage of this kit, but I cannot help with issues regarding the quality of the generated images - or Replicate's service.

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
