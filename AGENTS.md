# AGENTS.md

## 🧭 Project Scope

- **Single repo**, front-end only (HTML, CSS, JavaScript)
- No backend scripts or serverless functions includedexcept:
- Amazon Bedrock foraccess to an LLM

## 🛠️ Tech Stack

- HTML5, modern CSS (Flexbox/Grid), ES2021+ JavaScript
- No frameworks—vanilla JS

## 🎨 Coding Conventions

- Format JS with: `prettier --write .`
- Lint using: `eslint . --fix`
- Naming: `camelCase` for variables/functions, `PascalCase` for any classes
- Constants: `UPPER_SNAKE_CASE`
- Use CSS classes—no inline styles
- Document public functions with JSDoc

## Directory Structure

src/
├── js/ # Javascript code
├── css/ # CSS files
├── html/ # HTML code (main entry point: prsm.html)
├── api-server/ # programmatic interface, including link to AWS Bedrock for the LLM
├── data/ # assorted test data and old PRSM maps
├── doc/ # documentaion
      ├── jsdoc/ # JSdoc files
      ├── help/  # user manual
├── ws-server/ # code to run a WebServer

## ✅ Testing Protocol

- No tests implemented

## Commands

npm run build      # Build the project
npm run lint       # Lint code
npm build-help     # Build the user manual

## Core Principles

1. **Simplicity over cleverness** - Write code that's immediately understandable
1. **Single responsibility** - Functions do one thing, under 20 lines
1. **Early returns** - Guard clauses over nested conditionals
1. **Match existing patterns** - Follow the file's conventions exactly
