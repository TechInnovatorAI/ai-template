const sdxlPrompts = (captionPrefix: string) => ({
  instagram: {
    prompt: `${captionPrefix}, an Instagram influencer's profile avatar, vibrant colors, detailed skin, clear and bright background, medium shot, chest up, trendy clothing, highly detailed facial features, sharp focus, glossy eyes, radiant skin texture, high resolution, 8k quality, detailed hair, chic and stylish, ultra-detailed, vibrant and lively, Zeiss 150mm f/2.8, best quality`,
    negative: `worst quality, low quality, normal quality, low-res, skin spots, acne, skin blemishes, age spots, ugly, duplicate, morbid, mutilated, blur, motion-blur, blurry, bokeh`,
  },
  disney: {
    prompt: `${captionPrefix}, disney character in modern cartoon style, 8k resolution, vibrant colors, minimalistic background, digitally illustrated, crisp lines, excellent shading, detailed, high-quality rendering, Pixar-style 3D animation, smooth textures, expressive eyes, high definition, detailed, sharp focus, unreal engine, CGI, pixar`,
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

export type SdxlPromptPreset = keyof ReturnType<typeof sdxlPrompts>;

export function getSdxlPromptByPresetId(
  captionPrefix: string,
  presetId: SdxlPromptPreset,
) {
  return sdxlPrompts(captionPrefix)[presetId];
}
