import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { getLogger } from '@kit/shared/logger';

import appConfig from '~/config/app.config';

export function createPostsLLMService() {
  return new PostsLlmService();
}

class PostsLlmService {
  private readonly debug = !appConfig.production;

  async generateOutline(params: { title: string; instructions?: string }) {
    const logger = await getLogger();

    logger.info(params, `Generating outline...`);

    const Schema = z.object({
      outline: z.array(
        z.object({
          heading: z.string().min(1),
          sections: z.array(z.string().min(1)),
        }),
      ),
    });

    const result = await generateObject({
      temperature: 0.8,
      mode: 'json',
      maxTokens: 1600,
      model: openai(this.getModelName()),
      system: 'You are an expert blog post writer',
      schema: Schema,
      prompt: `As an expert content writer, you are tasked with writing an outline for a blog post titled "${params.title}"; ${params.instructions ? `Please follow the instructions as outlined: "${params.instructions}".` : '.'} The outline should include an H2 heading and at least 3 H3 headings for all the sections of the blog post. The "heading" is an H2 and the "sections" are H3s. Please never include introduction and conclusion in the outline. Create at least 3 sections and at least 2 subsections for each section.`,
    });

    if (this.debug) {
      console.log(
        `Response from generateOutline`,
        JSON.stringify(result.object, null, 2),
      );
    }

    logger.info(`Outline successfully generated.`);

    const content = result.object.outline.map((section) => {
      const sections = section.sections.map((value) => ({ value }));

      return {
        heading: section.heading,
        sections,
      };
    });

    const tokens = result.usage.totalTokens;

    return {
      content,
      tokens,
    };
  }

  async generateBulletPoints(
    title: string,
    outline: Array<{
      heading: string;
      sections: Array<{
        value: string;
      }>;
    }>,
  ) {
    const Schema = z.object({
      bulletPoints: z.array(z.string().min(1)),
    });

    let tokens = 0;

    const requests = outline.map(async (item) => {
      const sections = item.sections.map(async (section) => {
        const result = await generateObject({
          temperature: 0.8,
          maxTokens: 1600,
          mode: 'json',
          model: openai(this.getModelName()),
          system: 'You are an expert blog post writer',
          schema: Schema,
          prompt: `As an expert content writer, you are tasked with creating a list of talking points of the blog post "${title}" for the following heading: ${section.value}. The talking points should be short and concise. You must provide between 2 and 5 talking points.`,
        });

        if (this.debug) {
          console.info(
            `Response from generateBulletPoints: ${JSON.stringify(result.object, null, 2)}`,
          );
        }

        tokens += result.usage.totalTokens;

        const bulletPoints = result.object.bulletPoints.map((value) => ({
          value,
        }));

        return {
          value: section.value,
          bulletPoints,
        };
      });

      return {
        heading: item.heading,
        sections: await Promise.all(sections),
      };
    });

    const content = await Promise.all(requests);

    if (this.debug) {
      console.info(`Bullet points successfully generated.`, content);
    }

    return {
      content,
      tokens,
    };
  }

  async generatePost(
    title: string,
    params: Array<{
      heading: string;
      sections: Array<{
        value: string;
        bulletPoints: Array<{
          value: string;
        }>;
      }>;
    }>,
  ) {
    const logger = await getLogger();

    try {
      const responses = await Promise.all([
        this.generateIntroduction(title),
        this.generateBody(title, params),
        this.generateConclusion(title),
      ]);

      const tokens = responses.reduce((acc, response) => {
        return acc + response.tokens;
      }, 0);

      const introduction = responses[0].content;
      const body = responses[1].content;
      const conclusion = responses[2].content;
      const content = [introduction, body, conclusion].join('\n\n');

      if (this.debug) {
        console.info(`Generated post: ${content}`);
      }

      return {
        content,
        tokens,
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to generate post: ${JSON.stringify(error)}`);

      return {
        content: '',
        tokens: 0,
        success: false,
      };
    }
  }

  private async generateBody(
    title: string,
    params: Array<{
      heading: string;
      sections: Array<{
        value: string;
        bulletPoints: Array<{
          value: string;
        }>;
      }>;
    }>,
  ) {
    const requests = params.map(async (section) => {
      const paragraphsRequests = section.sections.map(async (section) => {
        return this.generateParagraph(
          title,
          section.value,
          section.bulletPoints,
        );
      });

      const paragraphs = await Promise.all(paragraphsRequests);

      const paragraphText = paragraphs
        .map((paragraph) => paragraph.content)
        .join('\n\n')
        .trim();

      const tokens = paragraphs.reduce(
        (acc, paragraph) => paragraph.tokens + acc,
        0,
      );

      const content = `## ${section.heading}\n\n${paragraphText}`;

      return {
        content,
        tokens,
      };
    });

    const data = await Promise.all(requests);

    const content = data
      .map((item) => item.content)
      .join('\n\n')
      .trim();

    const tokens = data.reduce((acc, item) => item.tokens + acc, 0);

    return {
      content,
      tokens,
    };
  }

