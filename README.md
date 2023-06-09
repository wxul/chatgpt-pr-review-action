# ChatGPT PR Review Action

Use ChatGPT to Review Pull Request 

## Release

1. Clone
2. `npm i`
3. Install `@vercel/ncc` : `npm i -g @vercel/ncc` (skip if installed)
4. `npm run build`
5. Push

## Inputs

see [action.yml](action.yml)

## Example usage

### Action Config

``` yml

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  example:
    steps:
      - uses: wxul/chatgpt-pr-review-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  ## GITHUB_TOKEN
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }} ## OPENAI_API_KEY
        with:
          language: 'English' ## Code Review Language, default: English
          tech_stack: typescript, react ## default empty, If set, it would facilitate better review for chatGPT.
          model: 'gpt-3.5-turbo' ## default: gpt-3.5-turbo, optional: gpt-4
          include: |   ## glob pattern
            src/**/*.ts
            src/**/*.tsx
```
