import axios from "axios";

// @see: https://platform.openai.com/docs/guides/chat/introduction
const CHATGPT_API = "https://api.openai.com/v1/chat/completions";

export type ChatChoice = {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
};
export type ChatResponse = {
  id: string;
  object: string;
  created: number;
  choices: ChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export class Chat {
  private key: string;
  private language: string;
  private model: string;
  private techStack: string[];

  constructor(
    key: string,
    options?: {
      language?: string;
      model?: string;
      techStack?: string[];
    }
  ) {
    this.key = key;
    this.language = options?.language || "English";
    this.techStack = options?.techStack || [];
    this.model = options?.model || "gpt-3.5-turbo";
  }

  private async request(content: string) {
    const messages = [{ role: "user", content }];
    const response = await axios.post<ChatResponse>(
      CHATGPT_API,
      {
        model: this.model,
        messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        timeout: 60000,
      }
    );
    return response.data;
  }

  /**
   * @see https://github.com/f/awesome-chatgpt-prompts
   * @param patch
   * @returns
   */
  private preparePrompt(patch: string) {
    const tech =
      this.techStack.length > 0
        ? `This project uses the following technologies: ${this.techStack.join(
            ","
          )}`
        : "";
    return `I want you to act as a pull request code review helper for software developers.${tech} You have been asked to review a pull request with code patch bellow. Please review the code and provide your feedback on any improvements that could be made to make this function more efficient or readable. Answer me in ${this.language}
    ${patch}`;
  }

  async review(patch: string = "") {
    if (!patch.trim()) return;
    const response = await this.request(this.preparePrompt(patch));
    return response?.choices?.[0]?.message?.content ?? null;
  }
}
