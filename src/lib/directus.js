import { createDirectus, rest } from '@directus/sdk'

const client = createDirectus('https://directus-production-b0c2.up.railway.app')
  .with(rest({
    onRequest: (options) => {
      const token = localStorage.getItem('directus_token')
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`
        }
      }
      return options
    }
  }))

export default client