  private async generateParagraph(
    title: string,
    heading: string,
    bulletPoints: Array<{
      value: string;
    }>,
  ) {
    const response = await generateText({
      model: openai(this.getModelName()),
      temperature: 0.8,
      maxTokens: 1600,
      system: `You are a world-class expert content writer`,
      prompt: `
          As an expert content writer, you are tasked with creating a paragraph for the blog post "${title}" (h3) for the following heading: ${JSON.stringify(heading)}.
          
          Expand the following bullet points into well-written paragraphs: ${JSON.stringify(bulletPoints)}.
            
          ${this.getWritingRulesPrompt()}
          - Do not write the title or heading in the section. Only the body content.
          
          Content:
          `.trim(),
    });

    const data = response.text;
    const tokens = response.usage.totalTokens;

    if (this.debug) {
      console.info(`Paragraph: ${response.text}`);
    }

    const content = `### ${heading}\n\n${data}`;

    return {
      content,
      tokens,
    };
  }

  private async generateIntroduction(title: string) {
    const result = await generateText({
      model: openai(this.getModelName()),
      temperature: 0.8,
      maxTokens: 1600,
      system: `You are a world-class expert content writer`,
      prompt: `As an expert content writer, you are tasked with writing an introduction for a blog post titled "${title}". The introduction should be 1-2 paragraphs long.
          
          ${this.getWritingRulesPrompt()}
          - Only write the body content and nothing else.
          - Do not use any headings.
          
          Introduction:`,
    });

    if (this.debug) {
      console.info(
        `Response from generateIntroduction`,
        JSON.stringify(result.text, null, 2),
      );
    }

    const content = result.text.trim();
    const tokens = result.usage.totalTokens;

    return {
      content,
      tokens,
    };
  }

  private async generateConclusion(title: string) {
    const result = await generateText({
      model: openai(this.getModelName()),
      temperature: 0.8,
      maxTokens: 1600,
      system: `You are a world-class expert content writer`,
      prompt: `As an expert content writer, you are tasked with writing a conclusion for a blog post titled "${title}". The conclusion should be 1-2 paragraphs long.
          
          ${this.getWritingRulesPrompt()}
          - Only write the body content and nothing else
          - Use an h2 heading that is meaningful and relevant to the blog post, not generic like "Conclusion"

          Conclusion:`,
    });

    if (this.debug) {
      console.info(
        `Response from generateConclusion`,
        JSON.stringify(result.text, null, 2),
      );
    }

    const content = result.text.trim();
    const tokens = result.usage.totalTokens;

    return {
      content,
      tokens,
    };
  }

  private getModelName() {
    const llm = process.env.LLM_MODEL_NAME;

    return llm ?? 'gpt-3.5-turbo-1106';
  }

  private getWritingRulesPrompt() {
    return `
    Writing rules that you must follow:
    - Output text using valid Markdown
    - Write professional text while balancing simplicity and complexity in your language and sentence structures.
    - Repeat the main keywords and phrases often for SEO
    - Use h4 headings for subheadings to split up the content into smaller sections
    - Avoid bullet points and numbered lists
    - The section must be below 200 words`.trim();
  }
}
