import { RESEARCH_API_PATH } from '../src/research/contract.ts'
import { handleResearchRequest } from '../server/research/handler.ts'

type Env = {
  ASSETS: {
    fetch: (request: Request) => Response | Promise<Response>
  }
}

export default {
  fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === RESEARCH_API_PATH) {
      return handleResearchRequest(request, {
        env: {},
      })
    }
    return env.ASSETS.fetch(request)
  },
}
