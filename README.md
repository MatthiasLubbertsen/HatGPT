# HatGPT

![HatGPT preview](public/shots_so/v4%20-%2031-3.png)

![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fhackatime-project-stats.matthiaslubbertsen.workers.dev%2F%3FuserID%3DU0A55A4B21K%26projects%3DHatGPT%2CAI-Interface&query=total_hms&style=for-the-badge&label=Hackatime&color=ffd000)

## whats this?
a chatgpt.com ui clone! ![yay](https://wsrv.nl/?url=https://emoji.slack-edge.com/T09V59WQY1E/yay/47296c029c8ee253.gif&w=16&h=16) free using [HackAI](https://ai.hackclub.com), open source and idk what more

## features
* usable without key
* support for all models
* add your own token for higher rate limits
* image generation support
* image upload support
* file upload support ([bucky](https://bucky.hackclub.com))
* title generation
* gravatar pfp
* search through your chats
* model dropdown
* responsive

## getting started

### easiest way
use the hosted version by me! [hatgpt.vercel.app](https://hatgpt.vercel.app/)

### self host easy way
deploy to vercel!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMatthiasLubbertsen%2FHatGPT&env=PUBLIC_API_KEY&envDefaults=%7B%22PUBLIC_API_KEY%22%3A%22add%20your%20HackAI%20key%20for%20public%20access%20here%22%7D&project-name=hatgpt&repository-name=hatgpt&demo-title=HatGPT&demo-description=Simple%20ChatGPT%20ui%20clone%20with%20HackAI%20as%20free%20api!&demo-url=https%3A%2F%2Fhatgpt.vercel.app&demo-image=https%3A%2F%2Fraw.githubusercontent.com%2FMatthiasLubbertsen%2FHatGPT%2Frefs%2Fheads%2Fmain%2Fpublic%2Fshots_so%2Fv4%2520-%252031-3.png)

### run locally
1. clone the repo (duh)
2. install with `npm install`
3. `cp .env.example .env` and add your [HackAI](https://ai.hackclub.com/keys) token as `PUBLIC_API_KEY` (for public usage)
4. run the app with `npm start`
5. open `http://localhost:3000` and start chatting

### for development
you might want to do

5. run `npm run bs`

to let BrowserSync reload the page for you at `http://localhost:3001`

# serverless api endpoints
* `api/ai` - SSE proxy with some cleanup
* `api/title` - title generation w/ first message as input
* ~~`api/upload` - uploading file to bucky~~ - removed this due to the lack of time ![pf](https://wsrv.nl/?url=https://emoji.slack-edge.com/T09V59WQY1E/pf/d2b4e41a039d2ec2.png&w=16&h=16)
* `api/status` - HackAI models
* `api/models` - proxy to HackAI models

## todo
- [x] chat functionality
- [x] model dropdown
- [x] title generation
- [x] attachments
- [x] HackAI status
- [x] rate limit for public key (2 per minute?)
- [x] title generation with public key
- [x] test image upload - end up removing it
- [x] test file upload - same as above
- [ ] test image generation
- [ ] phone view top bar styling
- [ ] phone view sidebar > settings close it
- [ ] center 'Ask anything' text

<details>
<summary>AI declaration</summary>
  
### I made almost all of the chatgpt.com ui clone myself
#### and i got tired of the project bc there were so many things to fix
so i used ai to help me with the rest wich is declared here (grabbed from my chats):

* textarea resizing when more than 1 line
* model dropdown functionality
* chat functionality
* dynamic script loading
* saving api key to local storage
* simplifying SSE code
* implementing chat history
* chat savings and title generation
* ui enhancements for api key modal
* search chats
* blinking dot
* gravatar pfp
* scroll behavior
* helping with system prompt
* selected text
* file upload
* title with public key
* rate limiting
* removing image upload
* image generation deletion
</details>