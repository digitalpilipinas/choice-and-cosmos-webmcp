import { RESEARCH_API_PATH } from '../src/research/contract.ts'
import { handleResearchRequest } from '../server/research/handler.ts'

type Env = {
  ASSETS: {
    fetch: (request: Request) => Response | Promise<Response>
  }
  GEMINI_API_KEY?: string
}

export default {
  fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === RESEARCH_API_PATH) {
      return handleResearchRequest(request, {
        env: { GEMINI_API_KEY: env.GEMINI_API_KEY },
      })
    }
    return env.ASSETS.fetch(request)
  },
}
